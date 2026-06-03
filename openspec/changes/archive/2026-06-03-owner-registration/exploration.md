# Exploration: On-Chain Owner Registration

## Current State

### Contract (VetRegistry.sol)
- `MedicalRecord` struct already has `address owner` field
- `registerPet()` already accepts `address owner` parameter
- Payment functions (`payAppointmentToken`, `payAppointmentEth`) are already gated by `msg.sender == _medicalRecords[...].owner`
- Uses OpenZeppelin `AccessControl` with `VET_ROLE` and `DEFAULT_ADMIN_ROLE`
- **No owner registration mechanism exists** — owners are passive entries in the `owner` field of a MedicalRecord
- **No `cancelAppointment` function exists**
- **No way to query pets by owner address** on-chain (would require iterating all pets)

### Frontend (web-app/)
- React 19 + Vite 7 + TypeScript 5.9 + wagmi 3.6 + viem 2.48 + TanStack Query 5
- Service factory pattern: `MockService` / `Web3Service` / `AxiosService` per domain
- Write hooks follow a consistent pattern: `useWriteContract` → stable tx hash → `useWaitForTransactionReceipt` → derived `TxState`
- Read hooks use `useReadContract` (wagmi) for single calls, or viem `publicClient.readContract` in service layer for batch reads
- `Pet` type does NOT include the `owner` field (only id, name, age, animalType, caretakerName, caretakerPhone)
- Router has 2 routes: `/` (PetsOverview) and `/appointments`
- NavBar has "Pets" and "Appointments" links + Connect Wallet button
- Current Register Pet form passes `address` (connected wallet) as the `owner` — meaning only the connected vet can be the owner, which contradicts the intended flow

### Backend Indexer (feature/go-backend-indexer)
- REST API serves `/api/v1/pets` and `/api/v1/pets/{petId}/appointments` from indexed blockchain events
- Pets and appointments are served from a database populated by indexing `MedicalRecordCreated` and `MedicalAppointmentCreated` events

### Tests
- Hardhat tests in `test/VetRegistry.test.ts` — comprehensive test suite for pet registration, appointments, payments, access control
- Frontend tests minimal — only 1 test file found (`usePayAppointmentToken.test.tsx`)

---

## Affected Areas

### Contract Layer
| File | Why Affected |
|------|-------------|
| `contracts/VetRegistry.sol` | Add `registerAsOwner`, `_registeredOwners` mapping + array, `getRegisteredOwners()`, `getPetsByOwner()`, and optionally `cancelAppointment` |
| `test/VetRegistry.test.ts` | Add test suites for owner registration, owner-facing queries, and cancellation |
| `web-app/src/hooks/web3/abis.ts` | Auto-generated — must regenerate after contract changes |

