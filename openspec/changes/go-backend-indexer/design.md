# Design: Go Backend Indexer

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Go Binary                          │
│  ┌──────────┐    ┌──────────────┐    ┌────────────┐  │
│  │ Indexer   │───▶│   pgx Pool   │◀───│   chi API  │  │
│  │ goroutine │    │ (PostgreSQL) │    │ goroutine  │  │
│  └─────┬─────┘    └──────┬───────┘    └──────┬─────┘  │
│        │                 │                    │        │
│  ┌─────▼─────┐    ┌──────▼───────┐    ┌──────▼─────┐  │
│  │ ethclient  │    │  migrations  │    │  /api/v1/  │  │
│  │ (WS+HTTP)  │    │ golang-migrate│   │   routes   │  │
│  └────────────┘    └──────────────┘    └────────────┘  │
└──────────────────────────────────────────────────────┘
         │                                      ▲
         │ WS/HTTP RPC                          │ JSON
         ▼                                      │
   Ethereum RPC                           Frontend (React)
   (Sepolia/Mainnet)                      VITE_USE_MOCK_DATA=false
```

**Two goroutines** sharing one pgx pool. Indexer owns writes, API owns reads. Both serialized by PostgreSQL ACID — no shared mutex needed.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Event decoding | Manual ABI (go-ethereum `accounts/abi`) | go-ethereum bindings | No codegen step, full control over field types |
| ABI definitions | Go constant strings in `ethclient/events.go` | JSON files | Single-file, no file I/O at runtime |
| Reorg safety | Checkpoint table + parent hash check | Reorg detection lib | Full control, no external dep, simple rollback loop |
| DB driver | pgx v5 (native PostgreSQL) | database/sql + lib/pq | Native type support, connection pooling, no ORM overhead |
| Router | chi v5 | stdlib net/http, gin | Lightweight, middleware chaining, context params |
| Backfill strategy | Batch range scan (2000 blocks) | Single block sequential | Fewer RPC round-trips, matches `eth_getLogs` batch limits |
| WS reconnect | Backoff chain: 1s → 5s → 30s max | Fixed interval | Rapid recovery on transient drops without flooding RPC |
| Payment value storage | Both events increment `paid_value` on the appointment row | Separate payments table | Matches contract's single `paidValue` field; stats aggregate in one place |

## Data Flow

### Normal Event Processing
```
WS subscribe (eth_subscribe/logs)
  → filter by VET_REGISTRY_ADDRESS
  → log arrives in channel
  → ABI decode → domain struct
  → upsert (check CONFIRMATIONS depth)
  → if confirmed: save to pets/appointments
  → update checkpoint (last_finalized_block)
```

### Reorg Detection & Recovery
```
Indexer reads block at (checkpoint.last_finalized_block - CONFIRMATIONS)
  → compares parent_hash with stored chain tip
  → mismatch detected:
    → delete all rows WHERE block_number >= fork_block
    → refetch logs from fork_block in batches
    → re-process events → upsert
    → update checkpoint
```

### Historical Backfill
```
Start from BACKFILL_FROM_BLOCK
  → eth_getLogs( fromBlock, fromBlock+1999 )
  → decode batch → upsert each event
  → checkpoint every batch
  → catch up to (current_block - CONFIRMATIONS)
  → switch to WS live mode
```

### REST Request Serving
```
chi router → middleware chain (logger, CORS, recoverer)
  → handler parses query params
  → pgx query with filters + pagination
  → JSON response with { data, total, page, limit }
```

### Graceful Shutdown
```
SIGTERM/SIGINT
  → context cancel propagates to indexer loop
  → finish current batch processing
  → save checkpoint to DB
  → close pgx pool
  → exit 0 (within 30s)
