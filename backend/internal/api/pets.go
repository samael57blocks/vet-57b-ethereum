package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"vet-57b/backend/internal/models"
	"vet-57b/backend/internal/store"
)

// ListPets handles GET /api/v1/pets with pagination and optional filters:
//   - type: filter by animal_type (Dog, Cat)
//   - name: substring ILIKE match on pet name
//   - page: page number (default 1)
//   - limit: items per page (default 20, max 100)
func ListPets(st store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		page, limit, _ := parsePagination(r)

		filter := store.PetFilter{
			Type:  q.Get("type"),
			Name:  q.Get("name"),
			Page:  page,
			Limit: limit,
		}

		pets, total, err := st.ListPets(r.Context(), filter)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL", "Failed to list pets")
			return
		}

		if pets == nil {
			pets = []*models.Pet{}
		}

		jsonResponse(w, http.StatusOK, paginatedResponse{
			Data:  pets,
			Total: total,
			Page:  page,
			Limit: limit,
		})
	}
}

// GetPet handles GET /api/v1/pets/{id} and returns a single pet.
// Returns 404 if the pet does not exist.
func GetPet(st store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			jsonError(w, http.StatusBadRequest, "INVALID_PARAM", "pet id must be a uint64")
			return
		}

		pet, err := st.GetPet(r.Context(), id)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL", "Failed to get pet")
			return
		}
		if pet == nil {
			jsonError(w, http.StatusNotFound, "NOT_FOUND", "pet not found")
			return
		}

		jsonResponse(w, http.StatusOK, pet)
	}
}
