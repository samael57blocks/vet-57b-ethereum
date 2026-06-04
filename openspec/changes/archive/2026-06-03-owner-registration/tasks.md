# Tasks: On-Chain Owner Registration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500–550 |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1: Contract + Tests (~160 lines) → PR 2: Frontend (~350 lines) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Contract + Tests | PR 1 | VetRegistry.sol + Hardhat suite. Standalone, merges to main. |
| 2 | Frontend (types, hooks, UI, nav) | PR 2 | Depends on PR 1 for ABI/address. Full frontend deliverable. |

## Phase 1: Contract (VetRegistry.sol)

- [x] 1.1 Add `OwnerInfo` struct, `_owners` mapping, `_registeredOwnerAddresses` array, `OwnerRegistered` event
- [x] 1.2 Add `registerAsOwner(name)` — validate 2–32 chars, re-registration updates name, emit event
- [x] 1.3 Add `getRegisteredOwners()` — iterate array, return `OwnerInfo[] memory`
- [x] 1.4 Add `getPetsByOwner(address)` — iterate `_petCount`, filter by owner, return `uint256[] memory`

## Phase 2: Tests (Hardhat)

- [x] 2.1 Test `registerAsOwner` — first-time, re-registration (name update), empty name revert
- [x] 2.2 Test `getRegisteredOwners` — no owners, single, multiple
- [x] 2.3 Test `getPetsByOwner` — 0/1/many pets, non-existent address
- [x] 2.4 Verify full existing test suite passes unchanged

## Phase 3: Pet Type Fix

- [x] 3.1 Add `owner: string` to `Pet` interface in `pets/types/pet.ts`
- [x] 3.2 Add `owner` to mock entries in `pets/services/mock/petService.ts`
- [x] 3.3 Map `r.owner` in `pets/services/web3/petService.ts` (stop destructuring it out)
- [x] 3.4 Add `owner` to `PetResponse` + mapper in `pets/services/petService.ts`

## Phase 4: Owner Hooks & Types

- [x] 4.1 Create `owners/types/owner.ts` — `Owner { address: string; name: string }`
- [x] 4.2 Create `hooks/web3/useRegisterOwner.ts` — write hook, TxState pattern
- [x] 4.3 Create `hooks/web3/useRegisteredOwners.ts` — read hook via `useReadContract`
- [x] 4.4 Create `hooks/web3/usePetsByOwner.ts` — read hook via `useReadContract`

## Phase 5: Owner UI

- [x] 5.1 Create `owners/views/OwnerRegistrationView.tsx` — name form + TxState feedback
- [x] 5.2 Create `owners/views/OwnerDashboardView.tsx` — filtered pets + unpaid appointments + Pay button
- [x] 5.3 Create `owners/pages/OwnerPage.tsx` — `useAccount()` → registered? Dashboard : RegistrationForm

## Phase 6: Vet-Side Dropdown (PetsOverviewView)

- [x] 6.1 Add `useRegisteredOwners()` call; replace hidden address input with dropdown of registered owners + free-text fallback address field

## Phase 7: Navigation

- [x] 7.1 `NavBar.tsx` — add "My Pets" link to `/owner`
- [x] 7.2 `router.tsx` — add `{ path: "/owner", element: <OwnerPage /> }`
