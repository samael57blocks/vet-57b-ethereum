// Package ethclient provides a Client interface for Ethereum RPC interactions
// with WebSocket subscription (primary) and HTTP polling (fallback) with
// exponential backoff reconnection.
package ethclient

import (
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	gethclient "github.com/ethereum/go-ethereum/ethclient"
)

const (
	initialBackoff = 1 * time.Second
	maxBackoff     = 30 * time.Second
	pollInterval   = 5 * time.Second
	dialTimeout    = 10 * time.Second
)

// Client defines the interface for Ethereum RPC interactions used by the indexer.
type Client interface {
	// SubscribeLogs returns a channel of logs for the given contract address.
	// Uses WebSocket subscription, falling back to HTTP polling with exponential
	// backoff WS reconnection on failure.
	SubscribeLogs(ctx context.Context, address common.Address) (<-chan types.Log, error)

	// FilterLogs fetches all logs for the given address in the specified block range via HTTP.
	FilterLogs(ctx context.Context, address common.Address, fromBlock, toBlock uint64) ([]types.Log, error)

	// BlockNumber returns the latest block number via HTTP.
	BlockNumber(ctx context.Context) (uint64, error)

	// BlockByNumber returns the block at the given number via HTTP.
	BlockByNumber(ctx context.Context, number *big.Int) (*types.Block, error)

	// Close shuts down both RPC clients.
	Close()
}

// compile-time check that clientImpl implements Client.
var _ Client = (*clientImpl)(nil)

// clientImpl implements Client with WebSocket as the primary transport
// and HTTP polling as a fallback when the WS connection drops.
type clientImpl struct {
	wsURL   string
	httpURL string

	wsMu      sync.RWMutex
	wsClient  *gethclient.Client
	httpClient *gethclient.Client

	closeOnce sync.Once
	closed    chan struct{}
}

// NewClient creates a new Client, dialing both WS and HTTP endpoints.
// An initial WS dial failure is logged but treated as non-fatal — the client
// will attempt reconnection with exponential backoff when SubscribeLogs is called.
func NewClient(wsURL, httpURL string) (Client, error) {
	httpClient, err := gethclient.DialContext(context.Background(), httpURL)
	if err != nil {
		return nil, fmt.Errorf("dial http rpc: %w", err)
	}

	wsClient, err := gethclient.DialContext(context.Background(), wsURL)
	if err != nil {
		slog.Warn("ethclient: initial WS dial failed, will retry later", "url", wsURL, "err", err)
		wsClient = nil
	}

	return &clientImpl{
		wsURL:      wsURL,
		httpURL:    httpURL,
		wsClient:   wsClient,
		httpClient: httpClient,
		closed:     make(chan struct{}),
	}, nil
}

// Close shuts down both RPC clients safely (idempotent).
func (c *clientImpl) Close() {
	c.closeOnce.Do(func() {
		close(c.closed)
		if c.wsClient != nil {
			c.wsClient.Close()
		}
		c.httpClient.Close()
	})
}

// BlockNumber returns the current block number via the HTTP client.
func (c *clientImpl) BlockNumber(ctx context.Context) (uint64, error) {
	return c.httpClient.BlockNumber(ctx)
}

// BlockByNumber returns the block at the given number via the HTTP client.
func (c *clientImpl) BlockByNumber(ctx context.Context, number *big.Int) (*types.Block, error) {
	return c.httpClient.BlockByNumber(ctx, number)
}

// FilterLogs fetches logs for the given contract address within the specified
// block range using the HTTP client.
func (c *clientImpl) FilterLogs(ctx context.Context, address common.Address, fromBlock, toBlock uint64) ([]types.Log, error) {
	query := ethereum.FilterQuery{
		Addresses: []common.Address{address},
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(toBlock),
	}
	return c.httpClient.FilterLogs(ctx, query)
}

// SubscribeLogs subscribes to logs for the given contract address and returns
// a channel that receives log entries. It uses WebSocket subscription as the
// primary transport. If the WS connection fails or drops, it falls back to
// HTTP polling with concurrent WS reconnection attempts using exponential
// backoff (1s → 5s → 30s max). The channel is closed when the context is
// cancelled or Close() is called.
func (c *clientImpl) SubscribeLogs(ctx context.Context, address common.Address) (<-chan types.Log, error) {
	out := make(chan types.Log, 200)
	query := ethereum.FilterQuery{
		Addresses: []common.Address{address},
	}
	go c.subscriptionLoop(ctx, query, out)
	return out, nil
}

