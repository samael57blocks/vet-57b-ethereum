package config

import (
	"log/slog"
	"os"
	"testing"
)

// clearEnv unsets all config-relevant env vars so tests start from a clean slate.
func clearEnv() {
	for _, key := range []string{
		"DATABASE_URL",
		"ETH_WS_URL",
		"ETH_HTTP_URL",
		"VET_REGISTRY_ADDRESS",
		"PORT",
		"CORS_ORIGIN",
		"CONFIRMATIONS",
		"BACKFILL_FROM_BLOCK",
		"LOG_LEVEL",
		"DB_POOL_MAX_CONNS",
		"DB_POOL_MIN_CONNS",
	} {
		os.Unsetenv(key)
	}
}

// setEnv sets multiple env vars from a map (for test setup).
func setEnv(vars map[string]string) {
	for k, v := range vars {
		os.Setenv(k, v)
	}
}

func TestLoad_Defaults(t *testing.T) {
	clearEnv()
	setEnv(map[string]string{
		"DATABASE_URL":         "postgres://localhost:5432/vet57b",
		"ETH_WS_URL":           "wss://sepolia.infura.io/ws/v3/test",
		"ETH_HTTP_URL":         "https://sepolia.infura.io/v3/test",
		"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
	})

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want %q", cfg.Port, "8080")
	}
	if cfg.CorsOrigin != "http://localhost:5173" {
		t.Errorf("CorsOrigin = %q, want %q", cfg.CorsOrigin, "http://localhost:5173")
	}
	if cfg.Confirmations != 12 {
		t.Errorf("Confirmations = %d, want %d", cfg.Confirmations, 12)
	}
	if cfg.BackfillFromBlock != 0 {
		t.Errorf("BackfillFromBlock = %d, want %d", cfg.BackfillFromBlock, 0)
	}
	if cfg.LogLevel != slog.LevelInfo {
		t.Errorf("LogLevel = %v, want %v", cfg.LogLevel, slog.LevelInfo)
	}
	if cfg.PoolMaxConns != 10 {
		t.Errorf("PoolMaxConns = %d, want %d", cfg.PoolMaxConns, 10)
	}
	if cfg.PoolMinConns != 2 {
		t.Errorf("PoolMinConns = %d, want %d", cfg.PoolMinConns, 2)
	}
}

func TestLoad_OverrideDefaults(t *testing.T) {
	clearEnv()
	setEnv(map[string]string{
		"DATABASE_URL":         "postgres://user:pass@remote:5432/db",
		"ETH_WS_URL":           "ws://localhost:8546",
		"ETH_HTTP_URL":         "http://localhost:8545",
		"VET_REGISTRY_ADDRESS": "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
		"PORT":                 "3000",
		"CORS_ORIGIN":          "https://app.example.com",
		"CONFIRMATIONS":        "3",
		"BACKFILL_FROM_BLOCK":  "1000000",
		"LOG_LEVEL":            "debug",
		"DB_POOL_MAX_CONNS":    "20",
		"DB_POOL_MIN_CONNS":    "5",
	})

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	tests := []struct {
		name string
		got  any
		want any
	}{
		{"Port", cfg.Port, "3000"},
		{"CorsOrigin", cfg.CorsOrigin, "https://app.example.com"},
		{"Confirmations", cfg.Confirmations, uint64(3)},
		{"BackfillFromBlock", cfg.BackfillFromBlock, uint64(1000000)},
		{"LogLevel", cfg.LogLevel, slog.LevelDebug},
		{"PoolMaxConns", cfg.PoolMaxConns, 20},
		{"PoolMinConns", cfg.PoolMinConns, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.want {
				t.Errorf("got %v, want %v", tt.got, tt.want)
			}
		})
	}
}

func TestLoad_MissingRequired(t *testing.T) {
	tests := []struct {
		name      string
		missing   string // which required var to leave unset
		setOthers map[string]string
	}{
		{
			name:    "missing DATABASE_URL",
			missing: "DATABASE_URL",
			setOthers: map[string]string{
				"ETH_WS_URL":           "wss://eth.example.com",
				"ETH_HTTP_URL":         "https://eth.example.com",
				"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
			},
		},
		{
			name:    "missing ETH_WS_URL",
			missing: "ETH_WS_URL",
			setOthers: map[string]string{
				"DATABASE_URL":         "postgres://localhost:5432/db",
				"ETH_HTTP_URL":         "https://eth.example.com",
				"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
			},
		},
		{
			name:    "missing ETH_HTTP_URL",
			missing: "ETH_HTTP_URL",
			setOthers: map[string]string{
				"DATABASE_URL":         "postgres://localhost:5432/db",
				"ETH_WS_URL":           "wss://eth.example.com",
				"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
			},
		},
		{
			name:    "missing VET_REGISTRY_ADDRESS",
			missing: "VET_REGISTRY_ADDRESS",
			setOthers: map[string]string{
				"DATABASE_URL": "postgres://localhost:5432/db",
				"ETH_WS_URL":   "wss://eth.example.com",
				"ETH_HTTP_URL": "https://eth.example.com",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clearEnv()
			setEnv(tt.setOthers)
			os.Unsetenv(tt.missing) // ensure it's really unset

			_, err := Load()
			if err == nil {
				t.Fatal("Load() expected error, got nil")
			}
		})
	}
}

