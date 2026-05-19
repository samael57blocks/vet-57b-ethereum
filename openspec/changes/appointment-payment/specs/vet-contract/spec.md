# Delta for vet-contract

## ADDED Requirements

### Requirement: Payment Functions

The VetRegistry contract MUST add `owner` state, `onlyOwner` modifier, `IERC20` minimal interface, `payAppointmentToken`, `withdrawToken`, `_centsToTokenUnits` helper, and `AppointmentPaidToken` event. The contract MUST reject direct ETH transfers.

#### Scenario: Pay unpaid appointment with USDC

- GIVEN an appointment exists with `appointmentValue = 5000` cents
- AND the caller has ≥ 50 USDC approved for the contract
- WHEN `payAppointmentToken(id, usdcAddr)` is called
- THEN `paidValue` is set to `appointmentValue`
- AND `AppointmentPaidToken` is emitted

#### Scenario: Revert on non-existent appointment

- GIVEN an invalid appointment ID
- WHEN `payAppointmentToken` is called
- THEN the call reverts

#### Scenario: Revert on already paid appointment

- GIVEN `paidValue > 0`
- WHEN `payAppointmentToken` is called
- THEN the call reverts

#### Scenario: Revert on insufficient allowance

- GIVEN the caller has zero or insufficient USDC allowance for the contract
- WHEN `payAppointmentToken` is called
- THEN the call reverts (ERC20 `transferFrom` failure)

#### Scenario: Revert on insufficient balance

- GIVEN the caller has approved enough USDC
- BUT the caller's USDC balance is insufficient
- WHEN `payAppointmentToken` is called
- THEN the call reverts (ERC20 `transferFrom` failure)

#### Scenario: Owner withdraws all tokens

- GIVEN the contract holds 100 USDC
- WHEN the owner calls `withdrawToken(usdcAddr)`
- THEN the owner receives the full USDC balance
- AND the contract USDC balance is 0

#### Scenario: Non-owner cannot withdraw

- GIVEN a non-owner account
- WHEN the account calls `withdrawToken(usdcAddr)`
- THEN the call reverts

#### Scenario: ETH transfer rejected

- GIVEN a sender sends ETH to the contract
- WHEN the transfer is attempted
- THEN the transaction reverts
