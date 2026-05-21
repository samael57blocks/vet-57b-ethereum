// Package main is the entrypoint for the backend indexer binary.
// It wires together configuration, database, Ethereum RPC client, indexer
// loop, and REST API server, then runs until SIGTERM/SIGINT.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"vet-57b/backend/internal/api"
	"vet-57b/backend/internal/config"
	"vet-57b/backend/internal/ethclient"
	"vet-57b/backend/internal/indexer"
	"vet-57b/backend/internal/store"
)

func main() {
	// 1. Load config — fail fast if required vars are missing
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// 2. Set structured log level
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	})))

	// 3. Connect to PostgreSQL (store.New creates the pgx pool and pings it)
	ctx := context.Background()
	st, err := store.New(ctx, cfg.DatabaseURL, cfg.PoolMaxConns, cfg.PoolMinConns)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer st.Close()

	// 4. Run database migrations from the migrations directory
	m, err := migrate.New("file://migrations", cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to create migrator", "error", err)
		os.Exit(1)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}
	m.Close()
	slog.Info("database migrations applied")

	// 5. Connect to Ethereum RPC (WS primary, HTTP fallback)
	ethClient, err := ethclient.NewClient(cfg.EthWsURL, cfg.EthHttpURL)
	if err != nil {
		slog.Error("failed to create Ethereum client", "error", err)
		os.Exit(1)
	}
	defer ethClient.Close()

	// 6. Create the indexer and run it in a background goroutine
	idx := indexer.New(&cfg, ethClient, st)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		slog.Info("starting indexer loop")
		if err := idx.Run(ctx); err != nil {
			slog.Error("indexer exited with error", "error", err)
		}
		cancel() // trigger shutdown if indexer stops unexpectedly
	}()

	// 7. Create and start the REST API server
	router := api.NewRouter(&cfg, st)
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		slog.Info("starting HTTP server", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
			cancel()
		}
	}()

	// 8. Wait for SIGTERM or SIGINT, then shut down gracefully
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	sig := <-sigCh
	slog.Info("received signal, shutting down", "signal", sig.String())

	// Stop the indexer loop first
	cancel()

	// Give the HTTP server up to 30 seconds to drain
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP server shutdown error", "error", err)
	}

	slog.Info("shutdown complete")
}
