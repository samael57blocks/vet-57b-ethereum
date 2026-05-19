# Vet 57B — dApp de Veterinaria (Ethereum)

Aplicación descentralizada para la gestión de una clínica veterinaria. Permite registrar mascotas, agendar citas y pagarlas con USDC.

## Stack

| Capa | Tecnología |
|------|------------|
| Smart Contracts | Solidity 0.8.28, Hardhat 2.22 |
| Frontend | React 19, Vite 7, TypeScript 5.9 |
| Blockchain SDK | wagmi 3.6 + viem 2.48 |
| Estado | TanStack Query 5 |
| Routing | react-router-dom 7 |
| Tests (contratos) | Hardhat (Mocha + Chai) |
| Tests (frontend) | Vitest + @testing-library/react |
| Estilos | Tailwind CSS |

## Estructura del proyecto

```
vet-57b/
├── contracts/              # Smart Contracts (Solidity)
│   ├── VetRegistry.sol     # Registro de mascotas, citas y pagos
│   └── test/               # Mocks para testing
│       └── MockERC20.sol
├── test/                   # Tests de Hardhat (Mocha + Chai)
├── web-app/                # Frontend (React + Vite)
│   └── src/
│       ├── pets/           # Módulo de mascotas
│       ├── appointments/   # Módulo de citas y pagos
│       ├── hooks/web3/     # Hooks de wagmi + viem
│       └── common/         # Componentes compartidos
├── scripts/                # Scripts de deploy
└── openspec/               # Especificaciones SDD
```

## Requisitos

- Node.js 18+
- npm
- MetaMask u otro wallet compatible

## Inicio rápido

```bash
# 1. Iniciar nodo Hardhat local
npx hardhat node

# 2. En otra terminal, hacer deploy
npx hardhat run scripts/deploy.ts --network localhost

# 3. Configurar variables de entorno
cp web-app/.env.example web-app/.env
# Editar VITE_CONTRACT_ADDRESS con la dirección del deploy
# Editar VITE_USDC_ADDRESS con la dirección del mock USDC

# 4. Iniciar frontend
cd web-app
npm install
npm run dev
```

### Script todo-en-uno

```bash
./dev.sh
```

Arranca el nodo Hardhat, hace deploy y lanza la app.

## Tests

```bash
# Tests de contratos (Hardhat)
npx hardhat test

# Tests de frontend (Vitest)
cd web-app && npx vitest run
```

## Features

- **Registro de mascotas**: name, age, tipo (Dog/Cat), datos del dueño
- **Agendar citas**: fecha, hora, valor en dólares
- **Pagar citas con USDC**: approve + pay flow (CEI pattern)
- **Retiro de fondos**: solo el owner del contrato puede retirar USDC acumulado

## Ejercicio original

Este proyecto comenzó como un ejercicio de desarrollo en **Solana con Anchor**, pero fue migrado a **Ethereum con Hardhat** para explorar el stack EVM. El directorio `solana/` contiene el código original de la versión Solana.
