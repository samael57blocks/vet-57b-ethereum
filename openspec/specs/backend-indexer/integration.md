# Integration Specification

## Purpose

Wiring between frontend, indexer backend, PostgreSQL, and Docker Compose orchestration.

## Requirements

### Requirement: Frontend Service Layer

When `VITE_USE_MOCK_DATA=false`, the frontend MUST use Axios-based services (`AxiosPetService`, `AxiosAppointmentService`) that call `VITE_BACKEND_URL/api/v1/...` instead of mocked data.

| Service | Created | Replaces |
|---------|---------|----------|
| `AxiosPetService` | New | `MockPetService` (when mock=false) |
| `AxiosAppointmentService` | New | `MockAppointmentService` (when mock=false) |

- GIVEN `VITE_USE_MOCK_DATA=false`
- WHEN `usePets()` resolves
- THEN the hook calls `AxiosPetService.getAll({ type, page, limit })` via `VITE_BACKEND_URL`
- AND returns the REST response data

- GIVEN `VITE_USE_MOCK_DATA=true`
- WHEN `usePets()` resolves
- THEN the mock service is used as before (unchanged)

### Requirement: Write Path Unchanged

Contract writes (registerPet, scheduleAppointment, payAppointmentToken) MUST remain wallet-gated and go through wagmi/ethers — writes are NOT proxied through the backend.

- GIVEN a user schedules an appointment
- WHEN they submit the form
- THEN the transaction still goes through MetaMask
- AND the contract emits `MedicalAppointmentCreated`
- AND the indexer picks it up and stores it
- AND the REST API serves it on next read

### Requirement: Docker Compose

The system MUST include a `docker-compose.yml` with two services:

| Service | Image | Ports | Depends On |
|---------|-------|-------|------------|
| postgres | postgres:16-alpine | 5432 | — |
| indexer | build: ./backend | 8080 | postgres |

- GIVEN `docker compose up` runs
- WHEN postgres is healthy (pg_isready)
- THEN the indexer starts
- AND migrations run automatically
- AND the HTTP API is available on port 8080

### Requirement: Environment Variables

| Variable | Applies To | Default |
|----------|------------|---------|
| `DATABASE_URL` | indexer | `postgres://...` |
| `ETH_WS_URL` | indexer | `wss://...` |
| `ETH_HTTP_URL` | indexer | `https://...` |
| `VET_REGISTRY_ADDRESS` | indexer | — |
| `CONFIRMATIONS` | indexer | 12 |
| `BACKFILL_FROM_BLOCK` | indexer | 0 |
| `CORS_ORIGIN` | indexer | `http://localhost:5173` |
| `LOG_LEVEL` | indexer | `info` |
| `PORT` | indexer | 8080 |
| `VITE_USE_MOCK_DATA` | frontend | `true` |
| `VITE_BACKEND_URL` | frontend | `http://localhost:8080` |
| `VITE_CONTRACT_ADDRESS` | frontend | — (unchanged) |
