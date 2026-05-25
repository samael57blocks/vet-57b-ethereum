#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  dev.sh — One-command dev environment for Vet57B
#
#  Starts Hardhat node (if not running), deploys contracts,
#  starts PostgreSQL + indexer via Docker Compose, updates
#  web-app/.env, and launches Vite.
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_APP_DIR="$ROOT_DIR/web-app"
ENV_FILE="$WEB_APP_DIR/.env"
ENV_EXAMPLE="$WEB_APP_DIR/.env.example"
HARDHAT_NODE_PID=""
INDEXER_PID=""
HARDHAT_PORT=8545
BACKEND_PORT=8080

# ── helpers ──────────────────────────────────────────────────
cleanup() {
    local exit_code=$?
    echo ""
    echo "🧹 Cleaning up..."

    # Stop indexer
    if [ -n "$INDEXER_PID" ] && kill -0 "$INDEXER_PID" 2>/dev/null; then
        echo "   Stopping indexer (PID $INDEXER_PID)..."
        kill "$INDEXER_PID" 2>/dev/null || true
        wait "$INDEXER_PID" 2>/dev/null || true
    fi

    # Stop Docker Compose (postgres + indexer container)
    echo "   Stopping Docker services..."
    cd "$ROOT_DIR"
    docker compose down --remove-orphans 2>/dev/null || true

    # Stop Hardhat node
    if [ -n "$HARDHAT_NODE_PID" ] && kill -0 "$HARDHAT_NODE_PID" 2>/dev/null; then
        echo "   Stopping Hardhat node (PID $HARDHAT_NODE_PID)..."
        kill "$HARDHAT_NODE_PID" 2>/dev/null || true
        wait "$HARDHAT_NODE_PID" 2>/dev/null || true
    fi

    exit "$exit_code"
}
trap cleanup EXIT INT TERM

