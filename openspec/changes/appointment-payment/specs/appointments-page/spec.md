# Delta for appointments-page

## ADDED Requirements

### Requirement: Pay with USDC Action

The appointment card MUST show a "Pay with USDC" button when the appointment is unpaid (`paidValue === 0`). The button MUST NOT appear when `paidValue > 0`. The payment flow MUST integrate with `usePayAppointmentToken` and follow the TxState lifecycle.

#### Scenario: Show Pay button for unpaid appointment

- GIVEN an appointment with `paidValue === 0`
- WHEN the appointment card renders
- THEN a "Pay with USDC" button is visible

#### Scenario: Hide Pay button for paid appointment

- GIVEN an appointment with `paidValue > 0`
- WHEN the appointment card renders
- THEN no pay button is visible

#### Scenario: Full approval + payment flow

- GIVEN the user clicks "Pay with USDC" on an unpaid appointment
- WHEN the caller has insufficient or zero USDC allowance
- THEN an approval step is shown in a payment modal
- WHEN the user approves the USDC spend
- THEN the payment transaction is sent
- AND the TxState lifecycle is displayed (pending → processing → success/error)

#### Scenario: Direct payment when already approved

- GIVEN the caller has sufficient USDC allowance
- WHEN the user clicks "Pay with USDC"
- THEN the approval step is skipped
- AND the payment transaction is sent directly

#### Scenario: Rejected payment shows inline error

- GIVEN the user started the payment flow
- WHEN the transaction is rejected in MetaMask
- THEN an error message is displayed in the modal
- AND the card remains interactive for retry

#### Scenario: Successful payment updates UI

- GIVEN the payment transaction is confirmed
- WHEN the success state is reached
- THEN the appointment query cache is invalidated
- AND the card re-renders with `paidValue > 0` (pay button hidden)
