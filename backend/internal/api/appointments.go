package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"vet-57b/backend/internal/models"
	"vet-57b/backend/internal/store"
)

// ListAppointments handles GET /api/v1/appointments with pagination and
// optional filters:
//   - petId: filter by pet
//   - from: unix timestamp inclusive lower bound
//   - to: unix timestamp inclusive upper bound
//   - paid: "true" or "false" filter
//   - page: page number (default 1)
//   - limit: items per page (default 20, max 100)
func ListAppointments(st store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		page, limit, _ := parsePagination(r)

		filter := store.AppointmentFilter{
			Page:  page,
			Limit: limit,
		}

		if petIDStr := q.Get("petId"); petIDStr != "" {
			petID, err := strconv.ParseUint(petIDStr, 10, 64)
			if err != nil {
				jsonError(w, http.StatusBadRequest, "INVALID_PARAM", "petId must be a uint64")
				return
			}
			filter.PetID = &petID
		}

		if fromStr := q.Get("from"); fromStr != "" {
			from, err := strconv.ParseInt(fromStr, 10, 64)
			if err != nil {
				jsonError(w, http.StatusBadRequest, "INVALID_PARAM", "from must be a unix timestamp")
				return
			}
			filter.From = &from
		}

		if toStr := q.Get("to"); toStr != "" {
			to, err := strconv.ParseInt(toStr, 10, 64)
			if err != nil {
				jsonError(w, http.StatusBadRequest, "INVALID_PARAM", "to must be a unix timestamp")
				return
			}
			filter.To = &to
		}

		if paidStr := q.Get("paid"); paidStr != "" {
			switch paidStr {
			case "true":
				b := true
				filter.Paid = &b
			case "false":
				b := false
				filter.Paid = &b
			default:
				jsonError(w, http.StatusBadRequest, "INVALID_PARAM", "paid must be true or false")
				return
			}
		}

		appts, total, err := st.ListAppointments(r.Context(), filter)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL", "Failed to list appointments")
			return
		}

		if appts == nil {
			appts = []*models.Appointment{}
		}

		jsonResponse(w, http.StatusOK, paginatedResponse{
			Data:  appts,
			Total: total,
			Page:  page,
			Limit: limit,
		})
	}
}

// GetAppointment handles GET /api/v1/appointments/{id} and returns a single
// appointment. Returns 404 if the appointment does not exist.
func GetAppointment(st store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseUint(idStr, 10, 64)
		if err != nil {
			jsonError(w, http.StatusBadRequest, "INVALID_PARAM", "appointment id must be a uint64")
			return
		}

		appt, err := st.GetAppointment(r.Context(), id)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL", "Failed to get appointment")
			return
		}
		if appt == nil {
			jsonError(w, http.StatusNotFound, "NOT_FOUND", "appointment not found")
			return
		}

		jsonResponse(w, http.StatusOK, appt)
	}
}

// ListPetAppointments handles GET /api/v1/pets/{id}/appointments and returns
// all appointments for the given pet, ordered by date DESC.
// Returns 404 if the pet does not exist.
func ListPetAppointments(st store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		petIDStr := chi.URLParam(r, "id")
		petID, err := strconv.ParseUint(petIDStr, 10, 64)
		if err != nil {
			jsonError(w, http.StatusBadRequest, "INVALID_PARAM", "pet id must be a uint64")
			return
		}

		// Verify pet exists before querying appointments.
		pet, err := st.GetPet(r.Context(), petID)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL", "Failed to get pet")
			return
		}
		if pet == nil {
			jsonError(w, http.StatusNotFound, "NOT_FOUND", "pet not found")
			return
		}

		// Return up to 100 appointments for the pet (reasonable "all" limit).
		filter := store.AppointmentFilter{
			PetID: &petID,
			Page:  1,
			Limit: 100,
		}

		appts, total, err := st.ListAppointments(r.Context(), filter)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL", "Failed to list appointments")
			return
		}

		if appts == nil {
			appts = []*models.Appointment{}
		}

		jsonResponse(w, http.StatusOK, paginatedResponse{
			Data:  appts,
			Total: total,
			Page:  1,
			Limit: 100,
		})
	}
}
