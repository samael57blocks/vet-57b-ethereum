# Design: Appointments Page

## Technical Approach

Mirror the proven pet-registration pattern across all layers: contract view functions → service factory (interface | mock | web3) → TanStack Query hook → Page → View. Data flow is unidirectional: contract read → hook cache → view render. Writes go through `scheduleAppointment` with TxState lifecycle, then auto-invalidate the appointments query.

## Architecture Decisions

### Decision: Contract View Functions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Event sourcing (index events client-side) | Requires indexed events + client-side filtering; fragile if events are pruned | **Rejected** — adds complexity without benefit at local clinic scale |
| Direct view functions on struct mapping | O(1) per lookup; `getPetAppointments` requires iteration | **Selected** — 3 functions below |

```
function getAppointment(uint256 id) external view returns (MedicalAppointment memory)
  → revert if id == 0 || id > _appointmentCount

function getPetAppointments(uint256 petId) external view returns (uint256[] memory)
  → loop i=1.._appointmentCount, collect where _appointments[i].petId == petId
  → O(n) — acceptable for <1000 appointments

function getAppointmentCount() external view returns (uint256)
  → return _appointmentCount
```

### Decision: Rename Strategy

**Choice**: Single atomic commit: `git mv src/appoinments/ src/appointments/` + update all imports in same commit.
**Rationale**: Any intermediate state breaks the build. One commit means clean rollback. No other files reference the typo folder.

### Decision: Service Factory Pattern

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Direct contract calls in hook | Ties hook to web3; no testability | **Rejected** |
| Service factory (interface → mock | web3) | Testable, swappable via env var, matches existing pattern | **Selected** — same as `petService.ts` |

Interface:
```typescript
export interface IAppointmentService {
  getAppointments: (petId: string) => Promise<MedicalAppointment[]>;
}
```

Factory selects implementation via `VITE_USE_MOCK_DATA` env var, identical to `PetService`.

### Decision: Query Hook

**Choice**: `useAppointments(petId)` with TanStack Query key `['vetRegistry', 'appointments', { petId }]`.
**Rationale**: Structured key factory enables targeted invalidation after `scheduleAppointment` writes. The existing `useScheduleAppointment` hook keeps its signature but gets a `txState` wrapper (matching `useRegisterPet`'s TxState pattern) so the view can render lifecycle feedback.

### Decision: Write Hook — Replace Placeholder

The existing `useAppointments()` placeholder (returns `[]`) is replaced by the real TanStack Query hook. The existing `useScheduleAppointment` in `useAppointments.ts` is refactored to expose a `txState: TxState` object (same pattern as `useRegisterPet`), enabling the view to drive the transaction feedback dialog.

## Data Flow

```
                    READ FLOW
Router ─→ AppointmentsPage ─→ useAppointments(petId) ─→ AppointmentService.getAppointments(petId)
                                     │                          ├── MockAppointmentService (dev)
                                     │                          └── Web3AppointmentService (prod)
                                     │                                ├── getAppointmentCount()
                                     │                                ├── getPetAppointments(petId)
                                     │                                └── getAppointment(id) per ID
                                     │
                               TanStack Query cache
                                     │
                                     ↓
                              AppointmentsView
                           ┌───────┼───────┐
                     WalletGuard  PetSelector  AppointmentList  ScheduleDialog
                                                └── AppointmentCard (×N)

                    WRITE FLOW
ScheduleDialog ─→ useScheduleAppointment ─→ scheduleAppointment(...) ─→ MetaMask
         ↑                                                                    │
         │                                                            txHash received
         │                                                                    │
         └── onSuccess: invalidate(['vetRegistry', 'appointments']) ←── confirmed
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `contracts/VetRegistry.sol` | Modify | Add `getAppointment`, `getPetAppointments`, `getAppointmentCount` |
| `test/VetRegistry.test.ts` | Modify | Add tests for 3 new view functions |
| `web-app/src/hooks/web3/contract.ts` | Modify | Add ABI entries for 3 new view functions |
| `web-app/src/appoinments/` → `appointments/` | Rename | Fix typo — `git mv` + update imports |
| `web-app/src/appointments/types/medicalAppointment.ts` | Keep | Already exists after rename |
| `web-app/src/appointments/services/appointmentService.ts` | Create | Interface `IAppointmentService` + factory |
| `web-app/src/appointments/services/mock/appointmentService.ts` | Create | Mock with 2 sample appointments |
| `web-app/src/appointments/services/web3/appointmentService.ts` | Create | Web3 impl via viem publicClient |
| `web-app/src/appointments/hooks/useAppointments.ts` | Create | TanStack Query hook for read |
| `web-app/src/appointments/pages/Appointments.tsx` | Create | Page component — fetches data, passes to view |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Create | View component — UI + form + tx feedback |
| `web-app/src/router.tsx` | Modify | Add `{ path: "/appointments", element: <AppointmentsPage /> }` |
| `web-app/src/hooks/web3/useAppointments.ts` | Modify | Replace read placeholder with `useScheduleAppointment` refactor (add TxState) |

## Component Tree & Responsibilities

```
AppointmentsPage
│   Uses: usePetsOverview (for pet dropdown), useAppointments(petId)
│   State: selectedPetId, dialogOpen
│   Handles: data fetching, loading/error states
│
└── AppointmentsView
    │   Props: pets, appointments, selectedPetId, txState, callbacks
    │
    ├── WalletGuard (shown when !isConnected)
    ├── PetSelector (dropdown from pets list)
    ├── AppointmentList
    │   ├── AppointmentCard (per item: date, time, value, paid status)
    │   └── EmptyState ("No appointments scheduled")
    └── ScheduleDialog (modal)
        ├── Form (pet read-only, date picker, time input, value input)
        ├── Validation errors
        └── TxFeedback (pending → processing → success/error)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Contract | `getAppointment`, `getPetAppointments`, `getAppointmentCount` | Hardhat chai tests — existing pattern in `VetRegistry.test.ts` |
| Hook | `useAppointments` loads data, invalidates on write | Mock service + `renderHook` + QueryClientProvider |
| View | Wallet guard, pet selector, empty state, form validation, tx feedback | React Testing Library — mock hooks |
| E2E | Full flow: select pet → see list → schedule → list refreshes | Playwright / manual on local Hardhat |

## Migration / Rollout

1. **Contract**: Add view functions → `npx hardhat compile` → `npx hardhat run scripts/deploy.ts` → update `.env` with new address
2. **Frontend**: Rename folder → create files → update router → done
3. No data migration — view functions read existing state

## Open Questions

None — all decisions resolved in proposal + specs.
