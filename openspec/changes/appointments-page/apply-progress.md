# Apply Progress: Appointments Page — PR 3 of 3

## Batch
- **Batch**: PR 3 (UI Components + Tests)
- **Previous batch**: PR 2 (Rename + Service Layer + Hooks) — [x] all tasks complete
- **This batch**: Tasks 4.1–5.2

## Mode
Standard (no strict TDD)

## Completed Tasks

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 2.1 | `git mv` appoinments → appointments | ✅ | Single atomic commit `2be8b62`. No stale import references found. |
| 2.2 | `IAppointmentService` interface + factory | ✅ | Created `appointmentService.ts` — mirrors `petService.ts` pattern exactly |
| 2.3 | Mock appointment service | ✅ | Created `mock/appointmentService.ts` — 2 hardcoded samples matching `MedicalAppointment` type |
| 2.4 | Web3 appointment service | ✅ | Created `web3/appointmentService.ts` — viem publicClient, `getPetAppointments` → `getAppointment` per ID |
| 3.1 | `useAppointments` TanStack Query hook | ✅ | Created `hooks/useAppointments.ts` with key `['vetRegistry', 'appointments', { petId }]` |
| 3.2 | Refactor `useScheduleAppointment` + remove placeholder | ✅ | Added `TxState` discriminated union, `reset()` function, removed old `useAppointments()` |
| 3.3 | Query invalidation | ✅ | `useEffect` watching `isConfirmed` → `queryClient.invalidateQueries(APPOINTMENTS_QUERY_KEY)` |
| 4.1 | Add `/appointments` route to `router.tsx` | ✅ | Imported `AppointmentsPage` and added route before catch-all |
| 4.2 | Create `AppointmentsPage.tsx` | ✅ | Page fetches pets + appointments, manages `selectedPetId` state |
| 4.3 | Create `AppointmentsView.tsx` | ✅ | WalletGuard, PetSelector, AppointmentList with AppointmentCard, EmptyState |
| 4.4 | Create ScheduleDialog with form + tx feedback | ✅ | Inline modal in AppointmentsView, uses `useScheduleAppointment` internally |
| 5.1 | Hook tests for `useAppointments` | ✅ | 4 tests: loading, data, disabled when null, error |
| 5.2 | View component tests for `AppointmentsView` | ✅ | 14 tests: wallet guard, pet selector, list, empty, validation, tx feedback |

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `web-app/src/router.tsx` | Modified | Added import + route for AppointmentsPage |
| `web-app/src/appointments/pages/AppointmentsPage.tsx` | Created | Page component — pets fetching, appointments fetching, selectedPetId state |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Created | View with WalletGuard, PetSelector, AppointmentList, ScheduleDialog |
| `web-app/src/appointments/hooks/__tests__/useAppointments.test.tsx` | Created | Hook tests for useAppointments with mocked service |
| `web-app/src/appointments/views/__tests__/AppointmentsView.test.tsx` | Created | View component tests for all UI states |

## Deviations from Design
None — implementation matches design.

## Issues Found
None.

## Verification Results
- `npx hardhat test` — 17 passing (no regression)
- `npx tsc --noEmit` — clean (no errors)
- `npx vite build` — builds successfully
- `npx vitest run` — 23 tests passing (3 test files, including existing 5 from pets)

## Status
13/13 tasks complete. All phases done. Ready for verify / archive.
