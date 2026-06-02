CREATE TABLE IF NOT EXISTS indexer_checkpoints (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_finalized_block BIGINT NOT NULL DEFAULT 0,
    last_fetched_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO indexer_checkpoints (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
