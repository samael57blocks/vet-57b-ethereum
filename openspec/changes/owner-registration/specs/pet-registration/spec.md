# Delta for Pet Registration

## MODIFIED Requirements

### Requirement: Pet Registration Form

The form MUST include fields: name (≥2 chars), age (>0 number), animalType (Dog/Cat dropdown), owner (selected from registered owners dropdown with free-text fallback for unregistered addresses), caretakerName (≥2 chars), caretakerPhone (non-empty). All fields are required. The system MUST validate all fields before submission. The caller MUST have VET_ROLE — only veterinarians can register pets.

The owner field MUST present a dropdown of registered owners (address + name from `getRegisteredOwners()`). The vet MAY also type a raw Ethereum address as free-text fallback for walk-in clients. The selected or typed address MUST be passed as the `owner` parameter to `registerPet`.
(Previously: owner was a plain text input for a valid Ethereum address; no dropdown existed.)

#### Scenario: Successful registration via contract (dropdown)

- GIVEN a wallet is connected AND has VET_ROLE
- AND registered owners exist in the dropdown
- AND the vet selects a registered owner and fills all other fields
- WHEN the user submits the form
- THEN the selected owner address is passed as the `owner` parameter to `registerPet`
- AND the transaction succeeds

#### Scenario: Successful registration via free-text fallback

- GIVEN a wallet is connected AND has VET_ROLE
- AND the desired owner is NOT in the registered owners dropdown
- WHEN the vet types a valid Ethereum address in the owner field
- THEN the address is passed as the `owner` parameter to `registerPet`
- AND the transaction succeeds

#### Scenario: Validation blocks invalid data

- GIVEN the form has invalid data (empty name, age ≤0, invalid owner address, or missing caretaker fields)
- WHEN the user clicks Register
- THEN validation errors appear for each invalid field
- AND no transaction is sent

#### Scenario: Non-vet wallet sees role guard

- GIVEN a wallet is connected but does NOT have VET_ROLE
- WHEN the user navigates to the pet registration view
- THEN a "Only veterinarians can register pets" message is shown
- AND the registration form is not displayed

#### Scenario: Dropdown reflects empty owner list

- GIVEN no owners have registered yet
- WHEN the vet opens the owner dropdown
- THEN the dropdown shows a "No registered owners" message
- AND the vet can still type a free-text Ethereum address
