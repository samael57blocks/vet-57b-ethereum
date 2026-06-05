# Proposal: Vet Owner UI Refinements

## Intent

Three UI gaps in the veterinary dApp reduce usability: (1) pet cards don't show owner names, (2) vets see a Pay button that always fails (contract enforces `msg.sender == pet owner`), (3) owner dashboard dropdown shows anonymous `Pet #{id}` instead of actual pet names. Fix all three with minimal frontend-only changes.

## Scope

### In Scope
- Pet overview cards display owner name from registered owners list
- Pay button hidden from vet's appointment view
- Owner dashboard dropdown shows pet names via batch contract reads

### Out of Scope
- Backend/indexer changes — all fixes are frontend-only
- Extracting `AppointmentCard` to separate component
- Adding new contract methods or modifying existing ones

## Capabilities

### New Capabilities
None — all changes modify existing behavior.

### Modified Capabilities
- `appointments-page`: Pay button visibility rule changes from "show button when unpaid" to "show when unpaid AND viewer is NOT a vet". The existing requirement (`MUST show Pay button when `paidValue === 0``) needs a vet-awareness guard.

## Approach

**Change 1 — Owner name on PetOverView**: Build `Map<address, name>` from `useRegisteredOwners()` in `PetsOverviewView`. Pass optional `ownerName` prop to `PetOverView`. Fallback to truncated address for unregistered owners.

**Change 2 — Hide vet Pay button**: Add `useIsVet()` in `AppointmentsPage`. Pass `isVet` prop to `AppointmentsView`. Guard render: `!isPaid && onPayAppointment && !isVet`.

**Change 3 — Pet names in dropdown**: After `usePetsByOwner()` returns `bigint[]`, use wagmi `useContractReads` to batch-call `getMedicalRecord` for all IDs. Build `Map<id, name>` and render with `Pet #${id}` fallback.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web-app/src/pets/views/PetsOverviewView.tsx` | Modified | Build owner address→name map, pass to cards |
| `web-app/src/pets/components/PetOverview.tsx` | Modified | Add optional `ownerName` prop + render |
| `web-app/src/appointments/pages/AppointmentsPage.tsx` | Modified | Add `useIsVet()`, pass to view |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Modified | Guard Pay button with `!isVet` |
| `web-app/src/owners/views/OwnerDashboardView.tsx` | Modified | Batch-read pet names, render in dropdown |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unregistered owner has no name in map | High | Fallback to truncated address |
| `useContractReads` API differs by wagmi version | Low | Verify against project pin (wagmi 3.6) |
| Flash of Pay button during role resolution | Low | Default `isVet` to `true` until resolved |

## Rollback Plan

Three independent changes — revert each file to previous commit. No migration, no data loss.

## Dependencies

None — frontend-only, no new packages.

## Success Criteria

- [ ] Pet cards in vet view show owner name (or truncated address fallback)
- [ ] Vet-connected wallet sees NO Pay button on any appointment card
- [ ] Owner dashboard dropdown shows pet names, not `Pet #{id}`
- [ ] All existing tests pass
