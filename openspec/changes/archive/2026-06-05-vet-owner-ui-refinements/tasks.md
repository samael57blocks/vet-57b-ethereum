# Tasks: Vet Owner UI Refinements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 40–55 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All 3 UI refinements | PR 1 | Independent changes, one commit per phase, single PR |

## Phase 1: Owner Name on Pet Cards

- [x] 1.1 Add optional `ownerName?: string` prop to `PetOverViewProps` in `PetOverview.tsx`, render it below pet name (truncated address fallback via inline formatting)
- [x] 1.2 Build `Map<address, name>` from `useRegisteredOwners().data` in `PetsOverviewView.tsx`, pass `ownerName={map.get(pet.owner)}` to each `<PetOverView>`

## Phase 2: Hide Pay Button for Vets

- [x] 2.1 Add `useIsVet()` call in `AppointmentsPage.tsx`, pass `isVet` + `isVetLoading` to `<AppointmentsView>`
- [x] 2.2 Add `isVet` / `isVetLoading` to `AppointmentsViewProps`, thread through to `<AppointmentCard>`, guard Pay button render with `!isVet`

## Phase 3: Pet Names in Owner Dropdown

- [x] 3.1 Add `useReadContracts` batch call for `getMedicalRecord(id)` on all `petIds` in `OwnerDashboardView.tsx`, build `Map<string, string>` from results
- [x] 3.2 Render pet name from map in dropdown options, fallback to `Pet #{id}` when loading/missing

## Testing

- [ ] Verify pet cards show owner name (or truncated address fallback) for registered and unregistered owners
- [ ] Verify Pay button is absent when connected wallet is a vet (mock `useIsVet`)
- [ ] Verify owner dropdown shows pet names with `Pet #{id}` fallback while loading
