# Tasks: Solana → Ethereum Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Contracts → PR 2: Hooks → PR 3: Integration |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Base |
|------|------|------|
| 1 | Hardhat project + contrato + tests | feature/solana-to-ethereum |
| 2 | Web3 provider + hooks read/write | PR #1 branch |
| 3 | Web-app integration + cleanup solana/ | PR #2 branch |

## Phase 1: Foundation — Hardhat + Contract

- [x] 1.1 Inicializar proyecto Hardhat (hardhat.config.ts, package.json, tsconfig.json)
- [x] 1.2 Crear `contracts/VetRegistry.sol` con structs MedicalRecord, MedicalAppointment, enum AnimalType
- [x] 1.3 Implementar `registerPet()` con evento `MedicalRecordCreated`
- [x] 1.4 Implementar `getMedicalRecord()` y `getPetCount()`
- [x] 1.5 Implementar `scheduleAppointment()` con evento `MedicalAppointmentCreated`
- [x] 1.6 Crear `test/VetRegistry.test.ts` — cobertura de todos los escenarios del spec (12 tests, todos pasando)
- [x] 1.7 Crear `scripts/deploy.ts` para deploy a localhost

## Phase 2: Web3 Layer — Provider + Hooks

- [x] 2.1 Agregar dependencias: wagmi, viem, @tanstack/react-query a web-app/package.json
- [x] 2.2 Crear `src/hooks/web3/contract.ts` — ABI + address + wagmi config
- [x] 2.3 Crear `src/hooks/web3/Web3Provider.tsx` — wagmi provider + QueryClientProvider
- [x] 2.4 Crear `src/hooks/web3/usePets.ts` — hook TanStack Query para leer pets del contrato
- [x] 2.5 Crear `src/hooks/web3/useRegisterPet.ts` — hook mutation para registrar pet
- [x] 2.6 Crear `src/hooks/web3/useAppointments.ts` — hook para leer citas del contrato

## Phase 3: Web-App Integration + Cleanup

- [x] 3.1 Modificar `src/main.tsx` — Web3Provider wrapping RouterProvider
- [x] 3.2 Modificar `src/common/components/NavBar.tsx` — ConnectWallet con useAccount + useConnect (MetaMask)
- [x] 3.3 Modificar `src/pets/hooks/usePetsOverview.ts` — migrado para usar PetService (mock o Web3 según flag)
- [x] 3.4 Actualizar `src/pets/services/petService.ts` — factory switchea entre MockPetService y Web3PetService
- [x] 3.5 Modificar `.example.env` — agregado VITE_CONTRACT_ADDRESS
- [x] 3.6 Eliminar `solana/` del proyecto — reemplazado por Hardhat project
