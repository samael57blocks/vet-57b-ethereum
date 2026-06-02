# Delta for Pet Registration

## MODIFIED Requirements

### Requirement: Pet Registration Form

The form MUST include fields: name (≥2 chars), age (>0 number), animalType (Dog/Cat dropdown), owner (valid Ethereum address), caretakerName (≥2 chars), caretakerPhone (non-empty). All fields are required. The system MUST validate all fields before submission. The caller MUST have VET_ROLE — only veterinarians can register pets.
(Previously: no owner address field, no VET_ROLE guard)

#### Scenario: Successful registration via contract

- GIVEN a wallet is connected AND has VET_ROLE
- AND all form fields contain valid data including a valid owner address
- WHEN the user submits the form
- THEN a MetaMask transaction prompt appears
- AND the UI shows a "Confirm in MetaMask..." message
- WHEN the transaction is confirmed
- THEN the form dialog closes
- AND the pet list updates automatically

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
