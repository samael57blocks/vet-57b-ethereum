package api

import (
	"net/http"

	"vet-57b/backend/internal/store"
)

// Health returns an http.HandlerFunc that provides a health check endpoint.
// It verifies database connectivity by calling GetCheckpoint and reports the
// last indexed block number.
//
// Responses:
//   - 200: { "status": "ok", "db": "connected", "lastIndexedBlock": 12345 }
//   - 503: { "status": "degraded", "db": "disconnected" }
func Health(st store.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cp, err := st.GetCheckpoint(r.Context())
		if err != nil {
			jsonResponse(w, http.StatusServiceUnavailable, map[string]string{
				"status": "degraded",
				"db":     "disconnected",
			})
			return
		}

		resp := map[string]any{
			"status":           "ok",
			"db":               "connected",
			"lastIndexedBlock": uint64(0),
		}
		if cp != nil {
			resp["lastIndexedBlock"] = cp.LastFinalizedBlock
		}
		jsonResponse(w, http.StatusOK, resp)
	}
}
