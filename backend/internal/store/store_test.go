package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"vet-57b/backend/internal/models"
)

// setupTestStore creates a new Store connected to the real database using
// the DATABASE_URL environment variable. It creates the required tables
// before each test and drops them on cleanup. Skips when DATABASE_URL is
// unset or when testing.Short() is active.
func setupTestStore(t *testing.T) (Store, func()) {
	t.Helper()

	if testing.Short() {
		t.Skip("store: skipping integration test in short mode")
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("store: DATABASE_URL not set, skipping integration test")
	}

	ctx := context.Background()

	s, err := New(ctx, dsn, 2, 1)
	if err != nil {
		t.Fatalf("store.New(): %v", err)
	}

	// Create tables within a transaction so we can roll back on cleanup.
	tx, err := s.(*pgxStore).pool.Begin(ctx)
	if err != nil {
		s.Close()
		t.Fatalf("begin tx: %v", err)
	}

	ddl := `
	CREATE TABLE IF NOT EXISTS pets (
		id BIGINT PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		age SMALLINT NOT NULL,
		animal_type VARCHAR(10) NOT NULL CHECK (animal_type IN ('Dog', 'Cat')),
		caretaker_name VARCHAR(255) NOT NULL,
		caretaker_phone VARCHAR(50) NOT NULL,
		tx_hash BYTEA NOT NULL,
		log_index INTEGER NOT NULL,
		block_number BIGINT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE(tx_hash, log_index)
	);
	CREATE TABLE IF NOT EXISTS appointments (
		id BIGINT PRIMARY KEY,
		pet_id BIGINT NOT NULL REFERENCES pets(id),
		date BIGINT NOT NULL,
		time_str VARCHAR(20) NOT NULL,
		appointment_value NUMERIC(78,0) NOT NULL,
		paid_value NUMERIC(78,0) NOT NULL DEFAULT 0,
		tx_hash BYTEA NOT NULL,
		log_index INTEGER NOT NULL,
		block_number BIGINT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE(tx_hash, log_index)
	);
	CREATE TABLE IF NOT EXISTS indexer_checkpoints (
		id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
		last_finalized_block BIGINT NOT NULL DEFAULT 0,
		last_fetched_block BIGINT NOT NULL DEFAULT 0,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);`

	for _, stmt := range []string{ddl} {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			tx.Rollback(ctx)
			s.Close()
			t.Fatalf("create tables: %v", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		s.Close()
		t.Fatalf("commit tables: %v", err)
	}

	cleanup := func() {
		// Drop tables in reverse dependency order.
		s.(*pgxStore).pool.Exec(ctx, `DROP TABLE IF EXISTS appointments CASCADE`)
		s.(*pgxStore).pool.Exec(ctx, `DROP TABLE IF EXISTS pets CASCADE`)
		s.(*pgxStore).pool.Exec(ctx, `DROP TABLE IF EXISTS indexer_checkpoints CASCADE`)
		s.Close()
	}

	return s, cleanup
}

func TestStore_UpsertPetIdempotency(t *testing.T) {
	s, cleanup := setupTestStore(t)
	defer cleanup()

	ctx := context.Background()

	pet := &models.Pet{
		ID:             1,
		Name:           "Buddy",
		Age:            3,
		AnimalType:     "Dog",
		CaretakerName:  "Alice",
		CaretakerPhone: "555-0100",
		TxHash:         []byte{0x01, 0x02, 0x03},
		LogIndex:       0,
		BlockNumber:    100,
	}

	// First insert.
	if err := s.UpsertPet(ctx, pet); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	// Update fields and upsert again with same (tx_hash, log_index).
	pet.Name = "Buddy Updated"
	pet.Age = 4
	if err := s.UpsertPet(ctx, pet); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	// Verify only one row exists.
	got, err := s.GetPet(ctx, 1)
	if err != nil {
		t.Fatalf("get pet: %v", err)
	}
	if got == nil {
		t.Fatal("pet not found after upsert")
	}
	if got.Name != "Buddy Updated" {
		t.Errorf("pet name = %q, want %q", got.Name, "Buddy Updated")
	}
	if got.Age != 4 {
		t.Errorf("pet age = %d, want %d", got.Age, 4)
	}

	// Verify total count is 1.
	pets, total, err := s.ListPets(ctx, PetFilter{Limit: 10})
	if err != nil {
		t.Fatalf("list pets: %v", err)
	}
	if total != 1 {
		t.Errorf("total pets = %d, want 1", total)
	}
	if len(pets) != 1 {
		t.Errorf("len(pets) = %d, want 1", len(pets))
	}
}

func TestStore_CheckpointSingleton(t *testing.T) {
	s, cleanup := setupTestStore(t)
	defer cleanup()

	ctx := context.Background()

	// Initially no checkpoint.
	cp, err := s.GetCheckpoint(ctx)
	if err != nil {
		t.Fatalf("get checkpoint (empty): %v", err)
	}
	if cp != nil {
		t.Fatal("expected nil checkpoint on fresh tables")
	}

	// Insert first checkpoint.
	cp1 := &models.Checkpoint{
		LastFinalizedBlock: 100,
		LastFetchedBlock:   200,
	}
	if err := s.UpsertCheckpoint(ctx, cp1); err != nil {
		t.Fatalf("first upsert checkpoint: %v", err)
	}

	// Upsert with new values.
	cp2 := &models.Checkpoint{
		LastFinalizedBlock: 300,
		LastFetchedBlock:   400,
	}
	if err := s.UpsertCheckpoint(ctx, cp2); err != nil {
		t.Fatalf("second upsert checkpoint: %v", err)
	}

	// Verify only one row remains with latest values.
	got, err := s.GetCheckpoint(ctx)
	if err != nil {
		t.Fatalf("get checkpoint: %v", err)
	}
	if got == nil {
		t.Fatal("expected checkpoint, got nil")
	}
	if got.LastFinalizedBlock != 300 {
		t.Errorf("last_finalized_block = %d, want 300", got.LastFinalizedBlock)
	}
	if got.LastFetchedBlock != 400 {
		t.Errorf("last_fetched_block = %d, want 400", got.LastFetchedBlock)
	}
	if got.ID != 1 {
		t.Errorf("checkpoint id = %d, want 1", got.ID)
	}

	// Ensure the updated_at was set (not zero time).
	if got.UpdatedAt.IsZero() {
		t.Error("updated_at is zero, expected a timestamp")
	}

	// Verify that we can't insert a second row with different id (CHECK constraint).
	_, err = s.(*pgxStore).pool.Exec(ctx,
		`INSERT INTO indexer_checkpoints (id) VALUES (2)`)
	if err == nil {
		t.Error("expected error inserting checkpoint with id=2, got nil")
	}
}

func TestStore_ListPetsFilters(t *testing.T) {
	s, cleanup := setupTestStore(t)
	defer cleanup()

	ctx := context.Background()

	// Seed pets of both types.
	pets := []*models.Pet{
		{ID: 1, Name: "Buddy", Age: 3, AnimalType: "Dog", CaretakerName: "Alice", CaretakerPhone: "555-0100", TxHash: []byte{0x01}, LogIndex: 0, BlockNumber: 100},
		{ID: 2, Name: "Whiskers", Age: 2, AnimalType: "Cat", CaretakerName: "Bob", CaretakerPhone: "555-0101", TxHash: []byte{0x02}, LogIndex: 0, BlockNumber: 101},
		{ID: 3, Name: "Max", Age: 5, AnimalType: "Dog", CaretakerName: "Charlie", CaretakerPhone: "555-0102", TxHash: []byte{0x03}, LogIndex: 0, BlockNumber: 102},
	}
	for _, p := range pets {
		if err := s.UpsertPet(ctx, p); err != nil {
			t.Fatalf("seed pet %d: %v", p.ID, err)
		}
	}

	t.Run("filter by type Dog", func(t *testing.T) {
		result, total, err := s.ListPets(ctx, PetFilter{Type: "Dog", Limit: 10})
		if err != nil {
			t.Fatalf("ListPets: %v", err)
		}
		if total != 2 {
			t.Errorf("total = %d, want 2", total)
		}
		if len(result) != 2 {
			t.Fatalf("len = %d, want 2", len(result))
		}
	})

	t.Run("filter by name substring", func(t *testing.T) {
		result, total, err := s.ListPets(ctx, PetFilter{Name: "bud", Limit: 10})
		if err != nil {
			t.Fatalf("ListPets: %v", err)
		}
		if total != 1 {
			t.Errorf("total = %d, want 1", total)
		}
		if len(result) != 1 || result[0].ID != 1 {
			t.Errorf("expected pet ID 1, got %v", result)
		}
	})

	t.Run("pagination returns correct subset", func(t *testing.T) {
		// Page 1, limit 2 → should return 2 pets.
		result, total, err := s.ListPets(ctx, PetFilter{Limit: 2, Page: 1})
		if err != nil {
			t.Fatalf("ListPets: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		if len(result) != 2 {
			t.Errorf("len = %d, want 2", len(result))
		}

		// Page 2, limit 2 → should return 1 pet.
		result, total, err = s.ListPets(ctx, PetFilter{Limit: 2, Page: 2})
		if err != nil {
			t.Fatalf("ListPets: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		if len(result) != 1 {
			t.Errorf("len = %d, want 1", len(result))
		}
	})
}

func TestStore_GetPetNotFound(t *testing.T) {
	s, cleanup := setupTestStore(t)
	defer cleanup()

	ctx := context.Background()
	pet, err := s.GetPet(ctx, 9999)
	if err != nil {
		t.Fatalf("GetPet(9999): %v", err)
	}
	if pet != nil {
		t.Fatal("expected nil for nonexistent pet")
	}
}

func TestStore_UpsertAppointmentAndGetStats(t *testing.T) {
	s, cleanup := setupTestStore(t)
	defer cleanup()

	ctx := context.Background()

	// Seed a pet first (FK constraint).
	pet := &models.Pet{
		ID: 1, Name: "Buddy", Age: 3, AnimalType: "Dog",
		CaretakerName: "Alice", CaretakerPhone: "555-0100",
		TxHash: []byte{0x01}, LogIndex: 0, BlockNumber: 100,
	}
	if err := s.UpsertPet(ctx, pet); err != nil {
		t.Fatalf("seed pet: %v", err)
	}

	// Insert two appointments, one with payment.
	appt1 := &models.Appointment{
		ID: 1, PetID: 1, Date: time.Now().Unix(), TimeStr: "10:00",
		AppointmentValue: "5000", PaidValue: "0",
		TxHash: []byte{0xaa}, LogIndex: 0, BlockNumber: 200,
	}
	appt2 := &models.Appointment{
		ID: 2, PetID: 1, Date: time.Now().Unix(), TimeStr: "14:00",
		AppointmentValue: "7500", PaidValue: "7500",
		TxHash: []byte{0xbb}, LogIndex: 0, BlockNumber: 201,
	}

	if err := s.UpsertAppointment(ctx, appt1); err != nil {
		t.Fatalf("upsert appt1: %v", err)
	}
	if err := s.UpsertAppointment(ctx, appt2); err != nil {
		t.Fatalf("upsert appt2: %v", err)
	}

	// Verify get by id.
	got, err := s.GetAppointment(ctx, 1)
	if err != nil {
		t.Fatalf("GetAppointment(1): %v", err)
	}
	if got == nil || got.ID != 1 {
		t.Fatal("appointment 1 not found")
	}
	if got.AppointmentValue != "5000" {
		t.Errorf("AppointmentValue = %q, want %q", got.AppointmentValue, "5000")
	}

	// Upsert idempotency: same (tx_hash, log_index) updates.
	appt1.PaidValue = "2500"
	if err := s.UpsertAppointment(ctx, appt1); err != nil {
		t.Fatalf("re-upsert appt1: %v", err)
	}
	got, err = s.GetAppointment(ctx, 1)
	if err != nil {
		t.Fatalf("GetAppointment(1) after update: %v", err)
	}
	if got.PaidValue != "2500" {
		t.Errorf("PaidValue after update = %q, want %q", got.PaidValue, "2500")
	}

	// Test stats.
	stats, err := s.GetStats(ctx)
	if err != nil {
		t.Fatalf("GetStats: %v", err)
	}
	if stats.TotalPets != 1 {
		t.Errorf("TotalPets = %d, want 1", stats.TotalPets)
	}
	if stats.TotalAppointments != 2 {
		t.Errorf("TotalAppointments = %d, want 2", stats.TotalAppointments)
	}
	if stats.TotalPaidAppointments != 1 {
		t.Errorf("TotalPaidAppointments = %d, want 1", stats.TotalPaidAppointments)
	}
	// Revenue = 7500 + 2500 = 10000
	if stats.TotalRevenueCents != "10000" {
		t.Errorf("TotalRevenueCents = %q, want %q", stats.TotalRevenueCents, "10000")
	}
}

func TestStore_ListAppointmentsFilters(t *testing.T) {
	s, cleanup := setupTestStore(t)
	defer cleanup()

	ctx := context.Background()

	// Seed pet.
	pet := &models.Pet{
		ID: 1, Name: "Buddy", Age: 3, AnimalType: "Dog",
		CaretakerName: "Alice", CaretakerPhone: "555-0100",
		TxHash: []byte{0x01}, LogIndex: 0, BlockNumber: 100,
	}
	if err := s.UpsertPet(ctx, pet); err != nil {
		t.Fatalf("seed pet: %v", err)
	}

	appts := []*models.Appointment{
		{ID: 1, PetID: 1, Date: 1000, TimeStr: "10:00", AppointmentValue: "5000", PaidValue: "0", TxHash: []byte{0xaa}, LogIndex: 0, BlockNumber: 200},
		{ID: 2, PetID: 1, Date: 2000, TimeStr: "14:00", AppointmentValue: "7500", PaidValue: "7500", TxHash: []byte{0xbb}, LogIndex: 0, BlockNumber: 201},
		{ID: 3, PetID: 1, Date: 3000, TimeStr: "09:00", AppointmentValue: "3000", PaidValue: "0", TxHash: []byte{0xcc}, LogIndex: 0, BlockNumber: 202},
	}
	for _, a := range appts {
		if err := s.UpsertAppointment(ctx, a); err != nil {
			t.Fatalf("seed appt %d: %v", a.ID, err)
		}
	}

	t.Run("filter by paid", func(t *testing.T) {
		paid := true
		result, total, err := s.ListAppointments(ctx, AppointmentFilter{Paid: &paid, Limit: 10})
		if err != nil {
			t.Fatalf("ListAppointments paid: %v", err)
		}
		if total != 1 {
			t.Errorf("total paid = %d, want 1", total)
		}
		if len(result) != 1 || result[0].ID != 2 {
			t.Errorf("expected appt ID 2, got %v", result)
		}
	})

	t.Run("filter by unpaid", func(t *testing.T) {
		paid := false
		result, total, err := s.ListAppointments(ctx, AppointmentFilter{Paid: &paid, Limit: 10})
		if err != nil {
			t.Fatalf("ListAppointments unpaid: %v", err)
		}
		if total != 2 {
			t.Errorf("total unpaid = %d, want 2", total)
		}
		if len(result) != 2 {
			t.Errorf("len = %d, want 2", len(result))
		}
	})

	t.Run("filter by date range", func(t *testing.T) {
		from := int64(1500)
		to := int64(2500)
		result, total, err := s.ListAppointments(ctx, AppointmentFilter{From: &from, To: &to, Limit: 10})
		if err != nil {
			t.Fatalf("ListAppointments date range: %v", err)
		}
		if total != 1 {
			t.Errorf("total = %d, want 1", total)
		}
		if len(result) != 1 || result[0].ID != 2 {
			t.Errorf("expected appt ID 2, got %v", result)
		}
	})

	t.Run("filter by pet ID", func(t *testing.T) {
		petID := uint64(1)
		result, total, err := s.ListAppointments(ctx, AppointmentFilter{PetID: &petID, Limit: 10})
		if err != nil {
			t.Fatalf("ListAppointments by pet: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		if len(result) != 3 {
			t.Errorf("len = %d, want 3", len(result))
		}
	})

	t.Run("no results for wrong pet", func(t *testing.T) {
		petID := uint64(999)
		result, total, err := s.ListAppointments(ctx, AppointmentFilter{PetID: &petID, Limit: 10})
		if err != nil {
			t.Fatalf("ListAppointments wrong pet: %v", err)
		}
		if total != 0 {
			t.Errorf("total = %d, want 0", total)
		}
		if len(result) != 0 {
			t.Errorf("len = %d, want 0", len(result))
		}
	})
}

func TestStore_DeleteEventsAfterBlock(t *testing.T) {
	s, cleanup := setupTestStore(t)
	defer cleanup()

	ctx := context.Background()

	// Seed a pet.
	pet := &models.Pet{
		ID: 1, Name: "Buddy", Age: 3, AnimalType: "Dog",
		CaretakerName: "Alice", CaretakerPhone: "555-0100",
		TxHash: []byte{0x01}, LogIndex: 0, BlockNumber: 100,
	}
	if err := s.UpsertPet(ctx, pet); err != nil {
		t.Fatalf("seed pet: %v", err)
	}

	// Seed appointments at different blocks.
	for i := uint64(1); i <= 5; i++ {
		appt := &models.Appointment{
			ID: i, PetID: 1, Date: int64(1000+i), TimeStr: fmt.Sprintf("10:%02d", i),
			AppointmentValue: "1000", PaidValue: "0",
			TxHash: []byte{0xaa, byte(i)}, LogIndex: 0, BlockNumber: 100 + i,
		}
		if err := s.UpsertAppointment(ctx, appt); err != nil {
			t.Fatalf("seed appt %d: %v", i, err)
		}
	}

	// Delete events after block 102 (should delete 3 appointments: 103, 104, 105).
	deleted, err := s.DeleteEventsAfterBlock(ctx, 102)
	if err != nil {
		t.Fatalf("DeleteEventsAfterBlock: %v", err)
	}
	if deleted != 3 {
		t.Errorf("deleted = %d, want 3", deleted)
	}

	// Verify appointments 1 and 2 (blocks 101, 102) still exist.
	for _, id := range []uint64{1, 2} {
		a, err := s.GetAppointment(ctx, id)
		if err != nil {
			t.Fatalf("GetAppointment(%d): %v", id, err)
		}
		if a == nil {
			t.Errorf("appointment %d should exist", id)
		}
	}

	// Verify appointments 3,4,5 are gone.
	for _, id := range []uint64{3, 4, 5} {
		a, err := s.GetAppointment(ctx, id)
		if err != nil {
			t.Fatalf("GetAppointment(%d): %v", id, err)
		}
		if a != nil {
			t.Errorf("appointment %d should have been deleted", id)
		}
	}
}

func TestStore_NewFailsOnBadDSN(t *testing.T) {
	ctx := context.Background()
	_, err := New(ctx, "not-a-valid-dsn", 1, 1)
	if err == nil {
		t.Error("expected error for invalid DSN, got nil")
	}
}