```

## Package-by-Package Design

### config — env loading
```go
type Config struct {
    DatabaseURL        string // required
    EthWsURL           string // required
    EthHttpURL         string // required
    VetRegistryAddress common.Address // required
    Confirmations      uint64 // default: 12
    BackfillFromBlock  uint64 // default: 0
    Port               string // default: "8080"
    CorsOrigin         string // default: "http://localhost:5173"
    LogLevel           slog.Level // default: info
    PoolMaxConns       int    // default: 10
    PoolMinConns       int    // default: 2
}
```
Load via `os.Getenv` with `slog`-parsed level. `VetRegistryAddress` parsed via `common.HexToAddress`. Validate all required before startup — fail fast with descriptive error.

### models — domain structs
```go
type Pet struct {
    ID             uint64    `json:"id" db:"id"`
    Name           string    `json:"name" db:"name"`
    Age            uint8     `json:"age" db:"age"`
    AnimalType     string    `json:"animalType" db:"animal_type"`
    CaretakerName  string    `json:"caretakerName" db:"caretaker_name"`
    CaretakerPhone string    `json:"caretakerPhone" db:"caretaker_phone"`
    TxHash         []byte    `json:"-" db:"tx_hash"`
    LogIndex       uint      `json:"-" db:"log_index"`
    BlockNumber    uint64    `json:"-" db:"block_number"`
    CreatedAt      time.Time `json:"createdAt" db:"created_at"`
}

type Appointment struct {
    ID               uint64    `json:"id" db:"id"`
    PetID            uint64    `json:"petId" db:"pet_id"`
    Date             int64     `json:"date" db:"date"`
    TimeStr          string    `json:"time" db:"time_str"`
    AppointmentValue string    `json:"appointmentValue" db:"appointment_value"` // NUMERIC(78,0) as string
    PaidValue        string    `json:"paidValue" db:"paid_value"`
    TxHash           []byte    `json:"-" db:"tx_hash"`
    LogIndex         uint      `json:"-" db:"log_index"`
    BlockNumber      uint64    `json:"-" db:"block_number"`
    CreatedAt        time.Time `json:"createdAt" db:"created_at"`
}

type Checkpoint struct {
    ID                int       `db:"id"`
    LastFinalizedBlock uint64   `db:"last_finalized_block"`
    LastFetchedBlock  uint64    `db:"last_fetched_block"`
    UpdatedAt         time.Time `db:"updated_at"`
}
```
Use `string` for `NUMERIC(78,0)` — frontend receives string and converts with ethers.js `parseUnits`/`formatUnits` on display.

### ethclient — RPC wrapper + event parsing
- `Client` interface: `SubscribeLogs(ctx, address) chan types.Log`, `FilterLogs(ctx, address, from, to) ([]types.Log, error)`, `BlockNumber(ctx) (uint64, error)`, `BlockByNumber(ctx, num) (*types.Block, error)`, `Close()`
- **Two implementations** in one struct: WS client created first. On disconnect error → fall back to HTTP polling with backoff.
- **ABI definitions**: Go constants from `accounts/abi.JSON(strings.NewReader(...))` — the 4 event ABIs parsed once on startup.
- **Event parsing**: 4 typed functions: `parseMedicalRecordCreated(log)`, `parseMedicalAppointmentCreated(log)`, `parseAppointmentPaidToken(log)`, `parseAppointmentPaidEth(log)` — each returns `(event struct, error)`.
- **Reorg detection**: `ethclient.GetBlockByNumber(blockNum)` — compare `ParentHash` at checkpoint depth. If mismatch, return `ReorgError{forkBlock}`.

### indexer — core loop
```go
func (idx *Indexer) Run(ctx context.Context) error {
    checkpoint, _ := idx.store.GetCheckpoint(ctx)
    currentBlock, _ := idx.client.BlockNumber(ctx)

    if checkpoint.LastFetchedBlock == 0 {
        idx.backfill(ctx, cfg.BackfillFromBlock, currentBlock - cfg.Confirmations)
    }

    // Live loop
    logCh := idx.client.SubscribeLogs(ctx, cfg.VetRegistryAddress)
    for {
        select {
        case <-ctx.Done():
            idx.store.UpsertCheckpoint(ctx, checkpoint)
            return nil
        case batch := <-logCh:
            idx.processBatch(ctx, batch, checkpoint)
        case <-ticker.C:  // polling fallback when WS disconnects
            logs, _ := idx.client.FilterLogs(ctx, ...)
            idx.processBatch(ctx, logs, checkpoint)
        }
    }
}
```
- `processBatch`: group logs → decode each → check block depth ≥ CONFIRMATIONS → upsert → update checkpoint `last_fetched_block`
- Reorg check: every `CONFIRMATIONS` blocks, verify `ParentHash`. On mismatch: rollback range, refetch.

### store — pgx repository
- Interface: `GetCheckpoint`, `UpsertCheckpoint`, `UpsertPet`, `UpsertAppointment`, `ListPets(filter)`, `GetPet`, `ListAppointments(filter)`, `GetAppointment`, `GetStats`
- Upserts: `INSERT ... ON CONFLICT (tx_hash, log_index) DO UPDATE SET ...` (idempotent)
- Checkpoint: single-row upsert with `INSERT ... ON CONFLICT (id) DO UPDATE`

### api — chi router
- `ChiRouter(cfg, store) http.Handler` — creates router, attaches middleware
- Middleware chain: `RequestID → RealIP → Logger → Recoverer → CORS → Timeout(30s)`
- Handler pattern: all handlers take `(store.Store)` closure, return `http.HandlerFunc`
- Pagination helper: `parsePagination(r) → (page, limit, offset)` with defaults 1/20, max 100
- Response helper: `jsonResponse(w, status, body)`, `jsonError(w, status, code, message)`
- Stats query: `SELECT COUNT(*), SUM(paid_value) FROM pets/appointments` — single aggregated query

## Database Design

### DDL

```sql
-- 000001_create_pets.up.sql
CREATE TABLE pets (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age SMALLINT NOT NULL,
    animal_type VARCHAR(10) NOT NULL CHECK (animal_type IN ('Dog', 'Cat')),
    caretaker_name VARCHAR(255) NOT NULL,
    caretaker_phone VARCHAR(50) NOT NULL,
    tx_hash BYTEA NOT NULL,
    log_index INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tx_hash, log_index)
);
CREATE INDEX idx_pets_animal_type ON pets(animal_type);
CREATE INDEX idx_pets_block_number ON pets(block_number);

