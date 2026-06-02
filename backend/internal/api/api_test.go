package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"vet-57b/backend/internal/config"
	"vet-57b/backend/internal/models"
	"vet-57b/backend/internal/store"
)

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

// mockStore implements store.Store with configurable function fields for testing.
type mockStore struct {
	store.Store // embed so only methods used in tests need to be overridden

	getCheckpointFn func(ctx context.Context) (*models.Checkpoint, error)
	listPetsFn      func(ctx context.Context, filter store.PetFilter) ([]*models.Pet, int, error)
	getPetFn        func(ctx context.Context, id uint64) (*models.Pet, error)
	listApptsFn     func(ctx context.Context, filter store.AppointmentFilter) ([]*models.Appointment, int, error)
	getApptFn       func(ctx context.Context, id uint64) (*models.Appointment, error)
	getStatsFn      func(ctx context.Context) (*store.Stats, error)
}

func (m *mockStore) GetCheckpoint(ctx context.Context) (*models.Checkpoint, error) {
	if m.getCheckpointFn != nil {
		return m.getCheckpointFn(ctx)
	}
	return &models.Checkpoint{LastFinalizedBlock: 42}, nil
}

func (m *mockStore) ListPets(ctx context.Context, filter store.PetFilter) ([]*models.Pet, int, error) {
	if m.listPetsFn != nil {
		return m.listPetsFn(ctx, filter)
	}
	return []*models.Pet{}, 0, nil
}

func (m *mockStore) GetPet(ctx context.Context, id uint64) (*models.Pet, error) {
	if m.getPetFn != nil {
		return m.getPetFn(ctx, id)
	}
	return nil, nil
}

func (m *mockStore) ListAppointments(ctx context.Context, filter store.AppointmentFilter) ([]*models.Appointment, int, error) {
	if m.listApptsFn != nil {
		return m.listApptsFn(ctx, filter)
	}
	return []*models.Appointment{}, 0, nil
}

func (m *mockStore) GetAppointment(ctx context.Context, id uint64) (*models.Appointment, error) {
	if m.getApptFn != nil {
		return m.getApptFn(ctx, id)
	}
	return nil, nil
}

func (m *mockStore) GetStats(ctx context.Context) (*store.Stats, error) {
	if m.getStatsFn != nil {
		return m.getStatsFn(ctx)
	}
	return &store.Stats{TotalPets: 10, TotalAppointments: 25, TotalPaidAppointments: 15, TotalRevenueCents: "500000"}, nil
}

