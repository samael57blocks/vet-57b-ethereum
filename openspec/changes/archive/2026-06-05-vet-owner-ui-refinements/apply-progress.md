## Apply Progress: vet-owner-ui-refinements

### Mode
Standard (Strict TDD: disabled)

### Completed Tasks

**Phase 1: Owner Name on Pet Cards**
- [x] 1.1 Added optional `ownerName?: string` prop to `PetOverViewProps` in `PetOverview.tsx`, renders below pet name with truncated address fallback (`${pet.owner.slice(0, 6)}...${pet.owner.slice(-4)}`)
- [x] 1.2 Built `Map<address, name>` from `useRegisteredOwners().data` in `PetsOverviewView.tsx`, passed `ownerName={map.get(pet.owner.toLowerCase())}` to each `<PetOverView>`

**Phase 2: Hide Pay Button for Vets**
- [x] 2.1 Added `useIsVet()` call in `AppointmentsPage.tsx`, passes `isVet` + `isVetLoading` to `<AppointmentsView>`
- [x] 2.2 Added `isVet` / `isVetLoading` to `AppointmentsViewProps`, threaded through to `<AppointmentCard>`, guarded Pay button render with `!isVet`

**Phase 3: Pet Names in Owner Dropdown**
- [x] 3.1 Added `useReadContracts` batch call for `getMedicalRecord(id)` on all `petIds` in `OwnerDashboardView.tsx`, built `Map<string, string>` from results
- [x] 3.2 Rendered pet name from map in dropdown options (`{petNameMap.get(id) ?? `Pet #${id}`}`), also used in section heading

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `web-app/src/pets/components/PetOverview.tsx` | Modified | Added `ownerName` prop, renders with truncated address fallback |
| `web-app/src/pets/views/PetsOverviewView.tsx` | Modified | Built owner Map from `registeredOwners`, passed to `PetOverView` |
| `web-app/src/appointments/pages/AppointmentsPage.tsx` | Modified | Added `useIsVet()`, passed `isVet`/`isVetLoading` to view |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Modified | Added `isVet`/`isVetLoading` props, guarded Pay button |
| `web-app/src/appointments/views/__tests__/AppointmentsView.test.tsx` | Modified | Added `isVet={false} isVetLoading={false}` to all test renders |
| `web-app/src/owners/views/OwnerDashboardView.tsx` | Modified | Added `useReadContracts` batch call, pet name map, dropdown fallback |

### Deviations from Design
None — implementation matches design.

### Issues Found
None.

### Remaining Tasks (for verify phase)
- [ ] Verify pet cards show owner name (or truncated address fallback) for registered and unregistered owners
- [ ] Verify Pay button is absent when connected wallet is a vet (mock `useIsVet`)
- [ ] Verify owner dropdown shows pet names with `Pet #{id}` fallback while loading

### Workload / PR Boundary
- Mode: single PR (risk low, ~40-55 lines originally, ~90 with test changes)
- 400-line budget risk: Low (compiles clean, only pre-existing errors)
