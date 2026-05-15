# Delta for pet-registration

## MODIFIED Requirements

### Requirement: Add a new pet

The user MUST be able to register a new pet by submitting a form. The data MUST be written to the Ethereum contract via MetaMask transaction instead of being sent to a REST API.
(Previously: The user submits a form that sends data to a REST API. Was not actually implemented — form only validated.)

#### Scenario: Register pet via contract

- GIVEN a wallet is connected
- AND the registration form is filled with valid data (name ≥2 chars, age >0)
- WHEN the user submits the form
- THEN a MetaMask transaction prompt appears
- WHEN the transaction is confirmed
- THEN the new pet appears in the pet list
- AND the form dialog closes

#### Scenario: Register pet without wallet

- GIVEN no wallet is connected
- WHEN the user submits the form
- THEN a "Connect your wallet to register a pet" message is shown

#### Scenario: Validation prevents submission

- GIVEN the form has invalid data (empty name or age ≤0)
- WHEN the user clicks Register
- THEN validation errors are displayed
- AND no transaction is sent
