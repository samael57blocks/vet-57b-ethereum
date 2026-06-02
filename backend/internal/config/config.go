// Package config loads and validates the backend indexer configuration
// from environment variables. It provides sensible defaults for optional
// fields and fails fast on missing required values.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

// Config holds all configuration for the backend indexer service.
type Config struct {
	DatabaseURL        string        // required: postgres:// URI
	EthWsURL           string        // required: ws:// or wss:// URI
	EthHttpURL         string        // required: http:// or https:// URI
	VetRegistryAddress common.Address // required: hex address of VetRegistry contract
	Confirmations      uint64        // default: 12
	BackfillFromBlock  uint64        // default: 0
	Port               string        // default: "8080"
	CorsOrigin         string        // default: "http://localhost:5173"
	LogLevel           slog.Level    // default: slog.LevelInfo
	PoolMaxConns       int           // default: 10
	PoolMinConns       int           // default: 2
}

// envVar holds metadata for a single environment variable binding.
type envVar struct {
	Key          string
	Required     bool
	DefaultValue string
}

// Load reads configuration from environment variables, applies defaults,
// and validates required fields. It returns an error if any required
// variable is missing or if any value fails to parse.
func Load() (Config, error) {
	cfg := Config{}

	// --- Required string fields ---
	cfg.DatabaseURL = os.Getenv("DATABASE_URL")
	cfg.EthWsURL = os.Getenv("ETH_WS_URL")
	cfg.EthHttpURL = os.Getenv("ETH_HTTP_URL")

	// --- VetRegistryAddress (required, parsed from hex) ---
	addrStr := os.Getenv("VET_REGISTRY_ADDRESS")
	if addrStr == "" {
		return cfg, fmt.Errorf("VET_REGISTRY_ADDRESS: required env var is not set")
	}
	if !common.IsHexAddress(addrStr) {
		return cfg, fmt.Errorf("VET_REGISTRY_ADDRESS: %q is not a valid hex address", addrStr)
	}
	cfg.VetRegistryAddress = common.HexToAddress(addrStr)

	// --- Optional string fields ---
	cfg.Port = envOrDefault("PORT", "8080")
	cfg.CorsOrigin = envOrDefault("CORS_ORIGIN", "http://localhost:5173")

	// --- Optional uint64 fields ---
	var err error
	cfg.Confirmations, err = parseUint64Env("CONFIRMATIONS", 12)
	if err != nil {
		return cfg, err
	}
	cfg.BackfillFromBlock, err = parseUint64Env("BACKFILL_FROM_BLOCK", 0)
	if err != nil {
		return cfg, err
	}

	// --- Optional int fields ---
	cfg.PoolMaxConns, err = parseIntEnv("DB_POOL_MAX_CONNS", 10)
	if err != nil {
		return cfg, err
	}
	cfg.PoolMinConns, err = parseIntEnv("DB_POOL_MIN_CONNS", 2)
	if err != nil {
		return cfg, err
	}

	// --- Log level ---
	cfg.LogLevel, err = parseLogLevel(os.Getenv("LOG_LEVEL"))
	if err != nil {
		return cfg, err
	}

	// --- Validate required fields ---
	if err := validateRequired(cfg); err != nil {
		return cfg, err
	}

	return cfg, nil
}

// validateRequired checks that all required fields are set.
func validateRequired(cfg Config) error {
	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.EthWsURL == "" {
		missing = append(missing, "ETH_WS_URL")
	}
	if cfg.EthHttpURL == "" {
		missing = append(missing, "ETH_HTTP_URL")
	}
	// VetRegistryAddress is validated separately above; zero address indicates it was set.
	if cfg.VetRegistryAddress == (common.Address{}) {
		missing = append(missing, "VET_REGISTRY_ADDRESS")
	}
	if len(missing) > 0 {
		return fmt.Errorf("required env vars not set: %s", strings.Join(missing, ", "))
	}
	return nil
}

// envOrDefault returns the value of the env var if set, or the default.
func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// parseUint64Env reads a uint64 env var with a default value.
func parseUint64Env(key string, defaultVal uint64) (uint64, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return defaultVal, nil
	}
	v, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%s: cannot parse %q as uint64: %w", key, raw, err)
	}
	return v, nil
}

// parseIntEnv reads an int env var with a default value.
func parseIntEnv(key string, defaultVal int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return defaultVal, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s: cannot parse %q as int: %w", key, raw, err)
	}
	return v, nil
}

// parseLogLevel converts a LOG_LEVEL string to slog.Level.
// Accepted values: debug, info, warn, error (case-insensitive).
func parseLogLevel(raw string) (slog.Level, error) {
	if raw == "" {
		return slog.LevelInfo, nil
	}
	switch strings.ToLower(raw) {
	case "debug":
		return slog.LevelDebug, nil
	case "info":
		return slog.LevelInfo, nil
	case "warn":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("LOG_LEVEL: %q is not valid (accepted: debug, info, warn, error)", raw)
	}
}
