# REST API Specification

## Purpose

chi v5 REST API serving indexed data with pagination, filtering, and aggregation from PostgreSQL.

## Requirements

### Requirement: Endpoints

The API MUST expose these v1 endpoints under `/api/v1`:

| Method | Path | Description |
|--------|------|-------------|
| GET | /pets | List pets (paginated, filterable) |
| GET | /pets/{id} | Single pet detail |
| GET | /pets/{id}/appointments | Appointments for a pet |
| GET | /appointments | List appointments (paginated, filterable) |
| GET | /appointments/{id} | Single appointment detail |
| GET | /stats/totals | Aggregate counts and revenue |
| GET | /health | Health check |

### Requirement: Pet List Endpoint

`GET /api/v1/pets` MUST support:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| type | string | — | Filter by animal_type (Dog, Cat) |
| name | string | — | Substring match on name (ILIKE) |
| page | int | 1 | Page number |
| limit | int | 20 | Items per page (max 100) |

Response: `{ "data": [...], "total": int, "page": int, "limit": int }`

- GIVEN `GET /pets?type=Dog&page=1&limit=10`
- WHEN pets exist
- THEN the response contains up to 10 dogs in `data`
- AND `total` reflects the count of ALL dogs (not page-limited)

- GIVEN no pets match filters
- WHEN `GET /pets?type=Cat` and no cats exist
- THEN `data` is an empty array, `total` is 0

### Requirement: Pet Appointments Endpoint

`GET /api/v1/pets/{id}/appointments` MUST return all appointments for the given pet, ordered by date DESC.

- GIVEN pet 1 has 3 appointments
- WHEN `GET /api/v1/pets/1/appointments`
- THEN response contains all 3 appointments with pet data

- GIVEN pet 99 does not exist
- WHEN `GET /api/v1/pets/99/appointments`
- THEN `404` is returned

### Requirement: Stats Endpoint

`GET /api/v1/stats/totals` MUST return:

```json
{
  "total_pets": 150,
  "total_appointments": 430,
  "total_paid_appointments": 120,
  "total_revenue_wei": "5000000000000000000",
  "total_revenue_usd_cents": 2500000
}
```

Revenue aggregates from `AppointmentPaidEth.usdCents` and `AppointmentPaidToken` by joining payments to appointments.

### Requirement: Health Check

`GET /api/v1/health` MUST return `200 OK` with `{ "status": "ok", "db": "connected", "last_indexed_block": 12345 }`.

- GIVEN the database is unreachable
- WHEN `GET /api/v1/health`
- THEN status is `503` with `{ "status": "degraded", "db": "disconnected" }`

### Requirement: Error Format

All errors MUST follow `{ "error": "message", "code": "ERROR_CODE" }`.

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | INVALID_PARAM | Bad request params |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL | Unexpected server error |

### Requirement: CORS

The API MUST allow CORS for the frontend origin configured via `CORS_ORIGIN` (default `http://localhost:5173`).

- GIVEN a request from `http://localhost:5173`
- WHEN the browser sends a preflight OPTIONS
- THEN the response includes `Access-Control-Allow-Origin: http://localhost:5173`
