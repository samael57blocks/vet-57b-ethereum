// Package indexer implements the core indexing loop that processes blockchain
// events from the VetRegistry contract and persists them to the database.
//
// The indexer runs in three phases:
//  1. Load checkpoint — resume from where we left off
//  2. Backfill — scan historical blocks for events before CONFIRMATIONS depth
//  3. Live loop — subscribe to new logs via WebSocket with HTTP polling fallback
//
// Reorg detection runs on a periodic ticker, verifying block hashes at the
// finalized depth and rolling back + refetching on mismatch.
package indexer

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/core/types"

	"vet-57b/backend/internal/ethclient"
	"vet-57b/backend/internal/models"
)

const (
	// backfillBatchSize is the block range per FilterLogs call during backfill.
	backfillBatchSize = 2000

	// pollInterval is how often the HTTP polling fallback runs.
	pollInterval = 5 * time.Second

	// reorgMinInterval is the minimum time between reorg checks.
	reorgMinInterval = 30 * time.Second

	// maxTrackedBlocks is the maximum number of block hashes kept in memory
	// for reorg detection. Old entries are pruned as we advance.
	maxTrackedBlocks = 200

	// pruneOffset keeps tracked block hashes within this distance of the
	// latest seen block.
	pruneOffset = 100
)

// Run starts the main indexing loop. It loads the persisted checkpoint,
// optionally backfills historical events, then enters the live loop with
// WebSocket subscription, HTTP polling fallback, and periodic reorg checks.
// Run blocks until ctx is cancelled, then saves the checkpoint and returns.
func (idx *Indexer) Run(ctx context.Context) error {
	l := slog.With("component", "indexer")
	l.Info("starting indexer")

	// --- Phase 1: get current block and load checkpoint ---
	current, err := idx.client.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("indexer: get block number: %w", err)
	}
	idx.setCurrentBlock(current)

	cp, err := idx.loadCheckpoint(ctx)
	if err != nil {
		return fmt.Errorf("indexer: load checkpoint: %w", err)
	}
	if cp == nil {
		cp = &models.Checkpoint{}
	}

	// --- Phase 2: backfill if this is a fresh start ---
	if cp.LastFetchedBlock == 0 {
		target := current
		if target > idx.cfg.Confirmations {
			target -= idx.cfg.Confirmations
		}
		if idx.cfg.BackfillFromBlock < target {
			l.Info("starting backfill",
				"from", idx.cfg.BackfillFromBlock,
				"to", target,
			)
			if err := idx.backfill(ctx, idx.cfg.BackfillFromBlock, target); err != nil {
				return fmt.Errorf("indexer: backfill: %w", err)
			}
			l.Info("backfill complete")

			// Reload checkpoint after backfill
			cp, err = idx.loadCheckpoint(ctx)
			if err != nil {
				return fmt.Errorf("indexer: reload checkpoint: %w", err)
			}
			if cp == nil {
				cp = &models.Checkpoint{}
			}
		}
	}

	// --- Phase 3: live loop ---
	logCh, err := idx.client.SubscribeLogs(ctx, idx.cfg.VetRegistryAddress)
	if err != nil {
		return fmt.Errorf("indexer: subscribe logs: %w", err)
	}

	pollTicker := time.NewTicker(pollInterval)
	defer pollTicker.Stop()

	reorgInterval := time.Duration(idx.cfg.Confirmations) * 12 * time.Second
	if reorgInterval < reorgMinInterval {
		reorgInterval = reorgMinInterval
	}
	reorgTicker := time.NewTicker(reorgInterval)
	defer reorgTicker.Stop()

	l.Info("entering live loop",
		"last_fetched_block", cp.LastFetchedBlock,
		"last_finalized_block", cp.LastFinalizedBlock,
		"confirmations", idx.cfg.Confirmations,
	)

	for {
		select {
		case <-ctx.Done():
			l.Info("shutting down, saving checkpoint")
			if saveErr := idx.saveCheckpoint(ctx, cp); saveErr != nil {
				l.Error("failed to save checkpoint on shutdown", "err", saveErr)
			}
			return nil

		case log := <-logCh:
			// Single log from WS subscription — process if confirmed
			if !idx.isConfirmed(log.BlockNumber) {
				continue
			}
			idx.decodeAndUpsert(ctx, log)
			idx.trackBlockHash(ctx, log)
			if log.BlockNumber > cp.LastFetchedBlock {
				cp.LastFetchedBlock = log.BlockNumber
			}

		case <-pollTicker.C:
			idx.refreshCurrentBlock(ctx)
			idx.pollNewLogs(ctx, cp)

		case <-reorgTicker.C:
			idx.detectReorg(ctx, cp)
		}
	}
}

