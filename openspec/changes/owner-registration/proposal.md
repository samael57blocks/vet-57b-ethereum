# Proposal: On-Chain Owner Registration

## Intent

Pet owners need to register their wallet on-chain so vets can assign pets to the correct owner in a dropdown. Currently Register Pet silently uses the connected vet's wallet as owner — owners have no account or dashboard. This blocks the owner payment flow (payAppointmentToken already gates on MedicalRecord.owner). Adding `owner: string` to the Pet type fixes a data loss bug.

## Scope

### In Scope
- Contract: `registerAsOwner` + `OwnerRegistered` event + mapping+array storage + `getRegisteredOwners()` + `getPetsByOwner()`
- Frontend: New `/owner` route with registration form + dashboard (pets + appointments + pay)
- Vet-side: Register Pet dropdown of registered owners + free-text fallback
- Pet type: add `owner: string` field (currently missing)
- Full Hardhat test suite for new functions

### Out of Scope
- `cancelAppointment` — deferred to follow-up change
- Backend indexer changes — document but do not implement
- EnumerableSet — use simple mapping+array for small clinic context

## Capabilities

### New Capabilities
- `owner-registration`: Contract registration + on-chain queries + frontend owner dashboard

### Modified Capabilities
- `pet-registration`: Owner field changes from manual address input to dropdown (registered owners) + free-text fallback for walk-in clients
- `vet-contract`: Add registerAsOwner, getRegisteredOwners, getPetsByOwner functions and OwnerRegistered event

## Approach

Mapping+array for owner storage (no EnumerableSet — clinic context < 200 owners). View function iterates `_petCount` for getPetsByOwner — cheap as `view`. Dedicated `/owner` route. Dropdown replaces hidden address in Register Pet dialog. Follow existing service factory (Mock/Web3/Axios) and TxState patterns.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| contracts/VetRegistry.sol | Modified | Add registerAsOwner, mapping+array, events, getRegisteredOwners, getPetsByOwner |
| test/VetRegistry.test.ts | Modified | New test suites for owner registration + queries |
| web-app/src/pets/types/pet.ts | Modified | Add `owner: string` field |
| web-app/src/pets/services/* | Modified | Map owner from contract in all service layers |
| web-app/src/pets/views/PetsOverviewView.tsx | Modified | Dropdown for owner in Register Pet |
| web-app/src/hooks/web3/useRegisterPet.ts | Modified | Accept selected owner address (not connected wallet) |
| web-app/src/hooks/web3/useRegisterOwner.ts | New | Write hook for registerAsOwner |
| web-app/src/hooks/web3/useRegisteredOwners.ts | New | Read hook for getRegisteredOwners |
| web-app/src/hooks/web3/usePetsByOwner.ts | New | Read hook for getPetsByOwner |
| web-app/src/owners/ | New | Owner pages, types, hooks, views |
| web-app/src/common/components/NavBar.tsx | Modified | Add "My Pets" link for owners |
| web-app/src/router.tsx | Modified | Add /owner route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dropdown changes existing pet flow | Low | Backward-compatible — old pets retain vet-as-owner |
| Array iteration timeout on getRegisteredOwners | Low | View function, small dataset (< 200 owners) |
| Owner wallet mismatch on dashboard | Low | useAccount compares connected wallet with registered |

## Rollback Plan

Revert contract to previous deployment. Revert frontend: restore Register Pet to connected-wallet-as-owner, remove /owner route and all owner files, remove owner field from Pet type.

## Dependencies

None. Existing contract allows append-only storage extensions. No backend changes required.

## Success Criteria

- [ ] Owner can register wallet + name via contract (Hardhat test + UI)
- [ ] Vet sees dropdown of registered owners in Register Pet form
- [ ] Owner dashboard shows their pets + unpaid appointments + pay button
- [ ] Hardhat tests cover all new functions including revert cases
- [ ] Existing Hardhat test suite still passes unchanged
