// Package api provides the chi v5 REST API for serving indexed blockchain data.
// It follows the container-presentational pattern: handlers receive a store.Store
// closure and return http.HandlerFunc for testability with httptest.
package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"vet-57b/backend/internal/config"
	"vet-57b/backend/internal/store"
)

// NewRouter creates a chi router with middleware and all API v1 routes.
// Middleware chain: RequestID → RealIP → Logger → Recoverer → CORS → Timeout(30s).
// Routes are mounted under /api/v1.
func NewRouter(cfg *config.Config, st store.Store) http.Handler {
	r := chi.NewRouter()

	// --- Global middleware ---
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.CorsOrigin},
		AllowedMethods:   []string{"GET", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	r.Use(chimw.Timeout(30 * time.Second))

	// --- API v1 routes ---
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", Health(st))
		r.Get("/pets", ListPets(st))
		r.Get("/pets/{id}", GetPet(st))
		r.Get("/pets/{id}/appointments", ListPetAppointments(st))
		r.Get("/appointments", ListAppointments(st))
		r.Get("/appointments/{id}", GetAppointment(st))
		r.Get("/stats/totals", GetStats(st))
	})

	return r
}

// parsePagination reads page and limit from query parameters with sensible
// defaults (page=1, limit=20) and a maximum limit of 100.
func parsePagination(r *http.Request) (page, limit, offset int) {
	q := r.URL.Query()
	if v := q.Get("page"); v != "" {
		page, _ = strconv.Atoi(v)
	}
	if v := q.Get("limit"); v != "" {
		limit, _ = strconv.Atoi(v)
	}
	if page < 1 {
		page = 1
	}
	switch {
	case limit <= 0:
		limit = 20
	case limit > 100:
		limit = 100
	}
	offset = (page - 1) * limit
	return
}

// paginatedResponse wraps a list result with total count and pagination info.
type paginatedResponse struct {
	Data  any `json:"data"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Limit int `json:"limit"`
}

// errorResponse is the standard error envelope returned on non-2xx responses.
type errorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

// jsonResponse writes a JSON response with the given status code and body.
func jsonResponse(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// jsonError writes a JSON error response with the given HTTP status, error
// code, and human-readable message.
func jsonError(w http.ResponseWriter, status int, code, message string) {
	jsonResponse(w, status, errorResponse{
		Error: message,
		Code:  code,
	})
}