log()  { printf "  \033[1;34m•\033[0m %s\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
fail() { printf "  \033[1;31m✗\033[0m %s\n" "$*"; exit 1; }

# ── 0. Reset database — fresh state for each dev run ──────────
reset_database() {
    log "Resetting PostgreSQL database (docker compose down -v)..."
    cd "$ROOT_DIR"
    sudo docker compose down -v --remove-orphans 2>/dev/null || true
    ok "Database volume cleared"
}

# ── 1. Ensure .env exists ─────────────────────────────────────
setup_env() {
    log "Setting up web-app/.env..."
    if [ -f "$ENV_FILE" ]; then
        ok ".env already exists, will update contract addresses"
    elif [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        sed -i 's/^VITE_USE_MOCK_DATA=.*/VITE_USE_MOCK_DATA=false/' "$ENV_FILE"
        ok "Created .env from .example.env with VITE_USE_MOCK_DATA=false"
    else
        cat > "$ENV_FILE" <<-EOF
VITE_BACKEND_URL=http://localhost:${BACKEND_PORT}
VITE_USE_MOCK_DATA=false
VITE_CONTRACT_ADDRESS=
VITE_USDC_ADDRESS=
VITE_PRICE_FEED_ADDRESS=
EOF
        ok "Created minimal .env (no .example.env found)"
    fi

    # Ensure VITE_BACKEND_URL is set correctly
    if grep -qi '^VITE_BACKEND_URL=' "$ENV_FILE"; then
        sed -i '/^VITE_BACKEND_URL=/Id' "$ENV_FILE"
    fi
    echo "VITE_BACKEND_URL=http://localhost:${BACKEND_PORT}" >> "$ENV_FILE"
}

# ── 2. Start Hardhat node if needed ──────────────────────────
start_hardhat() {
    log "Checking if Hardhat node is already running..."

    if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$HARDHAT_PORT" \
        --max-time 2 2>/dev/null | grep -q 200; then
        ok "Hardhat node already running on port $HARDHAT_PORT"
        return
    fi

    log "Starting Hardhat node in background..."
    cd "$ROOT_DIR"
    npx hardhat node > /tmp/hardhat-node.log 2>&1 &
    HARDHAT_NODE_PID=$!

    local retries=0
    while [ $retries -lt 40 ]; do
        if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$HARDHAT_PORT" \
            --max-time 1 2>/dev/null | grep -q 200; then
            ok "Hardhat node is ready (PID $HARDHAT_NODE_PID)"
            return
        fi
        sleep 0.5
        retries=$((retries + 1))
    done

    fail "Hardhat node did not start in time. Check /tmp/hardhat-node.log"
}

# ── 3. Deploy contracts ───────────────────────────────────────
deploy_contracts() {
    log "Deploying MockERC20 (USDC) and VetRegistry..."
    cd "$ROOT_DIR"

    local deploy_output
    deploy_output=$(npx hardhat run scripts/deploy.ts --network localhost 2>&1)

    local vet_address
    vet_address=$(echo "$deploy_output" | grep -oP 'VITE_CONTRACT_ADDRESS=\K(0x[a-fA-F0-9]{40})')

    local usdc_address
    usdc_address=$(echo "$deploy_output" | grep -oP 'VITE_USDC_ADDRESS=\K(0x[a-fA-F0-9]{40})')

    local price_feed_address
    price_feed_address=$(echo "$deploy_output" | grep -oP 'VITE_PRICE_FEED_ADDRESS=\K(0x[a-fA-F0-9]{40})')

    if [ -z "$vet_address" ] || [ -z "$usdc_address" ] || [ -z "$price_feed_address" ]; then
        fail "Could not extract deployed addresses. Output:\n$deploy_output"
    fi

    ok "VetRegistry deployed at $vet_address"
    ok "MockERC20 (USDC) deployed at $usdc_address"
    ok "MockPriceFeed deployed at $price_feed_address"

    # Export for the indexer
    VET_REGISTRY_ADDRESS="$vet_address"

    # Update web-app/.env with contract addresses
    log "Updating web-app/.env with contract addresses..."

    sed -i '/^VITE_CONTRACT_ADDRESS=/Id' "$ENV_FILE"
    sed -i '/^VITE_USDC_ADDRESS=/Id' "$ENV_FILE"
    sed -i '/^VITE_PRICE_FEED_ADDRESS=/Id' "$ENV_FILE"
    echo "VITE_CONTRACT_ADDRESS=$vet_address" >> "$ENV_FILE"
    echo "VITE_USDC_ADDRESS=$usdc_address" >> "$ENV_FILE"
    echo "VITE_PRICE_FEED_ADDRESS=$price_feed_address" >> "$ENV_FILE"

    ok "web-app/.env updated"
}

# ── 4. Start PostgreSQL via Docker ─────────────────────────────
start_postgres() {
    log "Starting PostgreSQL via Docker Compose..."

    cd "$ROOT_DIR"
    sudo docker compose up -d postgres --wait 2>&1 || {
        # If --wait is not supported, do manual healthcheck
        sudo docker compose up -d postgres 2>/dev/null
        local retries=0
        while [ $retries -lt 12 ]; do
            if sudo docker compose exec -T postgres pg_isready -U vet57b &>/dev/null; then
                break
            fi
            sleep 2
            retries=$((retries + 1))
        done
    }

    ok "PostgreSQL is ready"
}

# ── 5. Start the indexer ───────────────────────────────────────
start_indexer() {
    log "Building and starting the Go indexer..."

    cd "$ROOT_DIR"

    # Build the binary first so any compile errors surface early
    cd "$ROOT_DIR/backend"
    go build -o /tmp/vet-indexer ./cmd/indexer
    cd "$ROOT_DIR/backend"

    # Start the indexer with localhost RPC endpoints
    DATABASE_URL="postgres://vet57b:vet57b@localhost:5432/vet57b?sslmode=disable" \
    ETH_HTTP_URL="http://127.0.0.1:$HARDHAT_PORT" \
    ETH_WS_URL="ws://127.0.0.1:$HARDHAT_PORT" \
    VET_REGISTRY_ADDRESS="$VET_REGISTRY_ADDRESS" \
    CONFIRMATIONS=0 \
    BACKFILL_FROM_BLOCK=0 \
    CORS_ORIGIN="http://localhost:5173" \
    PORT="$BACKEND_PORT" \
    /tmp/vet-indexer > /tmp/indexer.log 2>&1 &

    INDEXER_PID=$!

    # Wait for it to be healthy
    local retries=0
    while [ $retries -lt 15 ]; do
        if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$BACKEND_PORT/api/v1/health" \
            --max-time 1 2>/dev/null | grep -q 200; then
            ok "Indexer is ready (PID $INDEXER_PID)"
            return
        fi
        sleep 1
        retries=$((retries + 1))
    done

    # Print last few log lines on failure
    echo "   Indexer logs (last 10 lines):"
    tail -10 /tmp/indexer.log 2>/dev/null | sed 's/^/     /'
    fail "Indexer did not start in time. Check /tmp/indexer.log"
}

# ── 6. Start Vite ────────────────────────────────────────────
start_vite() {
    log "Starting Vite dev server..."
    echo ""
    cd "$WEB_APP_DIR"
    exec npx vite
}

# ── main ──────────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     🐾  Vet57B — Dev Environment     ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

reset_database
setup_env
start_hardhat
deploy_contracts
start_postgres
start_indexer
start_vite