### Frontend — Data Layer
| File | Why Affected |
|------|-------------|
| `web-app/src/pets/types/pet.ts` | Add `owner` field to `Pet` interface (currently missing — VITAL for owner dashboard) |
| `web-app/src/pets/services/petService.ts` + mock/web3 | Add `owner` to Pet mapping; `Web3PetService` needs to return owner from MedicalRecord |
| `web-app/src/appointments/services/appointmentService.ts` + mock/web3 | No change needed — appointments already reference petId |
| `web-app/src/hooks/web3/contract.ts` | Add new ABI exports for owner functions (if not auto-generated) |
| `web-app/src/hooks/web3/useRegisterPet.ts` | The current form uses `address` (vet's wallet) as owner — needs to change to accept a selected registered owner address |

### Frontend — New Owner Features
| File | Why Affected |
|------|-------------|
| `web-app/src/hooks/web3/useRegisterOwner.ts` | **New** — write hook for `registerAsOwner` (follows existing TxState pattern) |
| `web-app/src/hooks/web3/useRegisteredOwners.ts` | **New** — read hook for `getRegisteredOwners()` |
| `web-app/src/hooks/web3/usePetsByOwner.ts` | **New** — read hook for `getPetsByOwner()` |
| `web-app/src/hooks/web3/useCancelAppointment.ts` | **New** — write hook for `cancelAppointment` (if implemented) |
| `web-app/src/owners/views/OwnerRegistrationView.tsx` | **New** — UI for owner to connect wallet + sign registration tx |
| `web-app/src/owners/pages/OwnerPage.tsx` | **New** — Owner dashboard page (list their pets + appointments, pay, cancel) |
| `web-app/src/owners/types/owner.ts` | **New** — Owner type (address, name) |
| `web-app/src/owners/hooks/useOwnerAppointments.ts` | **New** — fetch appointments for owner's pets |

### Frontend — Vet-Side Enhancements
| File | Why Affected |
|------|-------------|
| `web-app/src/pets/views/PetsOverviewView.tsx` | Replace `address` (vet wallet) with a `<select>` dropdown of registered owners in Register Pet dialog |
| `web-app/src/common/components/NavBar.tsx` | Add "My Pets" link for connected owners |
| `web-app/src/router.tsx` | Add `/owner` route for owner dashboard |
| `web-app/src/App.tsx` | No change — Outlet pattern already flexible |

### Backend Indexer (if applicable)
| File | Why Affected |
|------|-------------|
| Go backend event handlers | Index `OwnerRegistered` event to a new `owners` table |
| Go backend API | Add `GET /api/v1/owners` endpoint for dropdown data |
| Frontend petService Axios | Add `owner` field mapping to `PetResponse` |

### Tests
| File | Why Affected |
|------|-------------|
| `test/VetRegistry.test.ts` | New describe blocks: "Owner Registration", "Owner Queries", "Appointment Cancellation" |
| Web3 hook tests | New tests for `useRegisterOwner`, `usePetsByOwner`, `useCancelAppointment` |

---

## Approaches

### 1. Contract Design — Owner Data Structure

**Approach 1A: Mapping + Array (standard pattern)**
- `mapping(address => OwnerInfo) private _owners` where `OwnerInfo { string name; bool registered; }`
- `address[] private _registeredOwnerAddresses` for enumeration
- `getRegisteredOwners()` returns array of `(address, string name)` tuples
- **Pros**: Clean, standard Solidity pattern, gas-efficient reads, iterable
- **Cons**: Array can grow unbounded (DDoS risk on `getRegisteredOwners` iteration)
- **Effort**: Low

**Approach 1B: EnumerableSet from OpenZeppelin**
- Use `EnumerableSet.AddressSet` for registered owners
- `getRegisteredOwners()` converts to array
- **Pros**: Built-in contains/remove, OZ audited, handles DDoS via iteration cost naturally
- **Cons**: Slightly higher gas per insertion, adds dependency
- **Effort**: Low-Medium (already have OZ deps)

**Approach 1C: Just a mapping, skip enumeration**
- Only `mapping(address => OwnerInfo)`, no array
- Vets must know the address beforehand (UX regression)
- Not recommended — defeats the dropdown UX goal

**Recommendation**: **1A** — Simple, no new dependency, and the owner set is expected to be small (vet clinic client base). The gas cost of iterating 100-200 owners is negligible for a view function.

### 2. `getPetsByOwner` — Implementation

**Approach 2A: On-chain iteration (solidity view function)**
- Iterate `_petCount`, check `_medicalRecords[i].owner == address`
- Return matching IDs
- **Pros**: No indexer dependency, works immediately
- **Cons**: Gas-heavy if many pets; but as a `view` function, no actual gas cost to caller
- **Effort**: Low

**Approach 2B: Frontend filtering + multicall**
- Fetch all pets via existing `getPetCount` + loop on frontend
- Filter by owner on the frontend
- **Pros**: No new contract function
- **Cons**: Inefficient for large datasets, duplicates existing Web3PetService pattern
- **Effort**: None (contract), Medium (frontend changes)

**Recommendation**: **2A** — a `getPetsByOwner(address)` view function is cheap and clean. The frontend can call it directly from `useReadContract` instead of doing the batch loop itself.

### 3. Appointment Cancellation

**Approach 3A: Include cancelAppointment**
- `cancelAppointment(uint256 id)` — only the pet owner can cancel
- Sets `_appointments[id].cancelled = true` (requires adding `bool cancelled` to struct)
- Alternative: delete slot or zero out values
- **Pros**: Full owner autonomy UX
- **Cons**: Added complexity, requires storage change to MedicalAppointment struct, state migration or re-deploy

**Approach 3B: Skip cancellation for now**
- Owner can see their appointments and pay them
- Cancellation can be a future iteration
- **Pros**: Smaller scope, faster delivery
- **Cons**: Incomplete owner experience

**Approach 3C: Cancel = set paidValue to max (hack)**
- Reuse `paidValue == appointmentValue` as "cancelled" sentinel
- **Pros**: No storage changes
- **Cons**: Hides actual paid status, bad practice

**Recommendation**: **3B** — Skip cancellation for now. The spec lists it as a question, not a requirement. Ship owner registration + dashboard first. Cancellation can be a follow-up change.

### 4. Frontend — Owner Registration UI Pattern

**Approach 4A: Dedicated page (new route)**
- `/owner` route with registration view + dashboard
- Connect wallet → see if already registered → "Register as Owner" button → sign tx → dashboard
- **Pros**: Clear UX separation, follows existing page pattern
- **Cons**: Another page in the router

**Approach 4B: Owner dialog on existing Pets page**
- Add an "I'm a Pet Owner" link somewhere that opens a registration modal
- Dashboard replaces the pets list when wallet is an owner
- **Pros**: Less navigation
- **Cons**: Mixed concerns (vet + owner in same view), confusing UX

**Recommendation**: **4A** — Dedicated page. Clean separation of concerns. NavBar shows "My Pets" when a registered owner wallet is connected.

### 5. Register Pet Dialog — Owner Dropdown

**Approach 5A: Replace `address` with dropdown**
- `useRegisteredOwners()` fetches the list of `(address, name)` pairs
- Dropdown replaces the hidden `address` field
- Selected owner address passed as the `owner` parameter to `registerPet`
- **Pros**: Correct UX flow (vet selects the owner)
- **Cons**: Changes current behavior where vet = owner (that's intended)

**Approach 5B: Keep address field but add dropdown as convenience**
- Show dropdown + allow manual address input (fallback if owner isn't registered)
- **Pros**: Backward compatibility, edge cases covered
- **Cons**: More UI complexity

**Recommendation**: **5A** + a free-text fallback. The dropdown is the primary UX, but allow the vet to type an address for unregistered owners (e.g. walk-in clients). This gives both convenience AND flexibility.

### 6. Data Flow — `Pet` type owner field

The `Pet` type MUST include `owner` to enable the owner dashboard. Currently it doesn't.

**Approach 6A: Add `owner: string` to Pet interface**
- `Web3PetService` already reads `record.owner` from the contract but discards it
- `AxiosPetService` needs backend to include `owner` in response
- `MockPetService` needs mock data with owner
- **Effort**: Low-Medium (straightforward field addition)

**Approach 6B: Separate `usePetOwner(petId)` hook**
- Keep Pet type clean, fetch owner separately
- **Pros**: No type changes
- **Cons**: N+1 queries for dashboard, more hooks

**Recommendation**: **6A** — The `owner` field is part of the on-chain MedicalRecord. Dropping it in the frontend is a data loss bug. Adding it is the correct fix.

---

## Recommendation

1. **Contract**: Add `registerAsOwner` + `_registeredOwners` (mapping + array) + `OwnerRegistered` event + `getRegisteredOwners()` + `getPetsByOwner(address)`. Do NOT add `cancelAppointment` — defer to follow-up.

2. **Frontend — Owner-side**: New `/owner` route with registration form + dashboard showing pets + appointments + pay button. NavBar shows "My Pets" when registered owner.

3. **Frontend — Vet-side**: Register Pet dialog dropdown of registered owners instead of hidden `address`. Add `owner: string` to Pet type.

4. **Backend**: If using the Go backend indexer, index `OwnerRegistered` events, add `/api/v1/owners` endpoint. Low priority — the contract view functions make this optional.

5. **Tests**: Full Hardhat test suite for all new functions (owner registration, owner queries, owner gating). Frontend component/hook tests for new UI.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Register Pet form changes behavior**: Currently passes `address` (vet wallet) as owner. After change, vet selects from dropdown. Existing pets would still have vet as owner. | Medium | Communicate clearly; migration is backward-compatible since `owner` is just a field |
| **Array iteration gas cost**: `getRegisteredOwners()` loops over the full array. If thousands of owners register, this view function could timeout in some RPCs. | Low | Clinic context — unlikely to have >1000 owners. If needed, add pagination later (start + limit params) |
| **Backend indexer divergence**: If the Go backend indexes owner data, the frontend has two sources of truth (contract vs backend) | Low | Keep contract view functions as the source of truth; backend is a convenience for list queries |
| **`getPetsByOwner` iteration cost**: Loops over ALL pets on-chain. For large pet counts, may timeout. | Low | View function (no gas cost). If TIMEOUT becomes an issue, use the backend indexer API instead |
| **Owner Dashboard wallet connection**: Owner must be connected with the same wallet they registered with | Low | useAccount provides address; hook compares with connected wallet |
| **Contract already deployed**: Any contract change requires re-deployment. Existing state (MedicalRecords) is preserved since we're only adding new storage. | Low | Append-only changes to storage are backward compatible |

---

## Ready for Proposal

**Yes**.

The feature has clear scope, well-understood patterns to follow (every existing contract function + hook has a template to replicate), and no architectural blockers. The main decisions to lock in for the proposal:

1. Include `cancelAppointment` or defer? → **Defer**
2. On-chain `getPetsByOwner` or frontend filter? → **On-chain view function**
3. Owner data structure: mapping + array vs EnumerableSet → **Mapping + array (simple)**
4. Backend indexer changes in scope? → **Low priority — document but defer**
