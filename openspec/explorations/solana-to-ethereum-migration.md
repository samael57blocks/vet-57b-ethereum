# Exploration: solana-to-ethereum-migration

## Current State

El proyecto `vet-57b` es un ejercicio de desarrollo para una veterinaria que actualmente tiene:

**solana/** — Programa Anchor (Rust) con 4 instrucciones stub usando `MockContext`. Las definiciones de datos y eventos están en TypeScript. No hay lógica real de cuentas on-chain.

**web-app/** — Frontend React 19 + Vite + TypeScript que consume datos vía mock o REST API. No tiene dependencias Solana. Usa `useState` + `useEffect` para fetching. No tiene test runner configurado.

**Backend service** — NO existe. Es el puente faltante entre blockchain y web-app.

El `AGENTS.md` ya prescribe Ethers.js v6 y TanStack Query, lo que indica que la intención original siempre fue Ethereum.

## Affected Areas

| Archivo | Acción |
|---------|--------|
| `solana/` (todo) | Reemplazar por proyecto Hardhat/Foundry |
| `solana/programs/vet-57b/src/lib.rs` | → `contracts/VetRegistry.sol` |
| `solana/app/models/medical_record.model.ts` | Reciclar modelo, ajustar tipos (PublicKey → address) |
| `solana/app/models/medical_appointment.model.ts` | Reciclar modelo, ajustar tipos |
| `solana/app/models/events/*` | Reciclar como interfaces de eventos Solidity |
| `solana/app/vet.program.ts` | → `src/hooks/web3/useVetContract.ts` |
| `solana/tests/*` | → Hardhat tests en TypeScript |
| `solana/app/models/requests/*` | Reciclar igual |
| `web-app/src/pets/types/pet.ts` | Sin cambios (ya es genérica) |
| `web-app/src/pets/services/*` | Agregar `Web3PetService` (lectura directa del contrato) |
| `web-app/src/pets/hooks/usePetsOverview.ts` | Migrar a TanStack Query + ethers |
| `web-app/src/main.tsx` | Agregar QueryClientProvider + Web3Provider |
| `web-app/package.json` | Agregar ethers, @tanstack/react-query, wagmi/viem |
| `AGENTS.md` | Actualizar (ya está mayormente alineado) |

## Approaches

### Approach A: Hardhat + Direct Contract Reads (Recomendado)

Reemplazar `solana/` con un proyecto Hardhat. Un solo contrato `VetRegistry` maneja MedicalRecords y Appointments. La web-app lee directo del contrato vía ethers.js + TanStack Query. Sin backend.

**Pros:**
- Arquitectura más simple (sin backend)
- La web-app tiene datos frescos de la blockchain siempre
- Menos moving parts que mantener
- Perfecto para un technical test

**Cons:**
- Depende de tener una wallet (MetaMask) conectada
- Leer listas completas requiere eventos indexados o un contador on-chain
- Gas cost para escrituras

**Archivos a crear:**
- `contracts/VetRegistry.sol` — contrato principal con MedicalRecord y MedicalAppointment
- `test/VetRegistry.test.ts` — tests del contrato
- `hardhat.config.ts` — configuración Hardhat
- `src/hooks/web3/useVetContract.ts` — hook ethers.js
- `src/hooks/web3/useMedicalRecords.ts` — hook TanStack Query
- `src/hooks/web3/useMedicalAppointments.ts` — hook TanStack Query
- `src/providers/Web3Provider.tsx` — provider de wallet
- `src/contracts/VetRegistry.abi.ts` — ABI + address
- `.env.example` — config de red

**Dependencias a instalar:**
- Hardhat + ethers.js (web-app)
- @tanstack/react-query
- wagmi + viem (alternativa moderna, recomendada sobre ethers.js directo)

**Esfuerzo: Medio** (~2-3 días)

### Approach B: Foundry + Backend Indexer

Reemplazar `solana/` con Foundry (Rust-based, más rápido). Backend Node.js escucha eventos del contrato, los persiste en DB, expone REST API. web-app usa REST para reads y ethers para writes.

**Pros:**
- Foundry compila más rápido que Hardhat
- Backend permite queries complejas (SQL sobre eventos indexados)
- La web-app no requiere wallet para lecturas
- Escalable a producción

**Cons:**
- Mucho más complejo (3 capas: contracts + backend + frontend)
- Backend hay que construirlo de cero (no existe)
- Excede el scope de un technical test
- Más código que mantener

**Esfuerzo: Alto** (~1 semana)

## Model Translation

### MedicalRecord

| Solana (Anchor) | Ethereum (Solidity) |
|----------------|--------------------|
| Cuenta PDA con `#[account]` | `struct MedicalRecord` + `mapping(bytes32 => MedicalRecord)` |
| `id: PublicKey` | `bytes32 id` (o uint256 auto-increment) |
| `name: String` | `string name` |
| `age: u8` | `uint8 age` |
| `animalType: AnimalType` | `enum AnimalType { Dog, Cat }` + `AnimalType animalType` |
| `caretakerName: String` | `string caretakerName` |
| `caretakerPhone: String` | `string caretakerPhone` |

### MedicalAppointment

| Solana (Anchor) | Ethereum (Solidity) |
|----------------|--------------------|
| Cuenta PDA | `struct Appointment` + `mapping(bytes32 => Appointment)` |
| `id: PublicKey` | `bytes32 id` |
| `petId: PublicKey` | `bytes32 petId` |
| `date: Date` (Timestamp) | `uint256 date` (Unix timestamp) |
| `time: String` | `string time` |
| `appointmentValue: u64` (cents) | `uint256 appointmentValue` (wei o cents) |
| `paidValue: u64` | `uint256 paidValue` |

### Events

| Solana (Anchor) | Ethereum (Solidity) |
|----------------|--------------------|
| `MedicalRecordCreatedEvent` | `event MedicalRecordCreated(bytes32 id, string name, ...)` |
| `MedicalAppointmentCreatedEvent` | `event MedicalAppointmentCreated(bytes32 id, ...)` |

### Client Code

| Solana | Ethereum |
|--------|----------|
| `anchor.methods.registerPet(data).rpc()` | `contract.registerPet(data)` via ethers |
| `program.account.medicalRecord.fetch(address)` | TanStack Query + `contract.medicalRecords(id)` |
| EventParser | `contract.on("MedicalRecordCreated", handler)` |
| PDA derivation | Dirección del contrato fija |

## Risks

1. **La web-app necesita conexión a wallet** — Sin MetaMask no puede leer el contrato. Solución: Approach B con backend REST.
2. **Gas fees en desarrollo** — Hardhat localhost no tiene gas real, pero la web-app necesita configurar la red.
3. **No hay test runner en web-app** — Habría que agregar vitest + testing-library para tests de frontend.
4. **Migración del estado existente** — Como no hay datos reales en Solana (stubs), no hay estado que migrar. Se arranca de cero.
5. **`AnimalType` tiene typo** — En solana `Cat = 'Cat'` usa `Cat` en vez de `CAT`. Se puede aprovechar la migración para corregirlo.
6. **El formulario de registro no persiste** — El dialog de `PetsOverviewView` solo valida, no envía datos a ningún lado.

## Recommendation

**Approach A: Hardhat + Direct Contract Reads.** Es la opción más pragmática para el contexto:

- Es un technical test → simplicidad > escalabilidad
- No hay backend que construir
- El `AGENTS.md` ya prescribe Ethers.js y TanStack Query
- La web-app se conecta directo a la blockchain como cualquier dapp real
- Queda un proyecto completo y funcional con 2 capas (contracts + frontend)

Si más adelante se necesita escalar, se puede agregar un indexer.

## Ready for Proposal

**Sí.** Tengo claras las rutas, los modelos, los riesgos y los archivos a tocar.