// backfill scans historical blocks from `from` to `to` (inclusive) in batches
// of backfillBatchSize blocks, processing all events found. All events in
// this range are already at CONFIRMATIONS depth, so the confirmation check is
// skipped. The checkpoint is saved after every batch for crash resilience.
func (idx *Indexer) backfill(ctx context.Context, from, to uint64) error {
	l := slog.With("component", "indexer")

	for from <= to {
		batchEnd := from + backfillBatchSize - 1
		if batchEnd > to {
			batchEnd = to
		}

		logs, err := idx.client.FilterLogs(ctx, idx.cfg.VetRegistryAddress, from, batchEnd)
		if err != nil {
			return fmt.Errorf("backfill [%d,%d]: %w", from, batchEnd, err)
		}

		if len(logs) > 0 {
			l.Info("backfill batch", "from", from, "to", batchEnd, "logs", len(logs))
			for _, log := range logs {
				idx.decodeAndUpsert(ctx, log)
				idx.trackBlockHash(ctx, log)
			}
		}

		// Save checkpoint after each batch
		cp := &models.Checkpoint{
			LastFinalizedBlock: batchEnd,
			LastFetchedBlock:   batchEnd,
		}
		if err := idx.saveCheckpoint(ctx, cp); err != nil {
			return fmt.Errorf("backfill save checkpoint: %w", err)
		}

		from = batchEnd + 1
	}

	return nil
}

// pollNewLogs fetches logs from the last fetched block up to the currently
// confirmed block (current - CONFIRMATIONS) via HTTP FilterLogs. This serves
// as both the confirmation mechanism (events seen via WS but not yet
// confirmed are processed here) and the WS fallback.
func (idx *Indexer) pollNewLogs(ctx context.Context, cp *models.Checkpoint) {
	current := idx.getCurrentBlock()
	if current <= idx.cfg.Confirmations {
		return
	}
	confirmedTo := current - idx.cfg.Confirmations
	if confirmedTo <= cp.LastFetchedBlock {
		return
	}

	from := cp.LastFetchedBlock + 1

	logs, err := idx.client.FilterLogs(ctx, idx.cfg.VetRegistryAddress, from, confirmedTo)
	if err != nil {
		slog.Warn("indexer: poll FilterLogs failed",
			"from", from, "to", confirmedTo, "err", err,
		)
		return
	}

	for _, log := range logs {
		idx.decodeAndUpsert(ctx, log)
		idx.trackBlockHash(ctx, log)
	}

	// Advance both checkpoint markers to the newly confirmed block
	if confirmedTo > cp.LastFinalizedBlock {
		cp.LastFinalizedBlock = confirmedTo
	}
	if confirmedTo > cp.LastFetchedBlock {
		cp.LastFetchedBlock = confirmedTo
	}
}

