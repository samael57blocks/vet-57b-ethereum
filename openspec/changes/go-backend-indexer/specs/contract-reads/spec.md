# Delta for Contract Reads

## MODIFIED Requirements

### Requirement: Pet List Query

The system MUST expose a hook `usePets` that provides pet data. When `VITE_USE_MOCK_DATA=false`, it delegates to `AxiosPetService` (REST) instead of reading from the contract. When `VITE_USE_MOCK_DATA=true`, it falls back to contract reads via the existing `MockPetService`.

(Previously: `usePets` always fetched from contract. Now it delegates to `IPetService` which resolves to `AxiosPetService` (REST) or `MockPetService` depending on `VITE_USE_MOCK_DATA`.)

#### Scenario: Fetch all pets from REST

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND the backend has 3 pets indexed
- WHEN `usePets()` is called
- THEN it calls `AxiosPetService.getAll()` with default pagination
- AND returns `{ data: Pet[], total: 3, page: 1, limit: 20 }`
- AND data is cached with key `['backend', 'pets']`

#### Scenario: Fallback to contract when mock is on

- GIVEN `VITE_USE_MOCK_DATA=true`
- WHEN `usePets()` is called
- THEN it uses the existing contract read path (unchanged)
- AND data is cached with key `['vetRegistry', 'pets']`

### Requirement: Pet Detail Query

The system MUST expose a hook `usePet(id)`. When `VITE_USE_MOCK_DATA=false`, it fetches from `GET /api/v1/pets/{id}`.

(Previously: always from contract. Now: delegates to `IPetService`.)

#### Scenario: Fetch single pet from REST

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND pet with ID 1 exists in the backend
- WHEN `usePet('1')` is called
- THEN `AxiosPetService.getById('1')` calls `GET /api/v1/pets/1`
- AND the pet's data is returned
- AND the query key is `['backend', 'pet', { id: 1 }]`

### Requirement: Appointment Queries

New hooks `useAppointments(petId?)` and `useAppointment(id)` MUST be exposed. When `VITE_USE_MOCK_DATA=false`, they delegate to `AxiosAppointmentService` (REST).

(Previously: no appointment read hooks existed at the contract-reads level; appointments were pulled from the contract in `appointments-page`. Now unified hooks delegate to REST.)

#### Scenario: Fetch appointments for a pet from REST

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND pet 1 has 2 appointments in the backend
- WHEN `useAppointments(1)` is called
- THEN it calls `GET /api/v1/pets/1/appointments`
- AND returns the appointments array
- AND query key is `['backend', 'appointments', { petId: 1 }]`
