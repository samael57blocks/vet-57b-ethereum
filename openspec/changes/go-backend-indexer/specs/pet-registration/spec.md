# Delta for Pet Registration

## MODIFIED Requirements

### Requirement: Pet List Auto-Refresh

The system MUST refresh the pet list after a successful registration. When `VITE_USE_MOCK_DATA=false`, the refresh fetches from the REST API (`VITE_BACKEND_URL/api/v1/pets`) via `AxiosPetService` instead of the contract.

(Previously: list refresh fetched from contract via wagmi; now it fetches from the Go backend REST API when mock data is off.)

#### Scenario: List refreshes via REST on success

- GIVEN `VITE_USE_MOCK_DATA=false`
- AND a successful registration transaction is confirmed on-chain
- WHEN the indexer picks up the event and stores it
- THEN the pet list query cache is invalidated
- AND `AxiosPetService.getAll()` fetches from `VITE_BACKEND_URL/api/v1/pets`
- AND the UI re-renders with the new pet in the list

#### Scenario: List refreshes via contract when mock is on

- GIVEN `VITE_USE_MOCK_DATA=true`
- AND a successful registration transaction is confirmed
- WHEN the mutation succeeds
- THEN the pet list query cache is invalidated
- AND the hook uses contract reads as before (unchanged)
