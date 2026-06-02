// Package indexer implements the core indexing loop that processes blockchain
// events and persists them to the store.
package indexer

import (
	"context"
	"sync"

	"github.com/ethereum/go-ethereum/common"

	"vet-57b/backend/internal/config"
	"vet-57b/backend/internal/ethclient"
	"vet-57b/backend/internal/models"
	"vet-57b/backend/internal/store"
)

// Indexer processes blockchain events from the VetRegistry contract and
// persists them to the database.
type Indexer struct {
	cfg    *config.Config
	client ethclient.Client
	store  store.Store

	mu           sync.RWMutex
	currentBlock uint64

	// blockHashes maps block numbers to their hashes for reorg detection.
	blockHashes map[uint64]common.Hash
}

// New creates a new Indexer backed by the given store, config, and Ethereum client.
func New(cfg *config.Config, client ethclient.Client, s store.Store) *Indexer {
	return &Indexer{
		cfg:         cfg,
		client:      client,
		store:       s,
		blockHashes: make(map[uint64]common.Hash),
	}
}

// loadCheckpoint retrieves the current indexing checkpoint from the store.
func (idx *Indexer) loadCheckpoint(ctx context.Context) (*models.Checkpoint, error) {
	return idx.store.GetCheckpoint(ctx)
}

// saveCheckpoint persists the current indexing checkpoint to the store.
func (idx *Indexer) saveCheckpoint(ctx context.Context, cp *models.Checkpoint) error {
	return idx.store.UpsertCheckpoint(ctx, cp)
}
