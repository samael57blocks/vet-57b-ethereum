// Package indexer implements the core indexing loop that processes blockchain
// events and persists them to the store.
package indexer

import (
	"context"

	"vet-57b/backend/internal/models"
	"vet-57b/backend/internal/store"
)

// Indexer processes blockchain events from the VetRegistry contract and
// persists them to the database. This minimal struct will be expanded in
// Phase 4 with the Run(), backfill(), and processBatch() methods.
type Indexer struct {
	store store.Store
}

// New creates a new Indexer backed by the given store.
func New(s store.Store) *Indexer {
	return &Indexer{store: s}
}

// loadCheckpoint retrieves the current indexing checkpoint from the store.
func (idx *Indexer) loadCheckpoint(ctx context.Context) (*models.Checkpoint, error) {
	return idx.store.GetCheckpoint(ctx)
}

// saveCheckpoint persists the current indexing checkpoint to the store.
func (idx *Indexer) saveCheckpoint(ctx context.Context, cp *models.Checkpoint) error {
	return idx.store.UpsertCheckpoint(ctx, cp)
}
