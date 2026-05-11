# Proposal: Solana → Ethereum Migration

## Intent

Reemplazar el programa Solana Anchor (stubs sin lógica real) por contratos Ethereum Solidity con Hardhat, y conectar la web-app directamente a la blockchain vía ethers.js + TanStack Query. El `AGENTS.md` ya prescribe este stack — la migración alinea el código con la arquitectura pensada originalmente.

## Scope

### In Scope
- Contrato `VetRegistry` con MedicalRecords y MedicalAppointments on-chain
- Proyecto Hardhat con configuración, tests, y deploy script
- Hooks ethers.js + TanStack Query para reads/writes
- Provider de wallet (MetaMask) en web-app
- Migración del hook `usePetsOverview` de useState/useEffect a TanStack Query
- Opción mock existente convive con la nueva opción web3

### Out of Scope
- Backend service / REST API indexer
- The Graph / subgraph
- Payments en crypto (se deja el hook listo pero sin implementar)
- UI de appointments (solo se deja el contrato preparado)

## Capabilities

### New Capabilities
- `vet-contract`: Contrato inteligente VetRegistry con CRUD de mascotas y citas
- `web3-connect`: Conexión de wallet y provider Ethereum en web-app
- `contract-reads`: Hooks TanStack Query para leer datos del contrato
- `contract-writes`: Hooks para escribir transacciones al contrato

### Modified Capabilities
- `pet-registration`: Pasa de mock/REST API a escritura directa en contrato

## Approach

Approach A de la exploración: Hardhat + Direct Contract Reads. Un contrato `VetRegistry.sol` unificado. La web-app se conecta via ethers.js (con wagmi/viem como opción moderna). Los datos mock siguen disponibles via `VITE_USE_MOCK_DATA`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `solana/` | Removed | Reemplazado por proyecto Hardhat |
| `contracts/VetRegistry.sol` | New | Contrato principal |
| `web-app/src/hooks/web3/` | New | Hooks ethers + TanStack Query |
| `web-app/src/providers/` | New | Web3Provider + QueryClientProvider |
| `web-app/src/main.tsx` | Modified | Wrappers de providers |
| `web-app/src/pets/hooks/` | Modified | Migrar a TanStack Query |
| `web-app/package.json` | Modified | ethers + @tanstack/react-query |
| `AGENTS.md` | Unchanged | Ya alineado |
| `web-app/.example.env` | Modified | VITE_CONTRACT_ADDRESS |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| web-app sin wallet no lee datos | Medium | Mock data como fallback via VITE_USE_MOCK_DATA |
| Sin test runner en frontend | Medium | Agregar vitest en el cambio |
| Gas fees en desarrollo | Low | Hardhat localhost sin gas real |

## Rollback Plan

1. `git revert` los commits de migración
2. Restaurar `solana/` del commit anterior
3. Volver a `VITE_USE_MOCK_DATA=true` como estaba

## Dependencies

- Hardhat
- ethers.js v6 (o wagmi + viem)
- @tanstack/react-query v5

## Success Criteria

- [ ] `npx hardhat test` pasa en contrato VetRegistry
- [ ] web-app conecta a Hardhat localhost y lee pets del contrato
- [ ] Formulario de registro escribe un pet on-chain y lo refleja en UI
- [ ] Mock data sigue funcionando con `VITE_USE_MOCK_DATA=true`
- [ ] `npm run dev` arranca sin errores
