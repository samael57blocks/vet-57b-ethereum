# Delta for contract-writes

## ADDED Requirements

### Requirement: Pay Appointment Hook

The system MUST expose `usePayAppointmentToken` that checks USDC allowance, optionally triggers approval via `useApproveToken`, then sends `payAppointmentToken`. The hook MUST expose `needsApproval: boolean` to guide the UI.

#### Scenario: Pay with sufficient allowance

- GIVEN the caller has approved ≥ the required USDC amount
- WHEN `usePayAppointmentToken` is invoked
- THEN `needsApproval` is `false`
- AND `payAppointmentToken` is sent directly
- AND the mutation follows the TxState lifecycle (idle → pending → processing → success/error)

#### Scenario: Approval required before payment

- GIVEN the caller has NOT approved sufficient USDC
- WHEN `usePayAppointmentToken` is invoked
- THEN `needsApproval` is `true`
- AND an `approve` function is exposed
- WHEN the caller calls `approve`
- THEN `needsApproval` becomes `false`
- AND `payAppointmentToken` can proceed

#### Scenario: Allowance check on network switch

- GIVEN the caller previously approved USDC on chain A
- WHEN the caller switches to chain B
- THEN `needsApproval` re-evaluates to `true`
- AND the approval step is shown again

### Requirement: Token Approval Hook

The system MUST expose `useApproveToken` that sends an ERC20 `approve` transaction following the TxState lifecycle.

#### Scenario: Approve USDC successfully

- GIVEN a wallet is connected
- WHEN `useApproveToken` is called with token address, spender, and amount
- THEN a wallet prompt appears
- WHEN the transaction is confirmed
- THEN the allowance is updated
- AND the mutation enters the `success` state
