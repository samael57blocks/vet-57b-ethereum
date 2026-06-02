# Non-Functional Specification

## Requirements

### Requirement: API Latency

95th percentile response time MUST be <200ms for all endpoints.

- GIVEN the API receives 50 concurrent requests
- WHEN the requests hit `/api/v1/pets`, `/api/v1/stats/totals`, and `/api/v1/pets/{id}/appointments`
- THEN p95 response time is under 200ms

### Requirement: Data Freshness

A newly emitted on-chain event MUST be reflected in the REST API within 30 seconds.

- GIVEN a `MedicalAppointmentCreated` event is emitted in block N
- WHEN block `N + CONFIRMATIONS` is finalized
- THEN `GET /api/v1/appointments/{newId}` returns the new appointment within 30s of emission

### Requirement: Startup Catch-Up

On restart, the indexer MUST catch up from `last_finalized_block` to the current chain tip before serving fresh events.

- GIVEN a checkpoint at block 5000
- WHEN the indexer restarts with chain at block 6000
- THEN it backfills blocks 5000-6000 within 120s
- AND the health endpoint shows `last_indexed_block` progressing

### Requirement: Structured Logging

The indexer MUST use Go `log/slog` with configurable level (`LOG_LEVEL`: debug, info, warn, error).

- GIVEN `LOG_LEVEL=debug`
- WHEN the indexer processes a log
- THEN each event parsed, each DB upsert, and each API request is logged with structured fields

- GIVEN a reorg is detected
- WHEN the indexer rolls back blocks
- THEN a `warn` level log includes the block range and affected event IDs

### Requirement: Graceful Shutdown

The indexer MUST handle SIGTERM/SIGINT by finishing in-flight processing, saving the current checkpoint, then exiting.

- GIVEN the indexer is processing block 500
- WHEN it receives SIGTERM
- THEN it completes processing block 500
- THEN it persists `last_finalized_block` and `last_fetched_block` to `indexer_checkpoints`
- THEN it closes the database pool and RPC connection
- THEN it exits with code 0 within 30s

- GIVEN the indexer is in the middle of a backfill
- WHEN it receives SIGTERM
- THEN it finishes the current batch of blocks
- AND saves the checkpoint
- AND exits cleanly
