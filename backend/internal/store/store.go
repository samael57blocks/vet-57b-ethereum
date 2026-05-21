// Package store defines the Store interface and its pgx-backed implementation
// for persisting indexed blockchain data to PostgreSQL.
package store

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"vet-57b/backend/internal/models"
)

// Store is the data access interface for the indexer and API layers.
type Store interface {
	// Checkpoints
	GetCheckpoint(ctx context.Context) (*models.Checkpoint, error)
	UpsertCheckpoint(ctx context.Context, cp *models.Checkpoint) error

	// Pets
	UpsertPet(ctx context.Context, pet *models.Pet) error
	ListPets(ctx context.Context, filter PetFilter) ([]*models.Pet, int, error)
	GetPet(ctx context.Context, id uint64) (*models.Pet, error)

	// Appointments
	UpsertAppointment(ctx context.Context, appt *models.Appointment) error
	ListAppointments(ctx context.Context, filter AppointmentFilter) ([]*models.Appointment, int, error)
	GetAppointment(ctx context.Context, id uint64) (*models.Appointment, error)

	// Stats
	GetStats(ctx context.Context) (*Stats, error)

	// Reorg — deletes pets + appointments where block_number > given block.
	// Returns total rows deleted across both tables.
	DeleteEventsAfterBlock(ctx context.Context, blockNumber uint64) (int64, error)

	Close()
}

// PetFilter holds optional filter parameters for ListPets.
type PetFilter struct {
	Type  string // Dog, Cat, or empty for all
	Name  string // substring ILIKE match
	Page  int    // 1-based
	Limit int    // max 100
}

// AppointmentFilter holds optional filter parameters for ListAppointments.
type AppointmentFilter struct {
	PetID *uint64 // filter by pet
	From  *int64  // unix timestamp, inclusive
	To    *int64  // unix timestamp, inclusive
	Paid  *bool   // true=paid, false=unpaid, nil=all
	Page  int     // 1-based
	Limit int     // max 100
}

// Stats holds aggregate statistics from the database.
type Stats struct {
	TotalPets             int    `json:"totalPets"`
	TotalAppointments     int    `json:"totalAppointments"`
	TotalPaidAppointments int    `json:"totalPaidAppointments"`
	TotalRevenueCents     string `json:"totalRevenueCents"` // NUMERIC(78,0) as string
}

// pgxStore implements Store backed by a pgx connection pool.
type pgxStore struct {
	pool *pgxpool.Pool
}

// New creates a new Store backed by a pgx connection pool.
// It pings the database before returning to validate connectivity.
func New(ctx context.Context, databaseURL string, maxConns, minConns int) (Store, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("store: parse config: %w", err)
	}
	cfg.MaxConns = int32(maxConns)
	cfg.MinConns = int32(minConns)

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("store: create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("store: ping: %w", err)
	}

	return &pgxStore{pool: pool}, nil
}

// Close closes the underlying connection pool.
func (s *pgxStore) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

// ---------------------------------------------------------------------------
// Checkpoint methods
// ---------------------------------------------------------------------------

// GetCheckpoint retrieves the singleton checkpoint row.
// Returns nil, nil when no checkpoint exists yet (fresh database).
func (s *pgxStore) GetCheckpoint(ctx context.Context) (*models.Checkpoint, error) {
	query := `SELECT id, last_finalized_block, last_fetched_block, updated_at
	           FROM indexer_checkpoints WHERE id = 1`

	cp := &models.Checkpoint{}
	err := s.pool.QueryRow(ctx, query).Scan(
		&cp.ID, &cp.LastFinalizedBlock, &cp.LastFetchedBlock, &cp.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("store: get checkpoint: %w", err)
	}
	return cp, nil
}

