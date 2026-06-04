# Design: On-Chain Owner Registration

## Technical Approach

Append-only contract extension: add `OwnerInfo` struct + `mapping` + dynamic array to `VetRegistry.sol`. No storage migration needed. Frontend adds `/owner` route with registration form + dashboard. Register Pet dialog switches from hidden `address` to a dropdown of on-chain registered owners. Follows existing TxState discriminated union (idle→pending→processing→success/error) and service factory (Mock/Axios/Web3) patterns.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Owner storage | `mapping` + `address[]` | EnumerableSet | Clinic < 200 owners. Mapping+array is simpler, no OZ dependency overhead. |
| `getPetsByOwner` | Iterate `_petCount`, filter by `owner` | Separate mapping | Read-only view, cheap at small scale (< 500 pets). No write-path changes needed. |
| `getRegisteredOwners` return type | `OwnerInfo[] memory` | Two parallel arrays | Single return simplifies frontend mapping. Struct is the idiomatic Solidity pattern. |
| Owner dashboard data source | Contract view calls + existing service hooks | New indexer endpoint | No backend changes required. Owner dashboard uses existing `usePetsOverview` + `useAppointments` filtered client-side. |
| Pet `owner` field | Add to `Pet` interface, map in all services | Omit | Fixes data loss bug: contract stores `owner` but frontend discards it. |
| Dropdown fallback | Free-text address input below the dropdown | Always require dropdown | Walk-in clients don't have registered wallets. Free-text preserves the existing flow. |

## Data Flow

```
Registration:
  OwnerForm ──→ useRegisterOwner ──→ wagmi useWriteContract ──→ registerAsOwner()
       │                                                              │
       └── txState: idle→pending→processing→success/error ←───────────┘

Dashboard (Owner Page):
  /owner ──→ OwnerPage
                ├── useAccount() (connected wallet)
                ├── useRegisteredOwners() → isRegistered check
                ├── usePetsOverview() → filter by connected wallet
                └── useAppointments() → filter by filtered pet IDs
                        │
                        └── PayAppointmentModal (existing)

Register Pet (Vet side):
  Register dialog ──→ useRegisteredOwners() → dropdown of [{address, name}]
  Vet selects owner ──→ useRegisterPet({...owner: selectedAddress})
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `contracts/VetRegistry.sol` | Modify | Add `OwnerInfo` struct, `_owners` mapping, `_registeredOwnerAddresses` array, `OwnerRegistered` event, `registerAsOwner()`, `getRegisteredOwners()`, `getPetsByOwner()` |
| `test/VetRegistry.test.ts` | Modify | Add `Owner Registration` and `Owner Queries` describe blocks |
| `web-app/src/pets/types/pet.ts` | Modify | Add `owner: string` field to `Pet` interface |
| `web-app/src/pets/services/mock/petService.ts` | Modify | Add `owner: "0x..."` to mock entries |
| `web-app/src/pets/services/web3/petService.ts` | Modify | Map `r.owner` → `pet.owner` (currently destructured out) |
| `web-app/src/pets/services/petService.ts` | Modify | Add `owner` to `PetResponse` interface + mapper |
| `web-app/src/pets/views/PetsOverviewView.tsx` | Modify | Replace `address` (connected wallet) with owner dropdown. Add `useRegisteredOwners()` call. Keep free-text fallback for walk-ins. |
| `web-app/src/hooks/web3/useRegisterPet.ts` | Modify | No change needed — already accepts `owner: address` param. Frontend passes selected dropdown value. |
| `web-app/src/owners/types/owner.ts` | Create | `Owner { address: string; name: string }` |
| `web-app/src/owners/views/OwnerRegistrationView.tsx` | Create | Register form + TxState feedback |
| `web-app/src/owners/views/OwnerDashboardView.tsx` | Create | Shows connected owner's pets + unpaid appointments + Pay button |
| `web-app/src/owners/pages/OwnerPage.tsx` | Create | Decides: if registered → dashboard, else → registration form |
| `web-app/src/hooks/web3/useRegisterOwner.ts` | Create | Write hook for `registerAsOwner` (follows TxState pattern) |
| `web-app/src/hooks/web3/useRegisteredOwners.ts` | Create | Read hook using `useReadContract` for `getRegisteredOwners()` |
| `web-app/src/hooks/web3/usePetsByOwner.ts` | Create | Read hook using `useReadContract` for `getPetsByOwner()` |
| `web-app/src/common/components/NavBar.tsx` | Modify | Add "My Pets" link → `/owner` |
| `web-app/src/router.tsx` | Modify | Add `{ path: "/owner", element: <OwnerPage /> }` |

## Interfaces / Contracts

```solidity
struct OwnerInfo { address wallet; string name; bool registered; }
mapping(address => OwnerInfo) private _owners;
address[] private _registeredOwnerAddresses;

event OwnerRegistered(address indexed owner, string name);

function registerAsOwner(string calldata name) external; // anyone can call
function getRegisteredOwners() external view returns (OwnerInfo[] memory);
function getPetsByOwner(address owner) external view returns (uint256[] memory);
```

```typescript
// Owner type
interface Owner { address: string; name: string; }

// Pet type — adds owner field
interface Pet {
  id: string;
  name: string;
  age: number;
  animalType: AnimalType;
  caretakerName: string;
  caretakerPhone: string;
  owner: string; // NEW
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Contract | `registerAsOwner` — happy path, duplicate (revert), empty name (revert), event emission | Hardhat (Mocha+Chai) |
| Contract | `getRegisteredOwners` — empty array, single owner, multiple owners | Hardhat |
| Contract | `getPetsByOwner` — owner with 0/1/many pets, non-existent address returns empty | Hardhat |
| Contract | Backward compat — existing tests pass unchanged | Run full suite |

No frontend tests (TDD disabled per project conventions).

## Open Questions

None.
