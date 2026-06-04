# Vet 57B — Veterinary dApp (Ethereum)

A decentralized application for managing a veterinary clinic. Register pets, schedule appointments, and pay with USDC. Includes a **Go backend indexer** that listens to on-chain events and exposes a REST API.

## Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.28, Hardhat 2.22 |
| Frontend | React 19, Vite 7, TypeScript 5.9 |
| Blockchain SDK | wagmi 3.6 + viem 2.48 |
| State Management | TanStack Query 5 |
| Routing | react-router-dom 7 |
| Contract Tests | Hardhat (Mocha + Chai) |
| Frontend Tests | Vitest + @testing-library/react |
| Styling | Tailwind CSS |
| Backend | Go 1.22+, chi router, pgx |
| Database | PostgreSQL 16 (via Docker) |
| Event Indexer | Go, ethers-like ABI parsing |

## Project Structure

```
vet-57b/
├── contracts/              # Smart Contracts (Solidity)
│   ├── VetRegistry.sol     # Pet registry, appointments & payments
│   └── test/               # Test mocks
│       └── MockERC20.sol
├── test/                   # Hardhat tests (Mocha + Chai)
├── web-app/                # Frontend (React + Vite)
│   └── src/
│       ├── pets/           # Pets module
│       ├── appointments/   # Appointments & payment module
│       ├── hooks/web3/     # wagmi + viem hooks
│       └── common/         # Shared components
├── backend/                # Go backend indexer
│   ├── cmd/indexer/        # Entry point
│   ├── internal/           # RPC, store, indexer, API layers
│   ├── migrations/         # PostgreSQL migrations
│   ├── Dockerfile          # Container build
│   └── Makefile
├── scripts/                # Deployment scripts (with seed data)
├── docker-compose.yml      # PostgreSQL + indexer services
├── dev.sh                  # One-command dev environment
└── openspec/               # SDD specifications
```

## Prerequisites

- Node.js 18+
- Go 1.22+
- Docker + Docker Compose
- npm or pnpm
- MetaMask or compatible wallet

## Quick Start

```bash
# One command — everything:
#   resets Postgres → deploys contracts + seed data → starts indexer → launches frontend
./dev.sh
```

The script does the following in order:

1. **Reset database** — clears PostgreSQL volume for a fresh state
2. **Setup environment** — creates/updates `web-app/.env`
3. **Start Hardhat** — launches a local node if not running
4. **Deploy contracts** — deploys `MockERC20`, `VetRegistry`, `MockPriceFeed` **and seeds 3 pets + 4 appointments**
5. **Start PostgreSQL** — via Docker Compose
6. **Start indexer** — builds and runs the Go backend (REST API on `:8080`)
7. **Start Vite** — launches the frontend on `:5173`

### Local wallets (Hardhat)

| Account | Role | UI |
|---------|------|-----|
| **#0** `0xf39F…` | Vet (`VITE_VET_ADDRESS` / `VET_ROLE`) | Pets + Appointments |
| **#1+** | Pet owner | **My Pets** — register via `registerAsOwner` on-chain |

Owner names are stored **on the contract only** (not in PostgreSQL). The Register Pet dropdown reads `getRegisteredOwners()` from the chain.

### Manual steps (if not using dev.sh)

```bash
# 1. Start local Hardhat node
npx hardhat node

# 2. Deploy contracts with seed data
npx hardhat run scripts/deploy.ts --network localhost

# 3. Start PostgreSQL
docker compose up -d postgres

# 4. Build and run the indexer
cd backend && go build -o /tmp/vet-indexer ./cmd/indexer
DATABASE_URL="postgres://vet57b:vet57b@localhost:5432/vet57b?sslmode=disable" \
  ETH_HTTP_URL="http://127.0.0.1:8545" \
  ETH_WS_URL="ws://127.0.0.1:8545" \
  VET_REGISTRY_ADDRESS="<deployed-address>" \
  /tmp/vet-indexer

# 5. Configure environment
cp web-app/.env.example web-app/.env
# Set VITE_CONTRACT_ADDRESS, VITE_USDC_ADDRESS, VITE_PRICE_FEED_ADDRESS

# 6. Start the frontend
cd web-app && npm install && npm run dev
```

## REST API (port 8080)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/pets` | GET | List all registered pets |
| `/api/v1/pets/:id` | GET | Get pet by ID |
| `/api/v1/appointments` | GET | List all appointments |
| `/api/v1/appointments/upcoming` | GET | Upcoming appointments |
| `/api/v1/events` | GET | Recent on-chain events |
| `/api/v1/sync/status` | GET | Indexer sync status |

## Tests

```bash
# Contract tests (Hardhat)
npx hardhat test

# Frontend tests (Vitest)
cd web-app && npx vitest run
```

## Features

- **Pet registration**: name, age, type (Dog/Cat), caretaker info
- **Schedule appointments**: date, time, dollar amount
- **Pay with USDC**: approve + pay flow following the CEI pattern
- **Withdraw funds**: only the contract owner can withdraw accumulated USDC
- **On-chain event indexer**: Go service that listens to `PetRegistered`, `AppointmentScheduled`, `AppointmentPaid` events and stores them in PostgreSQL
- **REST API**: query pets, appointments, and events via HTTP
- **Seed data**: deployment automatically creates sample pets and appointments for local development

## Original Exercise

This project started as a **Solana + Anchor** development exercise and was later migrated to **Ethereum + Hardhat** to explore the EVM stack. A **Go backend indexer** was later added for off-chain event tracking and query capabilities. The `solana/` directory contains the original Solana codebase.
