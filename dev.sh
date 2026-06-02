#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  dev.sh — One-command dev environment for Vet57B
#
#  Starts Hardhat node (if not running), deploys MockERC20 (USDC)
#  and VetRegistry, writes contract addresses into web-app/.env,
#  and launches Vite.
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_APP_DIR="$ROOT_DIR/web-app"
ENV_FILE="$WEB_APP_DIR/.env"
ENV_EXAMPLE="$WEB_APP_DIR/.env.example"
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
        ok ".env already exists, will update contract addresses"
    elif [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        ok "Created .env from .example.env"
    else
        # minimal fallback
        cat > "$ENV_FILE" <<-EOF
VITE_BACKEND_URL=http://localhost:4000
VITE_USE_MOCK_DATA=false
VITE_CONTRACT_ADDRESS=
VITE_USDC_ADDRESS=
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

# ── 3. Compile and generate ABIs ───────────────────────────────
compile_and_generate_abis() {
    log "Compiling contracts and generating ABIs..."
    cd "$ROOT_DIR"

    npx hardhat compile 2>&1 | tail -2
    node scripts/generate-abi.mjs

    ok "Contracts compiled and ABIs generated"
}

# ── 4. Deploy contracts ───────────────────────────────────────
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

    # ── 4. Update .env ────────────────────────────────────────
    log "Updating web-app/.env with contract addresses..."

    # Remove existing contract address lines
    sed -i '/^VITE_CONTRACT_ADDRESS=/Id' "$ENV_FILE"
    sed -i '/^VITE_USDC_ADDRESS=/Id' "$ENV_FILE"
    sed -i '/^VITE_PRICE_FEED_ADDRESS=/Id' "$ENV_FILE"
    # Append fresh values
    echo "VITE_CONTRACT_ADDRESS=$vet_address" >> "$ENV_FILE"
    echo "VITE_USDC_ADDRESS=$usdc_address" >> "$ENV_FILE"
    echo "VITE_PRICE_FEED_ADDRESS=$price_feed_address" >> "$ENV_FILE"

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
compile_and_generate_abis
deploy_contracts
start_vite
