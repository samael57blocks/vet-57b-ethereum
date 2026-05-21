CREATE TABLE IF NOT EXISTS pets (
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

CREATE INDEX IF NOT EXISTS idx_pets_animal_type ON pets(animal_type);
CREATE INDEX IF NOT EXISTS idx_pets_block_number ON pets(block_number);
