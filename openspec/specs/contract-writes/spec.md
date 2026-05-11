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
