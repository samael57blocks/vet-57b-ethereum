# Proposal: Appointments Page

## Intent

Enable viewing and scheduling medical appointments for registered pets. Contract stores appointments but exposes no view functions to read them. Frontend `/appointments` route currently 404s.

## Scope

### In Scope
- View functions: `getAppointment`, `getPetAppointments`, `getAppointmentCount` in VetRegistry
- Contract tests for new functions + redeploy to local Hardhat
- Appointments page: pet selector, appointment list, schedule form
- Service factory (interface → mock / web3) matching pet-registration pattern
- TanStack Query hooks for read/write with auto-invalidation
- Router, Page, View, component tests
- Rename `appoinments/` → `appointments/`

### Out of Scope
- `payAppointment` (writes to `paidValue`, no mutation yet)
- Appointment edit/cancel
- Indexer (The Graph)

## Capabilities

### New
- `appointments`: View and schedule medical appointments

### Modified
- `vet-contract`: Add view function requirements
- `contract-reads`: Appointments query hooks

## Approach

Mirror pet-registration architecture:
1. Add view functions to VetRegistry, update ABI + redeploy
2. Create `appointments/` service layer (`IAppointmentService`, `MockAppointmentService`, `Web3AppointmentService`)
3. Expose `useAppointments(petId)` (read) and `useScheduleAppointment()` (write) hooks
4. Wire `AppointmentsPage` → `AppointmentsView` with pet dropdown → list → schedule dialog
5. Add `/appointments` route to router (NavBar link already exists)

Data flow: Router → Page → Hook (TanStack Query) → Service → Contract

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contracts/VetRegistry.sol` | Mod | + view functions |
| `test/VetRegistry.test.ts` | Mod | + appointment read tests |
| `web-app/src/hooks/web3/contract.ts` | Mod | + ABI entries |
| `web-app/src/hooks/web3/useAppointments.ts` | Mod | real hooks replace placeholder |
| `web-app/src/appoinments/` → `appointments/` | Rename | fix folder typo |
| `web-app/src/appointments/` | New | services, hooks, pages, views, tests |
| `web-app/src/router.tsx` | Mod | + `/appointments` route |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Redeploy loses pets | High (local) | Acceptable — seed via tests |
| Folder rename breaks imports | Med | Single commit `git mv` + all import updates |
| View functions cost gas | Low | Views are off-chain reads, 0 gas |

## Rollback

Revert the commit. Contract: revert .sol + ABI + redeploy. Frontend: revert new files + rename.

## Dependencies

- Hardhat node running for redeploy
- Existing deployment scripts

## Success Criteria

- [ ] All 3 view functions pass contract tests
- [ ] `/appointments` renders (not 404)
- [ ] Select pet → see appointments list
- [ ] Schedule appointment → tx feedback → list auto-refreshes
