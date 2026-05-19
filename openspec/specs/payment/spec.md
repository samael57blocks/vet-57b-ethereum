# Payment Specification

## Purpose

USDC stablecoin payment for veterinary appointments and owner token withdrawal from the VetRegistry contract.

## Requirements

### Requirement: Owner Initialization

The contract MUST set `msg.sender` as the owner in the constructor.

#### Scenario: Owner set on deploy

- GIVEN a contract deployment
- WHEN the constructor executes
- THEN `msg.sender` is stored as `owner`

### Requirement: Token Payment

The system MUST allow paying an unpaid appointment with USDC tokens. The contract MUST compute token amount from `appointmentValue` (cents) using `_centsToTokenUnits`. The amount MUST be the full `appointmentValue` — no partial payments.

#### Scenario: Pay unpaid appointment with USDC

- GIVEN an appointment exists with `appointmentValue = 5000` cents
- AND the caller has ≥ 50 USDC approved for the contract
- WHEN `payAppointmentToken(appointmentId, usdcAddress)` is called
- THEN `paidValue` is set to `appointmentValue`
- AND an `AppointmentPaidToken` event is emitted with appointmentId, payer, token, and amount

#### Scenario: Revert when appointment does not exist

- GIVEN no appointment with the given ID exists
- WHEN `payAppointmentToken` is called
- THEN the call reverts

#### Scenario: Revert on already paid appointment

- GIVEN an appointment with `paidValue > 0`
- WHEN `payAppointmentToken` is called for that appointment
- THEN the call reverts

#### Scenario: Revert on insufficient allowance

- GIVEN the caller has not approved enough USDC for the contract
- WHEN `payAppointmentToken` is called
- THEN the call reverts (ERC20 `transferFrom` fails)

#### Scenario: Revert on insufficient balance

- GIVEN the caller has approved enough USDC
- BUT the caller's USDC balance is insufficient
- WHEN `payAppointmentToken` is called
- THEN the call reverts (ERC20 `transferFrom` fails)

### Requirement: Token Withdrawal

The owner MUST be able to withdraw all USDC tokens held by the contract. Non-owners MUST NOT be able to withdraw.

#### Scenario: Owner withdraws all tokens

- GIVEN the contract holds 100 USDC
- WHEN the owner calls `withdrawToken(usdcAddress)`
- THEN the owner receives the full USDC balance
- AND the contract's USDC balance is 0

#### Scenario: Non-owner cannot withdraw

- GIVEN a non-owner account
- WHEN the account calls `withdrawToken(usdcAddress)`
- THEN the call reverts

### Requirement: ETH Rejection

The contract MUST reject direct ETH transfers. There MUST be no `receive()` or `fallback()` function that accepts value.

#### Scenario: Direct ETH transfer reverts

- GIVEN a sender sends ETH to the contract address
- WHEN the transfer is attempted
- THEN the transaction reverts
