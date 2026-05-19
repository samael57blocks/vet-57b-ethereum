# Proposal: Pet Registration

## Intent

Wire the existing `useRegisterPet` hook into `PetsOverviewView` so the form actually submits to the contract — it currently only validates. Add wallet guard, transaction feedback, missing fields (animalType, caretakerName, caretakerPhone), and auto-refresh on success. Add frontend tests.

## Scope

### In Scope
- Wire `useRegisterPet` into `PetsOverviewView`: valid form → contract write
- Wallet connection check: show message when no wallet connected
- Transaction state feedback UI: pending → processing → success/error
- Add AnimalType dropdown, caretakerName, caretakerPhone fields to form
- Migrate `usePetsOverview` from raw `useEffect` + `setState` to TanStack Query `useQuery` for proper invalidation after writes
- Auto-refresh pet list after successful registration (invalidate query key)
- Frontend tests: vitest + @testing-library/react for the registration flow

### Out of Scope
- `usePetsOverview` for appointments (separate change)
- Integration tests with a running Hardhat node
- Wallet connect button itself (exists in NavBar)
- Error recovery / retry logic for failed transactions
- Edit or delete pet features

## Capabilities

### New Capabilities
- `pet-registration`: Form-driven pet registration via contract write with wallet guard, transaction feedback, and auto-refresh

### Modified Capabilities
- `contract-writes`: The `useRegisterPet` hook already exists — no spec change. The pet-registration spec will cover the UI integration.
- `web3-connect`: No spec change. The wallet guard reads existing `useAccount`.

## Approach

1. **Extend `PetsOverviewView`**: Add `useAccount` to detect wallet connection. Add `useRegisterPet` for the write. Add TanStack Query (via `usePets`) to read pets instead of the raw `usePetsOverview` hook.
2. **Expand the form**: Add `<select>` for AnimalType (Dog/Cat), text inputs for caretakerName and caretakerPhone. Validate all fields.
3. **Transaction feedback**: Map `txState` to in-dialog messages ("Confirm in MetaMask...", "Transaction processing...", error/success banners). Close dialog + invalidate query on success.
4. **Query migration**: Replace `usePetsOverview` with `wagmi/useReadContract`-based hooks or a thin `useQuery` wrapper over `Web3PetService`. Query key: `['vetRegistry', 'pets']`.
5. **Tests**: Add `vitest` + `@testing-library/react`. Mock wagmi hooks. Test: validation blocks submission, wallet guard shows message, successful flow calls `registerPet`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web-app/src/pets/views/PetsOverviewView.tsx` | Modified | Wire hook, expand form, add tx feedback |
| `web-app/src/pets/hooks/usePetsOverview.ts` | Modified | Migrate to TanStack Query `useQuery` |
| `web-app/src/pets/types/pet.ts` | Unchanged | Already has AnimalType, caretaker fields |
| `web-app/src/hooks/web3/useRegisterPet.ts` | Unchanged | Already complete |
| `web-app/src/__tests__/` | New | Registration flow tests |
| `web-app/package.json` | Modified | Add vitest, @testing-library/react deps |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Query invalidation doesn't refresh list | Low | Invalidate `['vetRegistry', 'pets']` query key explicitly in `onSuccess` |
| Test setup for wagmi mocks is complex | Med | Use `wagmi/test` or mock `useWriteContract` + `useAccount` at module level |
| `usePetsOverview` migration breaks existing pet list display | Low | Keep both hooks side-by-side during transition; test manually |

## Rollback Plan

Revert the single commit. If query migration is risky, defer it: wire registration with the current `usePetsOverview` first (invalidate via `queryClient.invalidateQueries`), then migrate the read hook in a follow-up commit.

## Dependencies

- `vitest` + `@testing-library/react` + `@testing-library/jest-dom` (add to devDeps)
- Users must have MetaMask connected to submit — already handled by existing NavBar
- Contract must be deployed with `registerPet` function — already in VetRegistry

## Success Criteria

- [ ] Form submits to contract and pet appears in list without manual refresh
- [ ] "Connect your wallet" message shown when no wallet detected
- [ ] Transaction states display correctly (pending → processing → success/error)
- [ ] All new form fields (AnimalType, caretakerName, caretakerPhone) validated and submitted
- [ ] Frontend tests pass: validation, wallet guard, successful submission
