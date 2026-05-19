# Tasks: Appointments Page

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600-700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (contract) → PR 2 (services + hooks) → PR 3 (UI + tests) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Contract view functions + tests + ABI | PR 1 | Standalone; independent of frontend |
| 2 | Rename + service layer + hooks | PR 2 | Depends on PR 1 ABI for Web3 service |
| 3 | Page/View/UI components + tests | PR 3 | Depends on PR 2 hooks |

**Total estimated: ~600–700 lines** — exceeds the 400-line review budget. Above split yields PR 1 at ~115 lines, PR 2 at ~170 lines, PR 3 at ~350 lines.

---

## Phase 1: Contract — View Functions

- [ ] 1.1 Add `getAppointment(id)`, `getPetAppointments(petId)`, `getAppointmentCount()` to `contracts/VetRegistry.sol`
- [ ] 1.2 Add Hardhat tests for 3 new view functions in `test/VetRegistry.test.ts` (existing + revert + empty + multi scenarios per spec)
- [ ] 1.3 Compile (`npx hardhat compile`), deploy to localhost, update `.env` with new address + add ABI entries to `web-app/src/hooks/web3/contract.ts`

## Phase 2: Foundation — Rename + Service Layer

- [ ] 2.1 `git mv src/appoinments/ src/appointments/` + fix all import paths in a single atomic commit
- [ ] 2.2 Create `web-app/src/appointments/services/appointmentService.ts` — `IAppointmentService` interface + `AppointmentService` factory (env-var gated, mirrors `petService.ts`)
- [ ] 2.3 Create `web-app/src/appointments/services/mock/appointmentService.ts` — hardcoded sample appointments list matching existing type
- [ ] 2.4 Create `web-app/src/appointments/services/web3/appointmentService.ts` — reads via viem publicClient: `getAppointmentCount()` → `getPetAppointments(petId)` → `getAppointment(id)` per ID

## Phase 3: Hooks — Read + Write

- [ ] 3.1 Create `web-app/src/appointments/hooks/useAppointments.ts` — TanStack Query hook with key `['vetRegistry', 'appointments', { petId }]`, calls `AppointmentService.getAppointments(petId)`
- [ ] 3.2 Refactor `web-app/src/hooks/web3/useAppointments.ts`:
  - Remove the `useAppointments()` placeholder (replaced by 3.1)
  - Refactor `useScheduleAppointment()` to expose `txState: TxState` (same pattern as `useRegisterPet` — idle/pending/processing/success/error)
- [ ] 3.3 Wire query invalidation: on `useScheduleAppointment` success → `queryClient.invalidateQueries({ queryKey: ['vetRegistry', 'appointments'] })`

## Phase 4: UI — Page + View + Router

- [ ] 4.1 Add `{ path: "/appointments", element: <AppointmentsPage /> }` to `web-app/src/router.tsx`
- [ ] 4.2 Create `web-app/src/appointments/pages/AppointmentsPage.tsx` — data fetching via `usePetsOverview` + `useAppointments(petId)`, loading/error/empty states, passes data to view
- [ ] 4.3 Create `web-app/src/appointments/views/AppointmentsView.tsx`:
  - WalletGuard when `!isConnected`
  - PetSelector dropdown (from parent-supplied pets list)
  - AppointmentList → AppointmentCard (date, time, value, paid status) per item
  - EmptyState ("No appointments scheduled") when list is empty
- [ ] 4.4 Create `ScheduleDialog` (inline within AppointmentsView or separate component):
  - Form: pet (read-only), date picker (future-only validation), time input, value input
  - Validation errors per field
  - TxFeedback: pending ("Confirm in MetaMask…") → processing ("Transaction processing…") → success/error with retry

## Phase 5: Tests

- [ ] 5.1 Write hook tests for `useAppointments(petId)` — `renderHook` + mocked service + `QueryClientProvider`, verify data loading and cache behavior
- [ ] 5.2 Write view component tests (RTL) for `AppointmentsView`:
  - Wallet guard shows when disconnected, hides when connected
  - Pet selector renders with pet list
  - Empty state shows when no appointments
  - Form validation blocks invalid data (past date, empty time, value ≤ 0)
  - Tx feedback transitions (pending → processing → success auto-invalidate → error with retry)

---

## Acceptance Criteria

- [ ] All 3 view functions pass Hardhat contract tests
- [ ] `npx hardhat compile` passes with new functions
- [ ] `/appointments` route renders (not 404)
- [ ] Select pet from dropdown → appointments list appears
- [ ] Empty state shows "No appointments scheduled" when none exist
- [ ] Wallet guard shows "Connect your wallet to view appointments" when disconnected
- [ ] Schedule form validates: future date, non-empty time, value > 0, pet selected
- [ ] Successful schedule → TxFeedback shows lifecycle → list auto-refreshes
- [ ] User rejection in MetaMask shows error + form stays open for retry
- [ ] Hook tests pass (`vitest run`)
- [ ] View component tests pass (`vitest run`)

## Implementation Order

Contract first (Phase 1) — it's standalone and must deploy before the frontend can read. Then rename (2.1) because every new `appointments/` file must land in the correct directory. Services (2.2–2.4) enable hooks (Phase 3). Hooks enable UI (Phase 4). Tests (Phase 5) verify everything end-to-end. No phase can start before its dependencies.
