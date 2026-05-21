# Database Specification

## Purpose

PostgreSQL schema for pet records, appointments, and indexer checkpoints with migration files using golang-migrate.

## Requirements

### Requirement: Schema Tables

The system MUST have 3 tables: `pets`, `appointments`, `indexer_checkpoints`.

**pets** — one row per `MedicalRecordCreated` event:

| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| age | SMALLINT | NOT NULL, CHECK (age > 0) |
| animal_type | VARCHAR(10) | NOT NULL, CHECK ('Dog','Cat') |
| caretaker_name | VARCHAR(255) | NOT NULL |
| caretaker_phone | VARCHAR(50) | NOT NULL |
| tx_hash | BYTEA | NOT NULL |
| log_index | INTEGER | NOT NULL |
| block_number | BIGINT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| UNIQUE(tx_hash, log_index) | | |

**appointments** — one row per `MedicalAppointmentCreated` event:

| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, NOT NULL |
| pet_id | BIGINT | NOT NULL, FK → pets(id) |
| date | BIGINT | NOT NULL (unix) |
| time_str | VARCHAR(20) | NOT NULL |
| appointment_value | NUMERIC(78,0) | NOT NULL (wei) |
| paid_value | NUMERIC(78,0) | DEFAULT 0 |
| tx_hash | BYTEA | NOT NULL |
| log_index | INTEGER | NOT NULL |
| block_number | BIGINT | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| UNIQUE(tx_hash, log_index) | | |

**indexer_checkpoints** — single-row processing state:

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK, DEFAULT 1, CHECK (id=1) |
| last_finalized_block | BIGINT | NOT NULL DEFAULT 0 |
| last_fetched_block | BIGINT | NOT NULL DEFAULT 0 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### Requirement: Indexes

For query performance, the system MUST create indexes:

- `idx_pets_animal_type` ON pets(animal_type)
- `idx_appointments_pet_id` ON appointments(pet_id)
- `idx_appointments_pet_id_date` ON appointments(pet_id, date DESC)
- `idx_appointments_block_number` ON appointments(block_number)
- `idx_pets_block_number` ON pets(block_number)

### Requirement: Migrations

Migrations MUST use golang-migrate format (`NNNNNN_description.up.sql` and `NNNNNN_description.down.sql`).

| Migration | Up | Down |
|-----------|----|------|
| 000001_create_pets | CREATE TABLE pets | DROP TABLE pets |
| 000002_create_appointments | CREATE TABLE appointments | DROP TABLE appointments |
| 000003_create_checkpoints | CREATE TABLE indexer_checkpoints | DROP TABLE indexer_checkpoints |

### Requirement: Connection Pool

The indexer MUST use pgx v5 with connection pool configured via env vars:

- `DATABASE_URL` — full connection string
- `DB_POOL_MAX_CONNS` — default 10
- `DB_POOL_MIN_CONNS` — default 2

- GIVEN the indexer starts
- WHEN it cannot connect to PostgreSQL after retries
- THEN it logs the error and exits with code 1

- GIVEN a query exceeds 30s
- WHEN the pool detects a hung connection
- THEN it is recycled and a new connection created