-- 000002_create_appointments.up.sql
CREATE TABLE appointments (
    id BIGINT PRIMARY KEY,
    pet_id BIGINT NOT NULL REFERENCES pets(id),
    date BIGINT NOT NULL,
    time_str VARCHAR(20) NOT NULL,
    appointment_value NUMERIC(78,0) NOT NULL,
    paid_value NUMERIC(78,0) NOT NULL DEFAULT 0,
    tx_hash BYTEA NOT NULL,
    log_index INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tx_hash, log_index)
);
CREATE INDEX idx_appointments_pet_id ON appointments(pet_id);
CREATE INDEX idx_appointments_pet_date ON appointments(pet_id, date DESC);
CREATE INDEX idx_appointments_block_number ON appointments(block_number);

-- 000003_create_checkpoints.up.sql
CREATE TABLE indexer_checkpoints (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_finalized_block BIGINT NOT NULL DEFAULT 0,
    last_fetched_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO indexer_checkpoints (id) VALUES (1) ON CONFLICT DO NOTHING;
```
Down migrations reverse in opposite order (000003 → 000001).

## Configuration

| Env Var | Default | Validation | Required |
|---------|---------|------------|----------|
| `DATABASE_URL` | — | must be valid postgres:// URI | yes |
| `ETH_WS_URL` | — | must start with ws:// or wss:// | yes |
| `ETH_HTTP_URL` | — | must start with http:// or https:// | yes |
| `VET_REGISTRY_ADDRESS` | — | valid hex address, 20 bytes | yes |
| `CONFIRMATIONS` | `12` | ≥0 integer | no |
| `BACKFILL_FROM_BLOCK` | `0` | ≥0 integer | no |
| `PORT` | `8080` | valid port number | no |
| `CORS_ORIGIN` | `http://localhost:5173` | valid origin | no |
| `LOG_LEVEL` | `info` | debug/info/warn/error | no |
| `DB_POOL_MAX_CONNS` | `10` | ≥1 | no |
| `DB_POOL_MIN_CONNS` | `2` | ≥0 | no |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit — config | Env parsing, defaults, validation errors | Table-driven, set/unset env vars |
| Unit — models | Struct construction, JSON serialization | Direct struct init + `json.Marshal` |
| Unit — ethclient | ABI event parsing (all 4 events) | Known log hex → decode → assert fields; include edge cases (zero-address, max uint256) |
| Unit — indexer | `processBatch` with mock store | Mock `store.Store` interface, feed decoded events, assert upsert calls |
| Unit — api | Handler responses (pagination, filters, error codes) | `httptest.NewRecorder` + `chi.NewRouter`, mock store |
| Integration — DB | Upsert idempotency, checkpoint singleton, indexes | `testing.Short()` guard, real pgx pool via `DATABASE_URL` env |
| Integration — RPC | WS subscription, log filtering, block retrieval | `testing.Short()` guard, real RPC endpoint |

**Mock interfaces**: `ethclient.Client` and `store.Store` are interfaces. Tests create struct-only mocks (no mock framework needed).

## Error Handling & Logging

- **Structured logging** via `slog`: every indexed event logs block, tx_hash, event type; every API request logs method, path, status, duration.
- **Error classification**: DB errors → 500 INTERNAL; invalid params → 400 INVALID_PARAM; not found → 404 NOT_FOUND; reorg → warn-level log + automatic recovery.
- **Startup validation**: all required env vars checked before any goroutine starts. Missing var → `slog.Error` + `os.Exit(1)`.
- **Graceful degradation**: RPC unavailable → log warning, retry with backoff; DB unavailable → fatal (can't proceed without storage).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/` | Create | Full Go module directory |
| `backend/cmd/indexer/main.go` | Create | Entrypoint, two goroutines, signal handling |
| `backend/internal/config/config.go` | Create | Env-based config loader |
| `backend/internal/models/models.go` | Create | Domain types |
| `backend/internal/ethclient/client.go` | Create | RPC wrapper (WS + HTTP) |
| `backend/internal/ethclient/events.go` | Create | ABI definitions + event parsing |
| `backend/internal/indexer/indexer.go` | Create | Core indexer loop |
| `backend/internal/indexer/checkpoint.go` | Create | Checkpoint read/write helpers |
| `backend/internal/store/store.go` | Create | pgx repository interface + implementation |
| `backend/internal/api/router.go` | Create | chi router setup |
| `backend/internal/api/pets.go` | Create | Pet handlers |
| `backend/internal/api/appointments.go` | Create | Appointment handlers |
| `backend/internal/api/stats.go` | Create | Stats handler |
| `backend/internal/api/health.go` | Create | Health check handler |
| `backend/migrations/` | Create | 6 migration files (3 up, 3 down) |
| `backend/Dockerfile` | Create | Multi-stage Go build |
| `backend/docker-compose.yml` | Create | PostgreSQL + indexer |
| `backend/Makefile` | Create | build, test, migrate targets |
| `backend/go.mod` | Create | Module definition |
| `docker-compose.yml` | Create | Repository root compose (pg + indexer) |
| `web-app/src/pets/services/petService.ts` | Modify | Switch to AxiosPetService when `VITE_USE_MOCK_DATA=false` |
| `web-app/src/appointments/services/appointmentService.ts` | Modify | Switch to AxiosAppointmentService when `VITE_USE_MOCK_DATA=false` |
| `web-app/.env.example` | Modify | Add `VITE_USE_MOCK_DATA` and `VITE_BACKEND_URL` documentation |

## Open Questions Resolved

1. **RPC endpoints for Sepolia**: env vars `ETH_WS_URL` and `ETH_HTTP_URL` — document in `.env.example` with Alchemy/Infura placeholder URLs. Operator configures per deployment.

2. **Deployment block**: `BACKFILL_FROM_BLOCK` env var — set to the block number where VetRegistry was deployed. For local Hardhat, this is block 0. For Sepolia/Mainnet, determined at deploy time.

3. **CONFIRMATIONS value**: Configurable via env var. Defaults: mainnet=12, Sepolia=1 (1 epoch finality), localhost=0 (no reorg risk). Default binary ships with 12; docs recommend 1 for Sepolia.

4. **Payment event handling**: Both `AppointmentPaidToken` and `AppointmentPaidEth` update `appointments.paid_value` by ADDING the new payment to the existing value via `UPDATE appointments SET paid_value = paid_value + amount`. `AppointmentPaidEth.usdCents` is NOT stored by the indexer (it equals `appointmentValue` from the contract event and can be recomputed from `appointmentValue`). The `paid_value` column tracks total value paid across all payment events.