// decodeAndUpsert dispatches the log to the correct event parser based on
// topic[0] (event signature hash), decodes it into a domain model, and
// persists it to the store. Four event types are handled:
//
//   - MedicalRecordCreated      → UpsertPet
//   - MedicalAppointmentCreated → UpsertAppointment
//   - AppointmentPaidToken      → UpdateAppointmentPaidValue (adds amount)
//   - AppointmentPaidEth        → UpdateAppointmentPaidValue (adds amount)
//
// Unknown event signatures are logged at warn level and skipped.
func (idx *Indexer) decodeAndUpsert(ctx context.Context, log types.Log) {
	switch log.Topics[0] {
	case ethclient.MedicalRecordCreatedSig:
		event, err := ethclient.ParseMedicalRecordCreated(log)
		if err != nil {
			slog.Error("indexer: parse MedicalRecordCreated",
				"err", err, "tx", log.TxHash.Hex(),
			)
			return
		}
		animalType := "Dog"
		if event.AnimalType == 1 {
			animalType = "Cat"
		}
		pet := &models.Pet{
			ID:             event.Id.Uint64(),
			Name:           event.Name,
			Age:            event.Age,
			AnimalType:     animalType,
			CaretakerName:  event.CaretakerName,
			CaretakerPhone: event.CaretakerPhone,
			TxHash:         log.TxHash.Bytes(),
			LogIndex:       uint(log.Index),
			BlockNumber:    log.BlockNumber,
		}
		if err := idx.store.UpsertPet(ctx, pet); err != nil {
			slog.Error("indexer: upsert pet", "err", err, "id", pet.ID)
			return
		}
		slog.Info("indexer: upserted pet",
			"id", pet.ID, "name", pet.Name, "block", pet.BlockNumber,
		)

	case ethclient.MedicalAppointmentCreatedSig:
		event, err := ethclient.ParseMedicalAppointmentCreated(log)
		if err != nil {
			slog.Error("indexer: parse MedicalAppointmentCreated",
				"err", err, "tx", log.TxHash.Hex(),
			)
			return
		}
		appt := &models.Appointment{
			ID:               event.Id.Uint64(),
			PetID:            event.PetId.Uint64(),
			Date:             event.Date.Int64(),
			TimeStr:          event.Time,
			AppointmentValue: event.AppointmentValue.String(),
			PaidValue:        "0",
			TxHash:           log.TxHash.Bytes(),
			LogIndex:         uint(log.Index),
			BlockNumber:      log.BlockNumber,
		}
		if err := idx.store.UpsertAppointment(ctx, appt); err != nil {
			slog.Error("indexer: upsert appointment",
				"err", err, "id", appt.ID,
			)
			return
		}
		slog.Info("indexer: upserted appointment",
			"id", appt.ID, "pet_id", appt.PetID, "block", appt.BlockNumber,
		)

	case ethclient.AppointmentPaidTokenSig:
		event, err := ethclient.ParseAppointmentPaidToken(log)
		if err != nil {
			slog.Error("indexer: parse AppointmentPaidToken",
				"err", err, "tx", log.TxHash.Hex(),
			)
			return
		}
		if err := idx.store.UpdateAppointmentPaidValue(
			ctx, event.AppointmentId.Uint64(), event.Amount.String(),
		); err != nil {
			slog.Error("indexer: update paid value (token)",
				"err", err, "appointment_id", event.AppointmentId,
			)
			return
		}
		slog.Info("indexer: updated paid value (token)",
			"appointment_id", event.AppointmentId, "amount", event.Amount,
		)

	case ethclient.AppointmentPaidEthSig:
		event, err := ethclient.ParseAppointmentPaidEth(log)
		if err != nil {
			slog.Error("indexer: parse AppointmentPaidEth",
				"err", err, "tx", log.TxHash.Hex(),
			)
			return
		}
		if err := idx.store.UpdateAppointmentPaidValue(
			ctx, event.AppointmentId.Uint64(), event.EthAmount.String(),
		); err != nil {
			slog.Error("indexer: update paid value (eth)",
				"err", err, "appointment_id", event.AppointmentId,
			)
			return
		}
		slog.Info("indexer: updated paid value (eth)",
			"appointment_id", event.AppointmentId, "amount", event.EthAmount,
		)

	default:
		slog.Warn("indexer: unknown event sig",
			"sig", log.Topics[0].Hex(), "tx", log.TxHash.Hex(),
		)
	}
}

// isConfirmed reports whether the given block number has reached
// CONFIRMATIONS depth relative to the cached current block.
func (idx *Indexer) isConfirmed(blockNumber uint64) bool {
	current := idx.getCurrentBlock()
	if current < idx.cfg.Confirmations {
		return false
	}
	return current >= blockNumber+idx.cfg.Confirmations
}

// trackBlockHash fetches and remembers the hash for the given log's block.
// This is used during reorg detection to verify the chain hasn't changed at
// the finalized depth. The map is pruned to prevent unbounded growth.
func (idx *Indexer) trackBlockHash(ctx context.Context, log types.Log) {
	idx.mu.RLock()
	_, exists := idx.blockHashes[log.BlockNumber]
	idx.mu.RUnlock()
	if exists {
		return
	}

	block, err := idx.client.BlockByNumber(ctx, new(big.Int).SetUint64(log.BlockNumber))
	if err != nil {
		slog.Warn("indexer: track block hash failed",
			"block", log.BlockNumber, "err", err,
		)
		return
	}

	idx.mu.Lock()
	if _, exists := idx.blockHashes[log.BlockNumber]; !exists {
		idx.blockHashes[log.BlockNumber] = block.Hash()
		// Prune old entries to keep the map bounded
		if len(idx.blockHashes) > maxTrackedBlocks {
			for bn := range idx.blockHashes {
				if bn < log.BlockNumber-pruneOffset {
					delete(idx.blockHashes, bn)
				}
			}
		}
	}
	idx.mu.Unlock()
}

