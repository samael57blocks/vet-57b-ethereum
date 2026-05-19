# Tasks: Pet Registration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full pet-registration implementation | PR 1 | All 4 phases; ~300 lines, within budget. Tests and code in same commit. |

## Phase 1: Foundation

- [x] 1.1 Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` to `web-app/package.json` devDependencies
- [x] 1.2 Add `/// <reference types="vitest/config" />` and `test` block (glob: `src/**/*.test.{ts,tsx}`, environment: `jsdom`) to `web-app/vite.config.ts`

## Phase 2: Query Migration

- [x] 2.1 Replace `useEffect`+`setState` in `web-app/src/pets/hooks/usePetsOverview.ts` with `useQuery` wrapping `PetService.getPets()`; preserve `{pets, loading, error}` return shape (normalize `Error | null` to `string | null`)
- [x] 2.2 Export `PET_QUERY_KEY = ['vetRegistry', 'pets'] as const` from `usePetsOverview.ts` for invalidation imports

## Phase 3: View Expansion

- [x] 3.1 Wire `useAccount` from wagmi in `PetsOverviewView.tsx`; show "Connect your wallet to register a pet" banner when `!isConnected`, hide "Register Pet" button
- [x] 3.2 Wire `useRegisterPet` and `useQueryClient`; expand `PetFormData` with `animalType`, `caretakerName`, `caretakerPhone`; add validation rules (animalType required, caretakerName ≥2 chars, caretakerPhone non-empty)
- [x] 3.3 Add `<select>` for AnimalType (Dog/Cat), text inputs for caretakerName and caretakerPhone to the form
- [x] 3.4 Map `txState` to in-dialog feedback UI: idle→form, pending→"Confirm in MetaMask..." + spinner, processing→spinner, success→auto-close, error→message + "Try Again" button
- [x] 3.5 On `txState.status === 'success' && hasSubmitted`: close dialog, call `queryClient.invalidateQueries(PET_QUERY_KEY)`

## Phase 4: Tests

- [x] 4.1 Create `web-app/src/pets/views/__tests__/PetsOverviewView.test.tsx` with vitest; mock wagmi `useAccount` and `useRegisterPet` at module level
- [x] 4.2 Test: validation blocks invalid data — fill form with empty/partial fields, submit, assert error messages rendered, `registerPet` NOT called
- [x] 4.3 Test: wallet guard — mock `useAccount` returns `{ isConnected: false }`, assert guard message visible, register button hidden
- [x] 4.4 Test: successful flow — mock connected wallet + controlled `txState`, fill valid form, assert feedback states idle→pending→processing→success
