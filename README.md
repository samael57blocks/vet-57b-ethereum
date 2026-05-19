# Vet 57B — Veterinary dApp (Ethereum)

A decentralized application for managing a veterinary clinic. Register pets, schedule appointments, and pay them with USDC.

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
├── scripts/                # Deployment scripts
└── openspec/               # SDD specifications
```

## Prerequisites

- Node.js 18+
- npm
- MetaMask or compatible wallet

## Quick Start

```bash
# 1. Start local Hardhat node
npx hardhat node

# 2. In another terminal, deploy contracts
npx hardhat run scripts/deploy.ts --network localhost

# 3. Configure environment
cp web-app/.env.example web-app/.env
# Set VITE_CONTRACT_ADDRESS to the deployed contract address
# Set VITE_USDC_ADDRESS to the mock USDC address

# 4. Start the frontend
cd web-app
npm install
npm run dev
```

### One-command script

```bash
./dev.sh
```

Starts Hardhat node, deploys contracts, and launches the app.

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

## Original Exercise

This project started as a **Solana + Anchor** development exercise and was later migrated to **Ethereum + Hardhat** to explore the EVM stack. The `solana/` directory contains the original Solana codebase.