// detectReorg checks whether the chain tip at the finalized depth has
// changed. It compares the current block hash for the checkpoint's
// LastFinalizedBlock with the hash we recorded when we first saw it.
// On mismatch it walks back to find the fork point, deletes events from
// that point forward, and refetches from the fork block.
func (idx *Indexer) detectReorg(ctx context.Context, cp *models.Checkpoint) {
	if cp.LastFinalizedBlock == 0 {
		return
	}

	l := slog.With("component", "indexer")
	block, err := idx.client.BlockByNumber(ctx, new(big.Int).SetUint64(cp.LastFinalizedBlock))
	if err != nil {
		l.Warn("reorg check: failed to fetch block",
			"block", cp.LastFinalizedBlock, "err", err,
		)
		return
	}

	idx.mu.RLock()
	storedHash, ok := idx.blockHashes[cp.LastFinalizedBlock]
	idx.mu.RUnlock()

	if !ok {
		// First time seeing this block hash — store for future checks
		idx.mu.Lock()
		idx.blockHashes[cp.LastFinalizedBlock] = block.Hash()
		idx.mu.Unlock()
		return
	}

	if storedHash == block.Hash() {
		return // Chain is consistent
	}

	// --- Reorg detected ---
	l.Warn("reorg detected at finalized block",
		"block", cp.LastFinalizedBlock,
		"expected_hash", storedHash.Hex(),
		"actual_hash", block.Hash().Hex(),
	)

	// Walk back to find the fork point — the last block whose hash matches
	forkBlock := cp.LastFinalizedBlock
	for forkBlock > 0 {
		prevBlock, err := idx.client.BlockByNumber(ctx, new(big.Int).SetUint64(forkBlock-1))
		if err != nil {
			l.Error("reorg walk: failed to fetch block",
				"block", forkBlock-1, "err", err,
			)
			return
		}

		idx.mu.RLock()
		expectedPrevHash, hasPrev := idx.blockHashes[forkBlock-1]
		idx.mu.RUnlock()

		if hasPrev && prevBlock.Hash() == expectedPrevHash {
			break // forkBlock is the first diverged block
		}
		forkBlock--
	}

	l.Info("reorg: fork point found", "fork_block", forkBlock)

	// Delete events from forkBlock onward (DeleteEventsAfterBlock is strict >)
	deleted, err := idx.store.DeleteEventsAfterBlock(ctx, forkBlock-1)
	if err != nil {
		l.Error("reorg: delete failed", "err", err)
		return
	}
	l.Info("reorg: deleted events for refetch", "count", deleted)

	// Clear tracked hashes from forkBlock onward
	idx.mu.Lock()
	for bn := range idx.blockHashes {
		if bn >= forkBlock {
			delete(idx.blockHashes, bn)
		}
	}
	idx.mu.Unlock()

	// Refetch from forkBlock
	current := idx.getCurrentBlock()
	confirmedTo := current
	if confirmedTo > idx.cfg.Confirmations {
		confirmedTo -= idx.cfg.Confirmations
	}

	if forkBlock <= confirmedTo {
		if err := idx.backfill(ctx, forkBlock, confirmedTo); err != nil {
			l.Error("reorg: refetch failed", "err", err)
			return
		}
	}

	// Update checkpoint — we know forkBlock-1 is safe
	if forkBlock-1 > cp.LastFinalizedBlock {
		cp.LastFinalizedBlock = forkBlock - 1
	}
	if forkBlock-1 > cp.LastFetchedBlock {
		cp.LastFetchedBlock = forkBlock - 1
	}

	l.Info("reorg: recovery complete",
		"last_finalized_block", cp.LastFinalizedBlock,
	)
}

// refreshCurrentBlock updates the cached current block number.
func (idx *Indexer) refreshCurrentBlock(ctx context.Context) {
	block, err := idx.client.BlockNumber(ctx)
	if err != nil {
		slog.Warn("indexer: refresh block number failed", "err", err)
		return
	}
	idx.setCurrentBlock(block)
}

func (idx *Indexer) setCurrentBlock(n uint64) {
	idx.mu.Lock()
	defer idx.mu.Unlock()
	idx.currentBlock = n
}

func (idx *Indexer) getCurrentBlock() uint64 {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return idx.currentBlock
}
