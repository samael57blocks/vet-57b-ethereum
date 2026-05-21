# Event Indexing Specification

## Purpose

Go indexer that connects to Ethereum RPC, listens for VetRegistry contract events, parses them into domain structs, and handles reorgs via confirmation depth + checkpoint tracking.

## Requirements

### Requirement: RPC Connection

The indexer MUST support both WebSocket (primary) and HTTP (fallback) RPC endpoints, configurable via environment variables.

- GIVEN a WS endpoint URL is configured
- WHEN the indexer starts
- THEN it connects via `ethclient.DialContext` over WS
- AND subscribes to logs via `ethSubscribe`

- GIVEN the WS connection drops
- WHEN reconnect backoff (1s, 5s, 30s max) is exhausted
- THEN the indexer falls back to HTTP polling via `eth_getLogs`

### Requirement: Event Parsing

The indexer MUST parse all 4 VetRegistry events using manual ABI decoding (no codegen dependency).

| Event | Indexed Params | Data Params |
|-------|----------------|-------------|
| `MedicalRecordCreated` | id | name, age, animalType, caretakerName, caretakerPhone |
| `MedicalAppointmentCreated` | id, petId | date, time, appointmentValue |
| `AppointmentPaidToken` | appointmentId, payer | token, amount |
| `AppointmentPaidEth` | appointmentId, payer | ethAmount, usdCents |

- GIVEN a raw log from the VetRegistry contract
- WHEN the indexer processes it
- THEN it matches `topic[0]` to the event signature hash
- AND decodes indexed params from `topics[1..N]`
- AND decodes data params with manual ABI unpacking

### Requirement: Confirmation Finality

Events MUST reach configurable confirmation depth (`CONFIRMATIONS`, default 12) before insertion.

- GIVEN a log arrives at block height N
- WHEN the chain advances to height `N + CONFIRMATIONS`
- THEN the event is considered final and upserted into PostgreSQL

### Requirement: Checkpoint Tracking

The indexer MUST maintain `indexer_checkpoints` with `last_finalized_block` and `last_fetched_block`.

- GIVEN the indexer has processed blocks 100-200
- WHEN it shuts down and restarts
- THEN it resumes from `last_finalized_block` minus `CONFIRMATIONS`
- AND replays confirmed but potentially-unconfirmed blocks

### Requirement: Reorg Handling

The indexer MUST detect reorgs by comparing block hashes at rollback depth and refetching from the fork point.

- GIVEN a reorg of 2 blocks occurs
- WHEN the indexer detects mismatched parent hash at checkpoint depth
- THEN it rolls back appointments and pets for the forked blocks
- AND refetches logs from the fork block number forward

### Requirement: Historical Backfill

The indexer MUST backfill all events from a configurable deployment block (`BACKFILL_FROM_BLOCK`) before switching to live mode.

- GIVEN `BACKFILL_FROM_BLOCK=1000`
- WHEN the indexer starts with no checkpoint
- THEN it scans logs from block 1000 in configurable batch size (default 2000 blocks)
- AND upserts all events found

- GIVEN backfill is complete
- WHEN `last_processed_block` >= current block
- THEN the indexer switches to live subscription mode

### Requirement: Duplicate Prevention

The indexer MUST upsert events using `(tx_hash, log_index)` as the dedup key to handle log re-delivery.

- GIVEN the same log is delivered twice (WS reconnect + polling overlap)
- WHEN the indexer processes it a second time
- THEN the upsert on `(tx_hash, log_index)` is a no-op
