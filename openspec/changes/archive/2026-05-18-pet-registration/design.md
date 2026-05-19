# Design: Pet Registration

## Technical Approach

Wire the existing `useRegisterPet` hook into `PetsOverviewView` with wallet guard, expanded form, transaction feedback, and TanStack Query-based auto-refresh. Reads migrate from raw `useEffect`+`setState` to `useQuery` wrapping the existing `PetService.getPets()`, enabling cache invalidation on successful writes.

## Architecture Decisions

### 1. Read hook migration

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `usePetsQuery` hook | Leaves dead code behind | Reject |
| **Replace `usePetsOverview` body with `useQuery`** | Minimal diff, same interface `{pets, loading, error}` | **Accept** |

Same return shape keeps `PetsOverviewPage` unchanged — it still calls the hook, still gets the same three fields. The `error` field normalizes `Error|null` to `string|null` for backward compat.

### 2. Query key ownership

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Magic string `['vetRegistry', 'pets']` everywhere | Duplication, typo risk | Reject |
| **Export const from hook file** | Single source, importable for invalidation | **Accept** |

Define and export `PET_QUERY_KEY = ['vetRegistry', 'pets'] as const` from `usePetsOverview.ts`.

### 3. Success → invalidation wiring

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Expose `onSuccess` callback from `useRegisterPet` | Adds coupling to a generic hook | Reject |
| **`useEffect` + `hasSubmitted` flag in view** | Self-contained, no hook changes, handles stale success on reopen | **Accept** |

View tracks `hasSubmitted` (set on form submit, reset on dialog open). A `useEffect` watches `txState.status === 'success' && hasSubmitted` to invalidate + close.

### 4. Wallet guard

Use `useAccount()` from wagmi in the view. If `!isConnected`, show a banner instead of the "Register Pet" button. No changes to the existing NavBar connect button.

## Data Flow

```
User → [Form submit] → registerPet(params) → useWriteContract
                                                    ↓
                                           MetaMask prompt
                                                    ↓
                                           useWaitForTransactionReceipt
                                                    ↓
                                            txState changes
                                                    ↓
                              useEffect → queryClient.invalidateQueries(PET_QUERY_KEY)
                                                    ↓
                              usePetsOverview (useQuery) → re-fetches → View re-renders
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `web-app/package.json` | Modify | Add vitest, @testing-library/react, @testing-library/jest-dom, jsdom |
| `web-app/vite.config.ts` | Modify | Add `/// <reference types="vitest/config" />` and `test` block |
| `web-app/src/pets/hooks/usePetsOverview.ts` | Modify | Replace `useEffect`+`setState` with `useQuery`; export `PET_QUERY_KEY` |
| `web-app/src/pets/views/PetsOverviewView.tsx` | Modify | Wire `useAccount`, `useRegisterPet`, `useQueryClient`; expand form + validation; add tx feedback states; add wallet guard |
| `web-app/src/pets/views/__tests__/PetsOverviewView.test.tsx` | Create | Unit tests for validation, wallet guard, submit flow |

## Interfaces / Contracts

**Expanded `PetFormData`** (replaces current two-field version):

```ts
interface PetFormData {
  name: string;
  age: string;
  animalType: AnimalType | '';
  caretakerName: string;
  caretakerPhone: string;
}
```

**Validation rules** (new fields):

| Field | Rule |
|-------|------|
| animalType | Must not be `''` — show "Select an animal type" |
| caretakerName | ≥2 chars — show "Caretaker name must have at least 2 characters" |
| caretakerPhone | Non-empty — show "Caretaker phone is required" |

**Transaction feedback mapping** (within dialog, gated by `hasSubmitted`):

```
txState.status  →  Dialog content
───────────────────────────────────────
idle            →  Registration form
pending         →  "Confirm transaction in MetaMask..." + spinner
processing      →  "Transaction processing..." + spinner
success         →  Brief indicator → auto-close + invalidate
error           →  Error message + "Try Again" button
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Validation blocks with empty/invalid fields | Render view, fill partial data, click submit, assert errors rendered, assert `registerPet` NOT called |
| Unit | Wallet guard when disconnected | Mock `useAccount` → `isConnected: false`, assert guard message, assert register button hidden |
| Unit | Successful registration flow | Mock `useAccount` → connected, mock `useRegisterPet` → expose `registerPet` spy + controllable `txState`; fill form, submit, assert tx states rendered |

Mocks: wagmi hooks mocked at module level. `useReadContract`/`useWriteContract`/`useWaitForTransactionReceipt` not directly needed — mock the application-level hooks (`useAccount`, `useRegisterPet` via `vi.mock`).

## Migration / Rollout

No migration required. The `usePetsOverview` replacement is backward-compatible (same interface). If the query migration causes issues, revert `usePetsOverview.ts` to the old implementation — the view changes are independent (the view only needs `useQueryClient` which already exists in Web3Provider).

## Open Questions

- [ ] `usePetsOverview` currently doesn't handle `refetchOnReconnect` or `staleTime` — should we add a 30s `staleTime` to avoid refetching on every mount? (deferrable, not blocking)
- [ ] Test: should the mock service be used in tests (via env var) or mock wagmi direct? Proposal suggests wagmi mocks — confirm direction.
