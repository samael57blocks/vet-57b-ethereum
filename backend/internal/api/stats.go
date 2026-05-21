package api

import (
	"net/http"

	"vet-57b/backend/internal/store"
)

// GetStats handles GET /api/v1/stats/totals and returns aggregate statistics
// across pets and appointments.
//
// Response:
//
//	{
//	  "totalPets": 150,
//	  "totalAppointments": 430,
//	  "totalPaidAppointments": 120,
//	  "totalRevenueCents": "2500000"
//	}
func GetStats(st store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats, err := st.GetStats(r.Context())
		if err != nil {
			jsonError(w, http.StatusInternalServerError, "INTERNAL", "Failed to get stats")
			return
		}

		jsonResponse(w, http.StatusOK, stats)
	}
}