func TestLoad_MissingAllRequired(t *testing.T) {
	clearEnv()

	_, err := Load()
	if err == nil {
		t.Fatal("Load() expected error when all required vars are missing, got nil")
	}
}

func TestLoad_InvalidAddress(t *testing.T) {
	clearEnv()
	setEnv(map[string]string{
		"DATABASE_URL":         "postgres://localhost:5432/db",
		"ETH_WS_URL":           "wss://eth.example.com",
		"ETH_HTTP_URL":         "https://eth.example.com",
		"VET_REGISTRY_ADDRESS": "not-a-valid-address",
	})

	_, err := Load()
	if err == nil {
		t.Fatal("Load() expected error for invalid hex address, got nil")
	}
}

func TestLoad_ParseErrors(t *testing.T) {
	tests := []struct {
		name    string
		envVar  string
		rawVal  string
		others  map[string]string
		wantErr bool
	}{
		{
			name:   "CONFIRMATIONS not a number",
			envVar: "CONFIRMATIONS",
			rawVal: "twelve",
			others: map[string]string{
				"DATABASE_URL":         "postgres://localhost:5432/db",
				"ETH_WS_URL":           "wss://eth.example.com",
				"ETH_HTTP_URL":         "https://eth.example.com",
				"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantErr: true,
		},
		{
			name:   "BACKFILL_FROM_BLOCK negative",
			envVar: "BACKFILL_FROM_BLOCK",
			rawVal: "-1",
			others: map[string]string{
				"DATABASE_URL":         "postgres://localhost:5432/db",
				"ETH_WS_URL":           "wss://eth.example.com",
				"ETH_HTTP_URL":         "https://eth.example.com",
				"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantErr: true,
		},
		{
			name:   "LOG_LEVEL invalid",
			envVar: "LOG_LEVEL",
			rawVal: "trace",
			others: map[string]string{
				"DATABASE_URL":         "postgres://localhost:5432/db",
				"ETH_WS_URL":           "wss://eth.example.com",
				"ETH_HTTP_URL":         "https://eth.example.com",
				"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantErr: true,
		},
		{
			name:   "DB_POOL_MAX_CONNS not a number",
			envVar: "DB_POOL_MAX_CONNS",
			rawVal: "lots",
			others: map[string]string{
				"DATABASE_URL":         "postgres://localhost:5432/db",
				"ETH_WS_URL":           "wss://eth.example.com",
				"ETH_HTTP_URL":         "https://eth.example.com",
				"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantErr: true,
		},
		{
			name:   "DB_POOL_MIN_CONNS not a number",
			envVar: "DB_POOL_MIN_CONNS",
			rawVal: "",
			others: map[string]string{
				"DATABASE_URL":         "postgres://localhost:5432/db",
				"ETH_WS_URL":           "wss://eth.example.com",
				"ETH_HTTP_URL":         "https://eth.example.com",
				"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
				"DB_POOL_MAX_CONNS":    "5",
			},
			wantErr: false, // empty = use default
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clearEnv()
			setEnv(tt.others)
			os.Setenv(tt.envVar, tt.rawVal)

			_, err := Load()
			if tt.wantErr && err == nil {
				t.Fatalf("Load() expected error for %s=%q, got nil", tt.envVar, tt.rawVal)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("Load() unexpected error: %v", err)
			}
		})
	}
}

func TestLoad_RequiredFieldsSet(t *testing.T) {
	clearEnv()
	setEnv(map[string]string{
		"DATABASE_URL":         "postgres://localhost:5432/vet57b",
		"ETH_WS_URL":           "wss://sepolia.infura.io/ws/v3/test",
		"ETH_HTTP_URL":         "https://sepolia.infura.io/v3/test",
		"VET_REGISTRY_ADDRESS": "0x1234567890abcdef1234567890abcdef12345678",
	})

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}

	if cfg.DatabaseURL != "postgres://localhost:5432/vet57b" {
		t.Errorf("DatabaseURL = %q, want %q", cfg.DatabaseURL, "postgres://localhost:5432/vet57b")
	}
	if cfg.EthWsURL != "wss://sepolia.infura.io/ws/v3/test" {
		t.Errorf("EthWsURL = %q, want %q", cfg.EthWsURL, "wss://sepolia.infura.io/ws/v3/test")
	}
	if cfg.EthHttpURL != "https://sepolia.infura.io/v3/test" {
		t.Errorf("EthHttpURL = %q, want %q", cfg.EthHttpURL, "https://sepolia.infura.io/v3/test")
	}
	expected := "0x1234567890AbcdEF1234567890aBcdef12345678"
	if cfg.VetRegistryAddress.Hex() != expected {
		t.Errorf("VetRegistryAddress = %s, want %s", cfg.VetRegistryAddress.Hex(), expected)
	}
}
