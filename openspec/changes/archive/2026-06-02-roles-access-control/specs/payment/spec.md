# Delta for Payment

## MODIFIED Requirements

### Requirement: Token Payment

The system MUST allow paying an unpaid appointment with USDC tokens. The caller MUST be the `MedicalRecord.owner` of the pet linked to the appointment. The contract MUST compute token amount from `appointmentValue` (cents) using `_centsToTokenUnits`. The amount MUST be the full `appointmentValue` — no partial payments.
(Previously: no owner check — any address could pay)

#### Scenario: Pay unpaid appointment with USDC

- GIVEN an appointment exists with `appointmentValue = 5000` cents
- AND the caller has ≥ 50 USDC approved for the contract
- AND the caller IS the `MedicalRecord.owner`
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

#### Scenario: Non-owner cannot pay with tokens

- GIVEN an appointment exists
- AND the caller is NOT the `MedicalRecord.owner`
- WHEN `payAppointmentToken` is called
- THEN the call reverts with custom message

### Requirement: ETH Payment

The system MUST allow paying an unpaid appointment with ETH via `payAppointmentEth(id, priceFeed)`. The caller MUST be the `MedicalRecord.owner` of the pet linked to the appointment. Expected ETH is `(cents * 1e24) / uint256(price)` from the price feed's `latestRoundData()`. Excess ETH (`msg.value > expectedEth`) MUST be refunded using CEI pattern (state before call). `paidValue` stores cents, not `msg.value`.
(Previously: no owner check on ETH payment)

#### Scenario: Exact ETH payment

- GIVEN an appointment exists with `appointmentValue = 5000`
- AND `msg.value == expectedEth` (exact amount)
- AND the caller IS the `MedicalRecord.owner`
- WHEN `payAppointmentEth(appointmentId, priceFeed)` is called
- THEN `paidValue` is set to `appointmentValue`
- AND `AppointmentPaidEth` event is emitted

#### Scenario: Refund excess ETH

- GIVEN `msg.value > expectedEth`
- AND the caller IS the `MedicalRecord.owner`
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

#### Scenario: Non-owner cannot pay with ETH

- GIVEN an appointment exists
- AND the caller is NOT the `MedicalRecord.owner`
- WHEN `payAppointmentEth` is called with sufficient ETH
- THEN the call reverts with custom message
