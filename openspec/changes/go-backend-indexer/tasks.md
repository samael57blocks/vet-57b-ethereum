# Tasks: Go Backend Indexer

## Review Workload Forecast

~1900 lines across 23+ files. Well over 400-line budget.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

| Unit | Goal | Base |
|------|------|------|
| 1 | Foundation: go.mod, config, models, Makefile | feature/go-backend-indexer |
| 2 | RPC: ethclient client + ABI event parsing | PR 1 branch |
| 3 | Store: pgx impl + migrations + checkpoint | PR 2 branch |
| 4 | Indexer: core loop, backfill, reorg detect | PR 3 branch |
| 5 | API: chi router + 7 endpoints | PR 4 branch |
| 6 | Deploy: main.go, Docker, compose, frontend wiring | PR 5 branch |

## Phase 1: Foundation

- [x] 1.1 `backend/go.mod` — module init with pgx v5, chi v5, go-ethereum, golang-migrate
- [x] 1.2 `backend/internal/config/config.go` — env loader, defaults, validation, slog
- [x] 1.3 `backend/internal/models/models.go` — Pet, Appointment, Checkpoint structs
- [x] 1.4 `backend/Makefile` — build, test, migrate, docker targets
- [x] 1.5 test: config table-driven (missing vars, defaults, parse errors)

## Phase 2: RPC Layer

- [ ] 2.1 `backend/internal/ethclient/client.go` — Client interface + WS/HTTP impl + backoff
- [ ] 2.2 `backend/internal/ethclient/events.go` — 4 ABI consts + typed event parsers
- [ ] 2.3 test: ABI parse all 4 events from known log hex (edge: zero-address, max uint)

## Phase 3: Persistence

- [ ] 3.1 `backend/migrations/` — 6 migration files (3 up, 3 down) per DDL spec
- [ ] 3.2 `backend/internal/store/store.go` — Store interface + pgx impl: all CRUD, upserts, stats
- [ ] 3.3 `backend/internal/indexer/checkpoint.go` — checkpoint read/write via Store
- [ ] 3.4 test: store upsert idempotency + checkpoint singleton (short-guard integration)

## Phase 4: Indexer Core

- [ ] 4.1 `backend/internal/indexer/indexer.go` — Run(), backfill(), processBatch(), reorg detect
- [ ] 4.2 test: processBatch with mock store; reorg path with mock client

## Phase 5: REST API

- [ ] 5.1 `backend/internal/api/router.go` — chi + middleware (CORS, logger, recoverer, timeout)
- [ ] 5.2 `backend/internal/api/health.go` — GET /health (DB ping + last indexed block)
- [ ] 5.3 `backend/internal/api/pets.go` — GET /pets (paginated, filterable) + GET /pets/{id}
- [ ] 5.4 `backend/internal/api/appointments.go` — GET /appointments + /{id} + /pets/{id}/appointments
- [ ] 5.5 `backend/internal/api/stats.go` — GET /stats/totals (aggregate)
- [ ] 5.6 test: httptest + mock store for all endpoints, error codes, CORS

## Phase 6: Deployment + Frontend

- [ ] 6.1 `backend/cmd/indexer/main.go` — goroutines, signals, migration runner
- [ ] 6.2 `backend/Dockerfile` — multi-stage Go build (alpine)
- [ ] 6.3 `docker-compose.yml` — postgres:16 + indexer (depends_on + healthcheck)
- [ ] 6.4 `web-app/src/pets/services/petService.ts` — add AxiosPetService, update factory
- [ ] 6.5 `web-app/src/appointments/services/appointmentService.ts` — add AxiosAppointmentService, update factory
- [ ] 6.6 `web-app/.env.example` — update VITE_BACKEND_URL port, clarify VITE_USE_MOCK_DATA

## Success Criteria Mapping

| Criterion | Task(s) |
|-----------|---------|
| Indexer processes all historical events | 4.1 (backfill) |
| All 4 event types stored correctly | 2.2 + 3.2 (parsing + upsert) |
| GET /pets?type=Dog returns filtered | 5.3 |
| GET /pets/{id}/appointments works | 5.4 |
| GET /stats/totals returns counts | 5.5 |
| New on-chain event appears <30s | 4.1 (live loop) |
| Reorg of 2 blocks re-processes | 4.1 (reorg detect) |
| Frontend VITE_USE_MOCK_DATA=false works | 6.4 + 6.5 |
