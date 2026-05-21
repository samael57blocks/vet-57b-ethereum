# Proposal: Go Backend Indexer

## Intent

Contract-only reads via wagmi don't scale — no filter, search, pagination, or analytics. A Go backend indexes VetRegistry events into PostgreSQL and serves a REST API.

## Scope

### In
- Go binary: indexer goroutine + chi v5 REST API
- Listen for all 4 VetRegistry events (WS + polling fallback)
- PostgreSQL schema: pets, appointments, indexer_checkpoints
- REST v1: pets, appointments, stats, health
- Reorg handling: confirmation depth + checkpoint table
- Migrations (golang-migrate), Docker Compose (pg + indexer)
- Frontend: `VITE_USE_MOCK_DATA=false` reads from backend

### Out
- Auth/API keys, GraphQL, Redis cache, admin UI, CI/CD, contract changes

## Capabilities

### New
- `backend-indexer`: Off-chain indexer + REST API

### Modified
- `pet-registration`: List refresh sources from REST
- `contract-reads`: Read hooks migrate behind `IPetService`/`IAppointmentService`
- `appointments-page`: Data switches from contract reads to REST

## Approach

Single Go binary, two goroutines: **indexer** listens via ethclient, decodes with manual ABI parsing, upserts into pgx; **REST API** serves chi routes from same DB. WS primary, polling fallback. Reorg: N confirmations + checkpoint.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/` | New | Full Go project |
| `web-app/` | Modified | REST services wired |
| `docker-compose.yml` | New | pg + indexer |
| `.env` | Modified | Backend env vars |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reorg stale data | Low | N confirms + checkpoint replay |
| WS disconnect | Med | Backoff reconnect + polling |
| RPC rate limits | Med | Retry with backoff, configurable |
| Duplicate events | Low | Upsert on tx_hash+log_index |

## Rollback

1. `VITE_USE_MOCK_DATA=true` restores mock data
2. Stop indexer binary/docker
3. Drop `backend/`, revert docker-compose
4. Contract reads fallback to wagmi RPC

## Dependencies

- Go 1.22+, pgx v5, chi v5, go-ethereum, golang-migrate
- PostgreSQL 16, Docker Compose, RPC endpoint
- Frontend: `VITE_BACKEND_URL` exists; wire `AxiosPetService`, create `AxiosAppointmentService`

## Success Criteria

- [ ] Indexer processes all historical events from deployment block
- [ ] All 4 event types stored correctly (replay-verified)
- [ ] `GET /api/v1/pets?type=Dog` returns filtered
- [ ] `GET /api/v1/pets/{id}/appointments` works
- [ ] `GET /api/v1/stats/totals` returns counts
- [ ] New on-chain appointment appears in API <30s
- [ ] Reorg of 2 blocks re-processes correctly
- [ ] Frontend `VITE_USE_MOCK_DATA=false` loads from backend
