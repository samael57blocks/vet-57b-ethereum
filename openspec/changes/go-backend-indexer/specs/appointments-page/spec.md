# Delta for Appointments Page

## MODIFIED Requirements

### Requirement: Appointment List View

The page MUST show a pet selector and, when a pet is selected, display its appointments. When `VITE_USE_MOCK_DATA=false`, appointments are fetched from the REST API (`GET /api/v1/pets/{id}/appointments`) instead of from the contract.

(Previously: appointments read from the contract via `getPetAppointments(id)` + `getAppointment(id)` for each ID. Now: single REST call returns all appointment data for the pet.)

#### Scenario: Select pet and view appointments from REST

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND a wallet is connected
- AND the backend has appointments indexed for pet 1
- WHEN the user selects pet 1 from the dropdown
- THEN `useAppointments(1)` calls `GET /api/v1/pets/1/appointments`
- AND the page displays date, time, appointmentValue, and paidStatus for each appointment

#### Scenario: REST unavailable shows error state

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND the backend is unreachable
- WHEN the user selects a pet
- THEN an error message "Unable to load appointments" is displayed
- AND the card shows a retry button

### Requirement: Auto-Refresh after Schedule

The system MUST refresh the appointments list after a successful schedule. When `VITE_USE_MOCK_DATA=false`, the refresh re-fetches from REST after the indexer confirms the event.

(Previously: invalidation of contract query cache. Now: invalidation of `['backend', 'appointments']` query cache.)

#### Scenario: List refreshes after schedule via REST

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND a successful schedule transaction is confirmed on-chain
- WHEN the indexer picks up `MedicalAppointmentCreated` and stores it
- THEN the appointments query cache is invalidated
- AND `useAppointments(petId)` re-fetches from REST
- AND the UI shows the new appointment in the list

### Requirement: Pay with USDC Action

Unchanged — payment flow stays wallet-gated via contract write. The appointment card shows "Pay with USDC" when `paidValue === 0` and hides when `paidValue > 0`.

(Previously: reads `paidValue` from contract. Now: reads `paidValue` from REST response.)

#### Scenario: Pay button state from REST data

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND the REST response shows `paidValue: 0`
- WHEN the appointment card renders
- THEN a "Pay with USDC" button is visible (unchanged behavior, same component)

#### Scenario: Paid status from REST

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND the REST response shows `paidValue > 0`
- WHEN the appointment card renders
- THEN no pay button is visible (unchanged behavior, same component)
