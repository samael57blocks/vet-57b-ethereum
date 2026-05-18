#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  dev.sh — One-command dev environment for Vet57B
#
#  Starts Hardhat node (if not running), deploys VetRegistry,
#  writes the address into web-app/.env, and launches Vite.
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_APP_DIR="$ROOT_DIR/web-app"
ENV_FILE="$WEB_APP_DIR/.env"
ENV_EXAMPLE="$WEB_APP_DIR/.example.env"
HARDHAT_NODE_PID=""
HARDHAT_PORT=8545

# ── helpers ──────────────────────────────────────────────────
cleanup() {
    local exit_code=$?
    echo ""
    echo "🧹 Cleaning up..."
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

# ── 1. Ensure .env exists ─────────────────────────────────────
setup_env() {
    log "Setting up web-app/.env..."
    if [ -f "$ENV_FILE" ]; then
        ok ".env already exists, will update VITE_CONTRACT_ADDRESS"
    elif [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        ok "Created .env from .example.env"
    else
        # minimal fallback
        cat > "$ENV_FILE" <<-EOF
VITE_BACKEND_URL=http://localhost:4000
VITE_USE_MOCK_DATA=false
VITE_CONTRACT_ADDRESS=
EOF
        ok "Created minimal .env (no .example.env found)"
    fi
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

    # Wait for the node to be ready (up to 20 seconds)
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

# ── 3. Deploy contract ───────────────────────────────────────
deploy_contract() {
    log "Deploying VetRegistry..."
    cd "$ROOT_DIR"

    local deploy_output
    deploy_output=$(npx hardhat run scripts/deploy.ts --network localhost 2>&1)

    local address
    address=$(echo "$deploy_output" | grep -oP 'VetRegistry deployed to: \K(0x[a-fA-F0-9]{40})')

    if [ -z "$address" ]; then
        fail "Could not extract deployed address. Output:\n$deploy_output"
    fi

    ok "VetRegistry deployed at $address"

    # ── 4. Update .env ────────────────────────────────────────
    log "Updating VITE_CONTRACT_ADDRESS in web-app/.env..."

    # Remove any existing VITE_CONTRACT_ADDRESS line (case-insensitive)
    sed -i '/^VITE_CONTRACT_ADDRESS=/Id' "$ENV_FILE"
    # Append the new one
    echo "VITE_CONTRACT_ADDRESS=$address" >> "$ENV_FILE"

    # Also ensure VITE_USE_MOCK_DATA=false
    if grep -qi '^VITE_USE_MOCK_DATA=' "$ENV_FILE"; then
        sed -i '/^VITE_USE_MOCK_DATA=/Id' "$ENV_FILE"
    fi
    echo "VITE_USE_MOCK_DATA=false" >> "$ENV_FILE"

    ok "web-app/.env updated"
}

# ── 5. Start Vite ────────────────────────────────────────────
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

setup_env
start_hardhat
deploy_contract
start_vite