// subscriptionLoop manages the WS subscription lifecycle with automatic
// failover to HTTP polling.
func (c *clientImpl) subscriptionLoop(ctx context.Context, query ethereum.FilterQuery, out chan<- types.Log) {
	defer close(out)

	backoff := initialBackoff

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.closed:
			return
		default:
		}

		// Try WS subscription
		if err := c.tryWSSubscription(ctx, query, out); err != nil {
			slog.Warn("ethclient: WS subscription ended", "err", err)
		} else {
			return // context cancelled or client closed
		}

		// Fall back to HTTP polling with reconnect attempts
		c.pollWithReconnect(ctx, query, out, &backoff)

		select {
		case <-ctx.Done():
			return
		case <-c.closed:
			return
		default:
			// Continue loop to retry WS subscription
		}
	}
}

// tryWSSubscription subscribes to logs via WebSocket and streams them to the
// output channel until the subscription fails or the context is cancelled.
func (c *clientImpl) tryWSSubscription(ctx context.Context, query ethereum.FilterQuery, out chan<- types.Log) error {
	c.wsMu.RLock()
	ws := c.wsClient
	c.wsMu.RUnlock()

	if ws == nil {
		return fmt.Errorf("ws client not connected")
	}

	logs := make(chan types.Log, 200)
	sub, err := ws.SubscribeFilterLogs(ctx, query, logs)
	if err != nil {
		return fmt.Errorf("ws subscribe: %w", err)
	}
	defer sub.Unsubscribe()

	slog.Info("ethclient: WS subscription active")

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-c.closed:
			return nil
		case err := <-sub.Err():
			if err != nil {
				return fmt.Errorf("ws subscription: %w", err)
			}
			return nil
		case log := <-logs:
			select {
			case out <- log:
			default:
				slog.Warn("ethclient: dropping log, channel full", "block", log.BlockNumber)
			}
		}
	}
}

// pollWithReconnect performs HTTP polling for new logs while concurrently
// attempting to reconnect the WebSocket connection with exponential backoff.
// Returns when the WS connection is restored or the context is cancelled.
func (c *clientImpl) pollWithReconnect(ctx context.Context, query ethereum.FilterQuery, out chan<- types.Log, backoff *time.Duration) {
	lastBlock := uint64(0)
	pollTicker := time.NewTicker(pollInterval)
	defer pollTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-c.closed:
			return
		default:
		}

		// If WS reconnected, return so the outer loop retries subscription
		if c.wsConnected() {
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-c.closed:
			return
		case <-pollTicker.C:
		}

		// Poll for new blocks
		blockNum, err := c.httpClient.BlockNumber(ctx)
		if err != nil {
			slog.Warn("ethclient: poll block number failed", "err", err)
			continue
		}

		if blockNum > lastBlock {
			q := ethereum.FilterQuery{
				Addresses: query.Addresses,
				FromBlock: new(big.Int).SetUint64(lastBlock + 1),
				ToBlock:   new(big.Int).SetUint64(blockNum),
			}
			logs, err := c.httpClient.FilterLogs(ctx, q)
			if err != nil {
				slog.Warn("ethclient: poll filter logs failed", "err", err)
				continue
			}
			for _, l := range logs {
				select {
				case out <- l:
				default:
					slog.Warn("ethclient: dropping log in poll, channel full", "block", l.BlockNumber)
				}
			}
			lastBlock = blockNum
		}

		// Attempt WS reconnection
		if err := c.tryReconnect(ctx); err != nil {
			*backoff = min(*backoff*2, maxBackoff)
		} else {
			*backoff = initialBackoff
			return
		}
	}
}

// wsConnected reports whether the WS client is currently connected.
func (c *clientImpl) wsConnected() bool {
	c.wsMu.RLock()
	defer c.wsMu.RUnlock()
	return c.wsClient != nil
}

// tryReconnect dials the WS endpoint and replaces the existing wsClient on success.
func (c *clientImpl) tryReconnect(ctx context.Context) error {
	dialCtx, cancel := context.WithTimeout(ctx, dialTimeout)
	defer cancel()

	newClient, err := gethclient.DialContext(dialCtx, c.wsURL)
	if err != nil {
		return err
	}

	c.wsMu.Lock()
	if c.wsClient != nil {
		c.wsClient.Close()
	}
	c.wsClient = newClient
	c.wsMu.Unlock()

	slog.Info("ethclient: WS reconnected")
	return nil
}
