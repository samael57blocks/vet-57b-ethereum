CREATE TABLE IF NOT EXISTS appointments (
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

CREATE INDEX IF NOT EXISTS idx_appointments_pet_id ON appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_appointments_pet_date ON appointments(pet_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_block_number ON appointments(block_number);
