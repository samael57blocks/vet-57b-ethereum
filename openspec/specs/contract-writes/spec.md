# Contract Writes Specification

## Purpose

Hooks TanStack Query Mutation para enviar transacciones al contrato VetRegistry con manejo de estados (idle → pending → processing → success/error).

## Requirements

### Requirement: Register Pet Mutation

The system MUST expose `useRegisterPet()` that sends a registerPet transaction to the contract.

#### Scenario: Register pet successfully

- GIVEN a wallet is connected and has ETH for gas
- WHEN `useRegisterPet()` is called with valid pet data
- THEN the mutation enters `pending` state (MetaMask approval)
- WHEN MetaMask confirms, the mutation enters `processing` (tx mined)
- WHEN the transaction is confirmed, the mutation enters `success`
- AND `['vetRegistry', 'pets']` queries are invalidated

#### Scenario: User rejects transaction

- GIVEN MetaMask is open
- WHEN the user rejects the transaction
- THEN the mutation enters `error` state
- AND a user-friendly "Transaction rejected" message is shown

#### Scenario: Insufficient funds

- GIVEN the wallet has no ETH for gas
- WHEN `useRegisterPet()` is called
- THEN the mutation enters `error` state
- AND an "Insufficient funds for gas" message is shown

### Requirement: Transaction State Feedback

The system MUST expose a standardized transaction state machine: idle → pending (wallet approval) → processing (mining) → success/error.

#### Scenario: State progression

- GIVEN a write is triggered
- WHEN the wallet prompt appears
- THEN the UI shows "Confirm in MetaMask..."
- WHEN the tx is submitted to the mempool
- THEN the UI shows "Transaction processing..."
- WHEN the tx is confirmed
- THEN the UI shows "Success!"

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
