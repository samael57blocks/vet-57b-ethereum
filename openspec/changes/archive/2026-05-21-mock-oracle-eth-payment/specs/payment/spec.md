# Delta for Payment

## MODIFIED Requirements

### Requirement: ETH Rejection

The contract MUST reject direct ETH transfers via `receive()`. The `payAppointmentEth()` function is the sole payable entry point. Any ETH sent directly to the contract address without calling `payAppointmentEth` MUST revert.
(Previously: No payable entry — all ETH transfers rejected, no `receive()` or `fallback()`)

#### Scenario: Direct ETH transfer reverts

- GIVEN a sender sends ETH to the contract address without calling `payAppointmentEth`
- WHEN the transfer is attempted via `receive()`
- THEN the transaction reverts

## ADDED Requirements

### Requirement: ETH Payment

The system MUST allow paying an unpaid appointment with ETH via `payAppointmentEth(id, priceFeed)`. Expected ETH is `(cents * 1e24) / uint256(price)` from the price feed's `latestRoundData()`. Excess ETH (`msg.value > expectedEth`) MUST be refunded using CEI pattern (state before call). `paidValue` stores cents, not `msg.value`.

#### Scenario: Exact ETH payment

- GIVEN an appointment exists with `appointmentValue = 5000`
- AND `msg.value == expectedEth` (exact amount)
- WHEN `payAppointmentEth(appointmentId, priceFeed)` is called
- THEN `paidValue` is set to `appointmentValue`
- AND `AppointmentPaidEth` event is emitted

#### Scenario: Refund excess ETH

- GIVEN `msg.value > expectedEth`
- WHEN `payAppointmentEth` is called
- THEN the excess ETH is returned to `msg.sender`
- AND `paidValue` is set to `appointmentValue` (not `msg.value`)

#### Scenario: Revert on non-existent appointment

- GIVEN no appointment with the given ID exists
- WHEN `payAppointmentEth` is called
- THEN the call reverts

#### Scenario: Revert on already paid

- GIVEN an appointment with `paidValue > 0`
- WHEN `payAppointmentEth` is called for that appointment
- THEN the call reverts

#### Scenario: Revert on insufficient ETH

- GIVEN `msg.value < expectedEth`
- WHEN `payAppointmentEth` is called
- THEN the call reverts

#### Scenario: Revert on zero price

- GIVEN the price feed returns `price = 0`
- WHEN `payAppointmentEth` is called
- THEN the call reverts

### Requirement: ETH Withdrawal

The owner MUST be able to withdraw all ETH held by the contract. Non-owners MUST NOT withdraw.

#### Scenario: Owner withdraws all ETH

- GIVEN the contract holds 0.1 ETH from paid appointments
- WHEN the owner calls `withdrawEth()`
- THEN the owner receives the full ETH balance
- AND the contract's ETH balance is 0

#### Scenario: Non-owner cannot withdraw

- GIVEN a non-owner account
- WHEN the account calls `withdrawEth()`
- THEN the call reverts
