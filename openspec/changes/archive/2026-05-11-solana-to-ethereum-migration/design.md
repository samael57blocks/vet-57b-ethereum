# Design: Solana → Ethereum Migration

## Technical Approach

Reemplazar `solana/` por un proyecto Hardhat con el contrato `VetRegistry.sol`. La web-app se conecta directamente al contrato mediante ethers.js v6 envuelto en hooks TanStack Query. El flag `VITE_USE_MOCK_DATA` permite usar datos mock como fallback cuando no hay wallet conectada.

## Architecture Decisions

### Decision: Hardhat sobre Foundry

**Choice**: Hardhat
**Alternatives**: Foundry (Rust-based, más rápido)
**Rationale**: Hardhat tiene mejor integración con TypeScript, los tests se escriben en el mismo lenguaje que la web-app, y la experiencia del ecosistema ethers.js/TypeScript es más cohesiva para este proyecto.

### Decision: Contrato único vs múltiples contratos

**Choice**: Contrato único `VetRegistry`
**Alternatives**: Contratos separados `MedicalRecords` y `MedicalAppointments`
**Rationale**: Un solo contrato simplifica el deploy, las queries y el testing. La separación se justifica cuando hay equipos distintos o upgrades independientes — no aplica aquí.

### Decision: wagmi + viem sobre ethers.js directo

**Choice**: wagmi + viem (moderno)
**Alternatives**: ethers.js v6 directo
**Rationale**: wagmi provee hooks React nativos con TanStack Query integrado, manejo de wallet (connect/disconnect), y reactividad de estado. viem es el reemplazo moderno de ethers — más liviano, type-safe por defecto, y mejor soporte de TypeScript.

### Decision: ID como auto-increment vs bytes32

**Choice**: `uint256` auto-increment (contador interno)
**Alternatives**: `bytes32` definido por el caller (como en Solana)
**Rationale**: Auto-increment simplifica el frontend (no necesita generar IDs), garantiza unicidad, y permite paginación sencilla. Un mapping accesorio `petIdToAddress` no es necesario aquí.

## Data Flow

```
User Action (Register Pet form)
       │
       ▼
useRegisterPet() mutation
       │
       ▼
wagmi useWriteContract()
       │
       ├── MetaMask prompt → User approves
       │
       ▼
Contract: VetRegistry.registerPet()
       │
       ├── Store struct in mapping
       ├── Increment counter
       └── Emit MedicalRecordCreated event
       │
       ▼
onSuccess → invalidateQueries(['vetRegistry'])
       │
       ▼
usePets() refetch → UI updates
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `solana/` | Delete | Replaced by Hardhat project |
| `contracts/VetRegistry.sol` | Create | Contrato principal con MedicalRecords y Appointments |
| `hardhat.config.ts` | Create | Configuración Hardhat + Solidity 0.8.x |
| `test/VetRegistry.test.ts` | Create | Tests del contrato |
| `scripts/deploy.ts` | Create | Script de deploy a localhost |
| `src/hooks/web3/Web3Provider.tsx` | Create | Context provider + wagmi config |
| `src/hooks/web3/usePets.ts` | Create | Hook TanStack Query para leer pets |
| `src/hooks/web3/useRegisterPet.ts` | Create | Hook mutation para registrar pet |
| `src/hooks/web3/contract.ts` | Create | Configuración del contrato (ABI + address) |
| `src/pets/hooks/usePetsOverview.ts` | Modify | Migrar de useState/useEffect a TanStack Query |
| `src/main.tsx` | Modify | Agregar Web3Provider + QueryClientProvider |
| `src/App.tsx` | Modify | Agregar connect wallet button |
| `web-app/package.json` | Modify | Agregar wagmi, viem, @tanstack/react-query |
| `.example.env` | Modify | Agregar VITE_CONTRACT_ADDRESS |

## Interfaces / Contracts

```solidity
// VetRegistry.sol (core data structures)
struct MedicalRecord {
    string name;
    uint8 age;
    AnimalType animalType;
    string caretakerName;
    string caretakerPhone;
}

struct MedicalAppointment {
    bytes32 petId;
    uint256 date;
    string time;
    uint256 appointmentValue;
    uint256 paidValue;
}

enum AnimalType { Dog, Cat }
```

```typescript
// web-app (mirrors contract structs)
interface Pet {
  id: string;        // on-chain uint256
  name: string;
  age: number;
  animalType: 'Dog' | 'Cat';
  caretakerName: string;
  caretakerPhone: string;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Contract (unit) | registerPet, getPet, scheduleAppointment | Hardhat + chai + ethers |
| Contract (integration) | Event emission, reversion on invalid input | Hardhat assertions |
| Frontend (hooks) | usePets loading/success/error states | vitest + wagmi mock |
| Frontend (UI) | Form validation, wallet connect button | vitest + testing-library |
| Regression | Mock data path sigue funcionando | Mantener VITE_USE_MOCK_DATA |

## Migration / Rollout

No migration required — el programa Solana es un stub sin datos reales. El proyecto Hardhat arranca desde cero con deploy a localhost.

## Open Questions

- [ ] ¿Usar `uint256` para appointmentValue o convertir a ETH real (wei)?
- [ ] ¿Agregar vitest ahora o postergar a otro cambio?
