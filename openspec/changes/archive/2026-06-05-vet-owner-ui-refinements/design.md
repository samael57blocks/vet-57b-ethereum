# Design: Vet Owner UI Refinements

## Technical Approach

Three independent frontend-only changes. No new hooks, no ABI changes, no contract modifications. Each change is a pure UI/data wiring improvement within existing components.

## Architecture Decisions

### Decision: Owner name via Map lookup (not per-pet contract read)

| Option | Tradeoff |
|--------|----------|
| `Map<address, name>` from `useRegisteredOwners()` | O(1) lookup, data already fetched in view, zero extra RPC calls |
| Individual `getRegisteredOwner` per pet | N additional contract reads per render |

**Choice**: Map lookup. `PetsOverviewView` already calls `useRegisteredOwners()` for the registration dialog — reusing that data costs nothing.

### Decision: `useIsVet` in page, not view

**Choice**: Call `useIsVet()` in `AppointmentsPage`, pass `isVet` prop down.
**Rationale**: Views should stay presentational. The page is the data-fetching boundary per existing pattern (`usePetsOverview`, `useAppointments`). Props remain serializable, testable.

### Decision: `useReadContracts` for batch pet name resolution

**Choice**: Use wagmi's `useReadContracts` to batch-read `getMedicalRecord` for all owned pet IDs.
**Rationale**: Sequential `useReadContract` per pet would create N individual queries and N network round-trips. `useReadContracts` bundles all calls into a single multicall-like request and is natively cached by wagmi. Falls back to `Pet #{id}` while loading or on error.

## Data Flow

### Change 1 — Owner name on pet cards

```
PetsOverviewPage
  └─ usePetsOverview() → Pet[]
  └─ PetsOverviewView
       ├─ useRegisteredOwners() → Owner[]
       ├─ build Map<address, name>
       └─ PetOverView { pet, ownerName: map.get(pet.owner) }
            └─ renders ownerName or truncated address fallback
```

### Change 2 — Hide Pay button for vets

```
AppointmentsPage
  ├─ useIsVet() → { isVet, isLoading }
  └─ AppointmentsView { isVet }
       └─ AppointmentCard
            └─ guard: !isPaid && onPayAppointment && !isVet
```

### Change 3 — Pet names in owner dropdown

```
OwnerDashboardView
  ├─ usePetsByOwner(address) → bigint[]
  ├─ useReadContracts (batch getMedicalRecord) → { name, ... }[]
  ├─ build Map<id, name>
  └─ <option> renders name or "Pet #{id}" fallback
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `web-app/src/pets/components/PetOverview.tsx` | Modify | Add optional `ownerName` prop, render below pet name |
| `web-app/src/pets/views/PetsOverviewView.tsx` | Modify | Build `Map<address, name>` from `registeredOwners`, pass to `PetOverView` |
| `web-app/src/appointments/pages/AppointmentsPage.tsx` | Modify | Add `useIsVet()`, pass `isVet` + `isVetLoading` to view |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Modify | Add `isVet` to props + `AppointmentCard` guard on Pay button |
| `web-app/src/owners/views/OwnerDashboardView.tsx` | Modify | Add `useReadContracts` to batch-read pet names, render in dropdown |

## Interfaces / Contracts

```typescript
// PetOverview.tsx — new optional prop
interface PetOverviewProps {
    pet: Pet;
    ownerName?: string;  // registered name or truncated address
}

// AppointmentsView.tsx — new prop
interface AppointmentsViewProps {
    // ...existing props
    isVet: boolean;
    isVetLoading: boolean;
}

// OwnerDashboardView.tsx — no new interface, internal Map<id, name>
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Owner name fallback when address not in map | Render `PetOverView` without `ownerName`, assert truncated address |
| Unit | Pay button hidden when `isVet=true` | Render `AppointmentCard` with `isVet`, assert no Pay button |
| Unit | Pet name renders in dropdown when data loaded | Mock `useReadContracts` return, assert option text is pet name |
| Integration | Owner name flows from `useRegisteredOwners` through view | Mock hook return, assert `PetOverView` receives correct `ownerName` |
| Integration | `useIsVet` true → no Pay button in appointments view | Mock `useIsVet`, render `AppointmentsView`, assert Pay absent |

## Migration / Rollout

No migration required. Three independent changes — each file can be reverted independently.

## Open Questions

- None