// UpsertCheckpoint upserts the singleton checkpoint row.
func (s *pgxStore) UpsertCheckpoint(ctx context.Context, cp *models.Checkpoint) error {
	query := `INSERT INTO indexer_checkpoints (id, last_finalized_block, last_fetched_block, updated_at)
	           VALUES (1, $1, $2, NOW())
	           ON CONFLICT (id) DO UPDATE SET
	               last_finalized_block = $1,
	               last_fetched_block = $2,
	               updated_at = NOW()`
	_, err := s.pool.Exec(ctx, query, cp.LastFinalizedBlock, cp.LastFetchedBlock)
	if err != nil {
		return fmt.Errorf("store: upsert checkpoint: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Pet methods
// ---------------------------------------------------------------------------

const petColumns = `id, name, age, animal_type, caretaker_name, caretaker_phone,
	tx_hash, log_index, block_number, created_at`

// UpsertPet inserts or updates a pet row. Idempotent on (tx_hash, log_index).
func (s *pgxStore) UpsertPet(ctx context.Context, pet *models.Pet) error {
	query := `INSERT INTO pets (id, name, age, animal_type, caretaker_name,
	           caretaker_phone, tx_hash, log_index, block_number, created_at)
	           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
	           ON CONFLICT (tx_hash, log_index) DO UPDATE SET
	               name = EXCLUDED.name,
	               age = EXCLUDED.age,
	               animal_type = EXCLUDED.animal_type,
	               caretaker_name = EXCLUDED.caretaker_name,
	               caretaker_phone = EXCLUDED.caretaker_phone,
	               block_number = EXCLUDED.block_number`
	_, err := s.pool.Exec(ctx, query,
		pet.ID, pet.Name, pet.Age, pet.AnimalType, pet.CaretakerName,
		pet.CaretakerPhone, pet.TxHash, pet.LogIndex, pet.BlockNumber,
	)
	if err != nil {
		return fmt.Errorf("store: upsert pet: %w", err)
	}
	return nil
}

// scanPet scans a single pet row from a pgx.Row.
func scanPet(row pgx.Row) (*models.Pet, error) {
	pet := &models.Pet{}
	err := row.Scan(
		&pet.ID, &pet.Name, &pet.Age, &pet.AnimalType,
		&pet.CaretakerName, &pet.CaretakerPhone,
		&pet.TxHash, &pet.LogIndex, &pet.BlockNumber, &pet.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return pet, nil
}

// GetPet retrieves a single pet by its primary key (the on-chain ID).
func (s *pgxStore) GetPet(ctx context.Context, id uint64) (*models.Pet, error) {
	query := `SELECT ` + petColumns + ` FROM pets WHERE id = $1`
	pet, err := scanPet(s.pool.QueryRow(ctx, query, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("store: get pet %d: %w", id, err)
	}
	return pet, nil
}

// ListPets returns a paginated, filtered list of pets plus the total count
// matching the filter (without pagination).
func (s *pgxStore) ListPets(ctx context.Context, filter PetFilter) ([]*models.Pet, int, error) {
	page, limit := normalizePage(filter.Page, filter.Limit)
	where, args := buildPetWhere(filter)

	countQuery := `SELECT COUNT(*) FROM pets WHERE ` + where
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("store: count pets: %w", err)
	}

	dataQuery := fmt.Sprintf(`SELECT %s FROM pets WHERE %s ORDER BY id LIMIT $%d OFFSET $%d`,
		petColumns, where, len(args)+1, len(args)+2)
	args = append(args, limit, (page-1)*limit)

	rows, err := s.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("store: list pets: %w", err)
	}
	defer rows.Close()

	var pets []*models.Pet
	for rows.Next() {
		pet, err := scanPet(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("store: scan pet row: %w", err)
		}
		pets = append(pets, pet)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("store: list pets rows: %w", err)
	}
	return pets, total, nil
}

// buildPetWhere builds the WHERE clause and arguments for pet listing.
func buildPetWhere(filter PetFilter) (string, []interface{}) {
	var clauses []string
	var args []interface{}
	idx := 1

	if filter.Type != "" {
		clauses = append(clauses, fmt.Sprintf("animal_type = $%d", idx))
		args = append(args, filter.Type)
		idx++
	}
	if filter.Name != "" {
		clauses = append(clauses, fmt.Sprintf("name ILIKE $%d", idx))
		args = append(args, "%"+filter.Name+"%")
		idx++
	}

	if len(clauses) == 0 {
		return "TRUE", args
	}
	return strings.Join(clauses, " AND "), args
}

// ---------------------------------------------------------------------------
// Appointment methods
// ---------------------------------------------------------------------------

const apptColumns = `id, pet_id, date, time_str, appointment_value, paid_value,
	tx_hash, log_index, block_number, created_at`

// UpsertAppointment inserts or updates an appointment row.
// Idempotent on (tx_hash, log_index).
func (s *pgxStore) UpsertAppointment(ctx context.Context, appt *models.Appointment) error {
	query := `INSERT INTO appointments (id, pet_id, date, time_str,
	           appointment_value, paid_value, tx_hash, log_index, block_number, created_at)
	           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
	           ON CONFLICT (tx_hash, log_index) DO UPDATE SET
	               pet_id = EXCLUDED.pet_id,
	               date = EXCLUDED.date,
	               time_str = EXCLUDED.time_str,
	               appointment_value = EXCLUDED.appointment_value,
	               paid_value = EXCLUDED.paid_value,
	               block_number = EXCLUDED.block_number`
	_, err := s.pool.Exec(ctx, query,
		appt.ID, appt.PetID, appt.Date, appt.TimeStr,
		appt.AppointmentValue, appt.PaidValue,
		appt.TxHash, appt.LogIndex, appt.BlockNumber,
	)
	if err != nil {
		return fmt.Errorf("store: upsert appointment: %w", err)
	}
	return nil
}

// scanAppointment scans a single appointment row.
func scanAppointment(row pgx.Row) (*models.Appointment, error) {
	appt := &models.Appointment{}
	err := row.Scan(
		&appt.ID, &appt.PetID, &appt.Date, &appt.TimeStr,
		&appt.AppointmentValue, &appt.PaidValue,
		&appt.TxHash, &appt.LogIndex, &appt.BlockNumber, &appt.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return appt, nil
}

// GetAppointment retrieves a single appointment by its primary key.
func (s *pgxStore) GetAppointment(ctx context.Context, id uint64) (*models.Appointment, error) {
	query := `SELECT ` + apptColumns + ` FROM appointments WHERE id = $1`
	appt, err := scanAppointment(s.pool.QueryRow(ctx, query, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("store: get appointment %d: %w", id, err)
	}
	return appt, nil
}

// ListAppointments returns a paginated, filtered list of appointments plus
// the total count matching the filter (without pagination).
func (s *pgxStore) ListAppointments(ctx context.Context, filter AppointmentFilter) ([]*models.Appointment, int, error) {
	page, limit := normalizePage(filter.Page, filter.Limit)
	where, args := buildApptWhere(filter)

	countQuery := `SELECT COUNT(*) FROM appointments WHERE ` + where
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("store: count appointments: %w", err)
	}

	dataQuery := fmt.Sprintf(`SELECT %s FROM appointments WHERE %s ORDER BY pet_id, date DESC LIMIT $%d OFFSET $%d`,
		apptColumns, where, len(args)+1, len(args)+2)
	args = append(args, limit, (page-1)*limit)

	rows, err := s.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("store: list appointments: %w", err)
	}
	defer rows.Close()

	var appts []*models.Appointment
	for rows.Next() {
		appt, err := scanAppointment(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("store: scan appointment row: %w", err)
		}
		appts = append(appts, appt)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("store: list appointments rows: %w", err)
	}
	return appts, total, nil
}

// buildApptWhere builds the WHERE clause and arguments for appointment listing.
func buildApptWhere(filter AppointmentFilter) (string, []interface{}) {
	var clauses []string
	var args []interface{}
	idx := 1

	if filter.PetID != nil {
		clauses = append(clauses, fmt.Sprintf("pet_id = $%d", idx))
		args = append(args, *filter.PetID)
		idx++
	}
	if filter.From != nil {
		clauses = append(clauses, fmt.Sprintf("date >= $%d", idx))
		args = append(args, *filter.From)
		idx++
	}
	if filter.To != nil {
		clauses = append(clauses, fmt.Sprintf("date <= $%d", idx))
		args = append(args, *filter.To)
		idx++
	}
	if filter.Paid != nil {
		if *filter.Paid {
			clauses = append(clauses, fmt.Sprintf("paid_value > 0"))
		} else {
			clauses = append(clauses, fmt.Sprintf("paid_value = 0"))
		}
		// Note: paid clause uses no args, so idx doesn't advance
	}

	if len(clauses) == 0 {
		return "TRUE", args
	}
	return strings.Join(clauses, " AND "), args
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

// GetStats returns aggregate statistics across pets and appointments.
func (s *pgxStore) GetStats(ctx context.Context) (*Stats, error) {
	query := `SELECT
		(SELECT COUNT(*) FROM pets) AS total_pets,
		(SELECT COUNT(*) FROM appointments) AS total_appointments,
		(SELECT COUNT(*) FROM appointments WHERE paid_value > 0) AS total_paid_appointments,
		COALESCE((SELECT SUM(paid_value) FROM appointments), 0) AS total_revenue_cents`

	stats := &Stats{}
	err := s.pool.QueryRow(ctx, query).Scan(
		&stats.TotalPets,
		&stats.TotalAppointments,
		&stats.TotalPaidAppointments,
		&stats.TotalRevenueCents,
	)
	if err != nil {
		return nil, fmt.Errorf("store: get stats: %w", err)
	}
	return stats, nil
}

// ---------------------------------------------------------------------------
// Reorg
// ---------------------------------------------------------------------------

// DeleteEventsAfterBlock deletes all appointments and pets whose block_number
// is strictly greater than the given block. Appointments are deleted first to
// respect the foreign key constraint. Returns the total number of rows deleted.
func (s *pgxStore) DeleteEventsAfterBlock(ctx context.Context, blockNumber uint64) (int64, error) {
	var total int64

	res, err := s.pool.Exec(ctx, `DELETE FROM appointments WHERE block_number > $1`, blockNumber)
	if err != nil {
		return 0, fmt.Errorf("store: delete appointments after block %d: %w", blockNumber, err)
	}
	total += res.RowsAffected()

	res, err = s.pool.Exec(ctx, `DELETE FROM pets WHERE block_number > $1`, blockNumber)
	if err != nil {
		return 0, fmt.Errorf("store: delete pets after block %d: %w", blockNumber, err)
	}
	total += res.RowsAffected()

	return total, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// normalizePage returns sanitized page and limit values.
// Page is 1-based; minimum 1. Limit defaults to 20, max 100.
func normalizePage(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	switch {
	case limit <= 0:
		limit = 20
	case limit > 100:
		limit = 100
	}
	return page, limit
}

// Ensure pgxStore satisfies Store at compile time.
var _ Store = (*pgxStore)(nil)