func (m *mockStore) Close() {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// testConfig returns a minimal config suitable for API tests.
func testConfig() *config.Config {
	return &config.Config{
		Port:       "8080",
		CorsOrigin: "http://localhost:5173",
	}
}

// newTestRouter creates a router with the given mock store for testing.
func newTestRouter(ms *mockStore) http.Handler {
	return NewRouter(testConfig(), ms)
}

// decodeResponse decodes the JSON body into the given target value.
func decodeResponse(t *testing.T, r *http.Response, v any) {
	t.Helper()
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Tests: GET /api/v1/health
// ---------------------------------------------------------------------------

func TestHealth_OK(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp map[string]any
	decodeResponse(t, rec.Result(), &resp)

	if resp["status"] != "ok" {
		t.Errorf("status = %v, want ok", resp["status"])
	}
	if resp["db"] != "connected" {
		t.Errorf("db = %v, want connected", resp["db"])
	}
	if resp["lastIndexedBlock"] != float64(42) {
		t.Errorf("lastIndexedBlock = %v, want 42", resp["lastIndexedBlock"])
	}
}

func TestHealth_DB_Down(t *testing.T) {
	ms := &mockStore{
		getCheckpointFn: func(ctx context.Context) (*models.Checkpoint, error) {
			return nil, assertAnError("connection refused")
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rec.Code)
	}

	var resp map[string]string
	decodeResponse(t, rec.Result(), &resp)

	if resp["status"] != "degraded" {
		t.Errorf("status = %v, want degraded", resp["status"])
	}
	if resp["db"] != "disconnected" {
		t.Errorf("db = %v, want disconnected", resp["db"])
	}
}

func TestHealth_NilCheckpoint(t *testing.T) {
	ms := &mockStore{
		getCheckpointFn: func(ctx context.Context) (*models.Checkpoint, error) {
			return nil, nil // fresh database
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp map[string]any
	decodeResponse(t, rec.Result(), &resp)

	if resp["lastIndexedBlock"] != float64(0) {
		t.Errorf("lastIndexedBlock = %v, want 0", resp["lastIndexedBlock"])
	}
}

// ---------------------------------------------------------------------------
// Tests: GET /api/v1/pets
// ---------------------------------------------------------------------------

func TestListPets_Empty(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp struct {
		Data  []any `json:"data"`
		Total int   `json:"total"`
		Page  int   `json:"page"`
		Limit int   `json:"limit"`
	}
	decodeResponse(t, rec.Result(), &resp)

	if len(resp.Data) != 0 {
		t.Errorf("expected empty data, got %d items", len(resp.Data))
	}
	if resp.Page != 1 {
		t.Errorf("page = %d, want 1", resp.Page)
	}
	if resp.Limit != 20 {
		t.Errorf("limit = %d, want 20", resp.Limit)
	}
}

func TestListPets_WithFilter(t *testing.T) {
	ms := &mockStore{
		listPetsFn: func(ctx context.Context, filter store.PetFilter) ([]*models.Pet, int, error) {
			if filter.Type != "Dog" {
				t.Errorf("filter.Type = %q, want Dog", filter.Type)
			}
			if filter.Page != 1 {
				t.Errorf("filter.Page = %d, want 1", filter.Page)
			}
			if filter.Limit != 10 {
				t.Errorf("filter.Limit = %d, want 10", filter.Limit)
			}
			return []*models.Pet{
				{ID: 1, Name: "Buddy", AnimalType: "Dog", Age: 3},
			}, 1, nil
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets?type=Dog&page=1&limit=10", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp struct {
		Data  []models.Pet `json:"data"`
		Total int          `json:"total"`
		Page  int          `json:"page"`
		Limit int          `json:"limit"`
	}
	decodeResponse(t, rec.Result(), &resp)

	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 pet, got %d", len(resp.Data))
	}
	if resp.Data[0].Name != "Buddy" {
		t.Errorf("pet.Name = %q, want Buddy", resp.Data[0].Name)
	}
	if resp.Total != 1 {
		t.Errorf("total = %d, want 1", resp.Total)
	}
}

func TestListPets_StoreError(t *testing.T) {
	ms := &mockStore{
		listPetsFn: func(ctx context.Context, filter store.PetFilter) ([]*models.Pet, int, error) {
			return nil, 0, assertAnError("db error")
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}

	var errResp errorResponse
	decodeResponse(t, rec.Result(), &errResp)
	if errResp.Code != "INTERNAL" {
		t.Errorf("code = %q, want INTERNAL", errResp.Code)
	}
}

func TestListPets_PaginationDefaults(t *testing.T) {
	ms := &mockStore{
		listPetsFn: func(ctx context.Context, filter store.PetFilter) ([]*models.Pet, int, error) {
			if filter.Page != 1 {
				t.Errorf("expected page=1, got %d", filter.Page)
			}
			if filter.Limit != 20 {
				t.Errorf("expected limit=20, got %d", filter.Limit)
			}
			return []*models.Pet{}, 0, nil
		},
	}
	router := newTestRouter(ms)

	// No page/limit params → defaults
	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
}

// ---------------------------------------------------------------------------
// Tests: GET /api/v1/pets/{id}
// ---------------------------------------------------------------------------

func TestGetPet_Found(t *testing.T) {
	ms := &mockStore{
		getPetFn: func(ctx context.Context, id uint64) (*models.Pet, error) {
			return &models.Pet{ID: id, Name: "Buddy", AnimalType: "Dog", Age: 3}, nil
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets/1", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var pet models.Pet
	decodeResponse(t, rec.Result(), &pet)

	if pet.ID != 1 {
		t.Errorf("pet.ID = %d, want 1", pet.ID)
	}
	if pet.Name != "Buddy" {
		t.Errorf("pet.Name = %q, want Buddy", pet.Name)
	}
}

func TestGetPet_NotFound(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets/99", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}

	var errResp errorResponse
	decodeResponse(t, rec.Result(), &errResp)
	if errResp.Code != "NOT_FOUND" {
		t.Errorf("code = %q, want NOT_FOUND", errResp.Code)
	}
}

func TestGetPet_BadID(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets/abc", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}

	var errResp errorResponse
	decodeResponse(t, rec.Result(), &errResp)
	if errResp.Code != "INVALID_PARAM" {
		t.Errorf("code = %q, want INVALID_PARAM", errResp.Code)
	}
}

func TestGetPet_StoreError(t *testing.T) {
	ms := &mockStore{
		getPetFn: func(ctx context.Context, id uint64) (*models.Pet, error) {
			return nil, assertAnError("connection failed")
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets/1", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: GET /api/v1/pets/{id}/appointments
// ---------------------------------------------------------------------------

func TestListPetAppointments_Success(t *testing.T) {
	ms := &mockStore{
		getPetFn: func(ctx context.Context, id uint64) (*models.Pet, error) {
			return &models.Pet{ID: id, Name: "Buddy"}, nil
		},
		listApptsFn: func(ctx context.Context, filter store.AppointmentFilter) ([]*models.Appointment, int, error) {
			if filter.PetID == nil || *filter.PetID != 1 {
				t.Errorf("expected PetID=1")
			}
			return []*models.Appointment{
				{ID: 10, PetID: 1, Date: 1700000000, TimeStr: "14:30"},
			}, 1, nil
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets/1/appointments", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp struct {
		Data  []models.Appointment `json:"data"`
		Total int                  `json:"total"`
	}
	decodeResponse(t, rec.Result(), &resp)

	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 appointment, got %d", len(resp.Data))
	}
	if resp.Data[0].ID != 10 {
		t.Errorf("appt.ID = %d, want 10", resp.Data[0].ID)
	}
}

func TestListPetAppointments_PetNotFound(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets/99/appointments", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}

	var errResp errorResponse
	decodeResponse(t, rec.Result(), &errResp)
	if errResp.Code != "NOT_FOUND" {
		t.Errorf("code = %q, want NOT_FOUND", errResp.Code)
	}
}

func TestListPetAppointments_BadPetID(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets/abc/appointments", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: GET /api/v1/appointments
// ---------------------------------------------------------------------------

func TestListAppointments_Empty(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp struct {
		Data  []any `json:"data"`
		Total int   `json:"total"`
	}
	decodeResponse(t, rec.Result(), &resp)

	if len(resp.Data) != 0 {
		t.Errorf("expected empty data, got %d items", len(resp.Data))
	}
}

func TestListAppointments_WithFilters(t *testing.T) {
	ms := &mockStore{
		listApptsFn: func(ctx context.Context, filter store.AppointmentFilter) ([]*models.Appointment, int, error) {
			if filter.PetID == nil || *filter.PetID != 2 {
				t.Errorf("expected PetID=2")
			}
			if filter.From == nil || *filter.From != 1000000 {
				t.Errorf("expected From=1000000")
			}
			if filter.To == nil || *filter.To != 2000000 {
				t.Errorf("expected To=2000000")
			}
			if filter.Paid == nil || !*filter.Paid {
				t.Errorf("expected Paid=true")
			}
			return []*models.Appointment{
				{ID: 20, PetID: 2, Date: 1500000},
			}, 1, nil
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/appointments?petId=2&from=1000000&to=2000000&paid=true",
		nil,
	)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp struct {
		Data  []models.Appointment `json:"data"`
		Total int                  `json:"total"`
	}
	decodeResponse(t, rec.Result(), &resp)

	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 appointment, got %d", len(resp.Data))
	}
	if resp.Data[0].ID != 20 {
		t.Errorf("appt.ID = %d, want 20", resp.Data[0].ID)
	}
}

func TestListAppointments_InvalidPaid(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments?paid=maybe", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestListAppointments_InvalidPetID(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments?petId=abc", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestListAppointments_InvalidFrom(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments?from=abc", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestListAppointments_StoreError(t *testing.T) {
	ms := &mockStore{
		listApptsFn: func(ctx context.Context, filter store.AppointmentFilter) ([]*models.Appointment, int, error) {
			return nil, 0, assertAnError("db error")
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: GET /api/v1/appointments/{id}
// ---------------------------------------------------------------------------

func TestGetAppointment_Found(t *testing.T) {
	ms := &mockStore{
		getApptFn: func(ctx context.Context, id uint64) (*models.Appointment, error) {
			return &models.Appointment{ID: id, PetID: 1, Date: 1700000000}, nil
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments/5", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var appt models.Appointment
	decodeResponse(t, rec.Result(), &appt)

	if appt.ID != 5 {
		t.Errorf("appt.ID = %d, want 5", appt.ID)
	}
}

func TestGetAppointment_NotFound(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments/99", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestGetAppointment_BadID(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments/xyz", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestGetAppointment_StoreError(t *testing.T) {
	ms := &mockStore{
		getApptFn: func(ctx context.Context, id uint64) (*models.Appointment, error) {
			return nil, assertAnError("connection failed")
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/appointments/1", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: GET /api/v1/stats/totals
// ---------------------------------------------------------------------------

func TestGetStats_OK(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/stats/totals", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var stats store.Stats
	decodeResponse(t, rec.Result(), &stats)

	if stats.TotalPets != 10 {
		t.Errorf("TotalPets = %d, want 10", stats.TotalPets)
	}
	if stats.TotalAppointments != 25 {
		t.Errorf("TotalAppointments = %d, want 25", stats.TotalAppointments)
	}
	if stats.TotalPaidAppointments != 15 {
		t.Errorf("TotalPaidAppointments = %d, want 15", stats.TotalPaidAppointments)
	}
	if stats.TotalRevenueCents != "500000" {
		t.Errorf("TotalRevenueCents = %q, want 500000", stats.TotalRevenueCents)
	}
}

func TestGetStats_StoreError(t *testing.T) {
	ms := &mockStore{
		getStatsFn: func(ctx context.Context) (*store.Stats, error) {
			return nil, assertAnError("db error")
		},
	}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/stats/totals", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Tests: CORS
// ---------------------------------------------------------------------------

func TestCORS_Preflight(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/pets", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// CORS middleware should respond with 200 for preflight
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for OPTIONS, got %d", rec.Code)
	}

	origin := rec.Header().Get("Access-Control-Allow-Origin")
	if origin != "http://localhost:5173" {
		t.Errorf("Access-Control-Allow-Origin = %q, want http://localhost:5173", origin)
	}

	methods := rec.Header().Get("Access-Control-Allow-Methods")
	if methods == "" {
		t.Error("Access-Control-Allow-Methods is empty")
	}
}

func TestCORS_RegularRequestHasOrigin(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/pets", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	origin := rec.Header().Get("Access-Control-Allow-Origin")
	if origin != "http://localhost:5173" {
		t.Errorf("Access-Control-Allow-Origin = %q, want http://localhost:5173", origin)
	}
}

// ---------------------------------------------------------------------------
// Tests: 404 for unknown routes
// ---------------------------------------------------------------------------

func TestUnknownRoute_Returns404(t *testing.T) {
	ms := &mockStore{}
	router := newTestRouter(ms)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/nonexistent", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown route, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Test: pagination defaults and limits
// ---------------------------------------------------------------------------

func TestParsePagination_Defaults(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/pets", nil)
	page, limit, _ := parsePagination(req)

	if page != 1 {
		t.Errorf("page = %d, want 1", page)
	}
	if limit != 20 {
		t.Errorf("limit = %d, want 20", limit)
	}
}

func TestParsePagination_MaxLimit(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/pets?page=3&limit=999", nil)
	page, limit, offset := parsePagination(req)

	if page != 3 {
		t.Errorf("page = %d, want 3", page)
	}
	if limit != 100 {
		t.Errorf("limit = %d, want 100 (max)", limit)
	}
	if offset != 200 {
		t.Errorf("offset = %d, want 200", offset)
	}
}

func TestParsePagination_ZeroValues(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/pets?page=0&limit=0", nil)
	page, limit, offset := parsePagination(req)

	if page != 1 {
		t.Errorf("page = %d, want 1", page)
	}
	if limit != 20 {
		t.Errorf("limit = %d, want 20", limit)
	}
	if offset != 0 {
		t.Errorf("offset = %d, want 0", offset)
	}
}

func TestParsePagination_NegativeValues(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/pets?page=-5&limit=-10", nil)
	page, limit, _ := parsePagination(req)

	if page != 1 {
		t.Errorf("page = %d, want 1", page)
	}
	if limit != 20 {
		t.Errorf("limit = %d, want 20", limit)
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// assertAnError returns a sentinel error for tests that check error paths.
// It implements the error interface so it can be used where error is expected.
type assertAnError string

func (e assertAnError) Error() string { return string(e) }

// Ensure mockStore satisfies store.Store at compile time. 
// We embed store.Store, so the embedded nil interface is always nil.
// This guard is just for documentation — the mock is accepted by NewRouter.
var _ store.Store = (*mockStore)(nil)
