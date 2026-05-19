# Delta for pet-registration

New capability — no existing behavior to modify. All requirements are ADDED.

## ADDED Requirements

### Requirement: Pet Registration Form

The form MUST include fields: name (≥2 chars), age (>0 number), animalType (Dog/Cat dropdown), caretakerName (≥2 chars), caretakerPhone (non-empty). All fields are required. The system MUST validate all fields before submission.

#### Scenario: Successful registration via contract

- GIVEN a wallet is connected
- AND all form fields contain valid data
- WHEN the user submits the form
- THEN a MetaMask transaction prompt appears
- AND the UI shows a "Confirm in MetaMask..." message
- WHEN the transaction is confirmed
- THEN the form dialog closes
- AND the pet list updates automatically

#### Scenario: Validation blocks invalid data

- GIVEN the form has invalid data (empty name, age ≤0, or missing animalType/caretaker fields)
- WHEN the user clicks Register
- THEN validation errors appear for each invalid field
- AND no transaction is sent

### Requirement: Wallet Connection Guard

The system MUST check wallet connection before showing the registration form.

#### Scenario: Guard shown when disconnected

- GIVEN no wallet is connected
- WHEN the user navigates to the pet registration view
- THEN a "Connect your wallet to register a pet" message is shown instead of the form

### Requirement: Transaction Lifecycle Feedback

The system MUST display distinct UI states during the transaction lifecycle: idle, pending (wallet approval), processing (mining), success, and error.

#### Scenario: States displayed in sequence

- GIVEN the user submitted a valid form
- WHEN the write to `registerPet` begins
- THEN the dialog shows "Confirm in MetaMask..."
- WHEN the transaction is submitted
- THEN the dialog shows "Transaction processing..."
- WHEN the transaction is confirmed
- THEN a success indicator appears and the dialog closes

#### Scenario: Error on rejection or failure

- GIVEN the user submitted a valid form
- WHEN MetaMask rejects the transaction OR the transaction reverts
- THEN an error message is displayed in the dialog
- AND the form remains open for retry

### Requirement: Pet List Auto-Refresh

The system MUST refresh the pet list after a successful registration without user action.

#### Scenario: List refreshes on success

- GIVEN a successful registration transaction
- WHEN the transaction is confirmed
- THEN the pet list query cache is invalidated
- AND the UI re-renders with updated pet data
