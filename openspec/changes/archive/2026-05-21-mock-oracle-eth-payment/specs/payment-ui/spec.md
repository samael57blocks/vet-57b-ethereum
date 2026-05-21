# Payment UI Specification

## Purpose

Frontend payment method selector allowing users to choose between USDC and ETH when paying an appointment.

## Requirements

### Requirement: Payment Method Selector

The payment modal MUST display a selector (dropdown or toggle) letting users choose between "USDC" and "ETH" before initiating payment. The selector MUST be visible when the modal opens. The default selection MUST be USDC.

#### Scenario: Select USDC as payment method

- GIVEN the PayAppointmentModal is open
- WHEN the user selects "USDC" from the payment method selector
- THEN the modal shows the USDC approve-then-pay flow
- AND the displayed amount is in USD (e.g., "$50.00 USDC")

#### Scenario: Select ETH as payment method

- GIVEN the PayAppointmentModal is open
- WHEN the user selects "ETH" from the payment method selector
- THEN the modal shows the estimated ETH amount (e.g., "≈ 0.025 ETH")
- AND the "Pay with ETH" button is available (no approve step needed)

### Requirement: ETH Payment Flow

The system MUST allow paying with ETH via `payAppointmentEth` when ETH is selected. No approve step is needed — ETH is sent as `msg.value`. The hook MUST compute the required ETH amount and send it with the transaction.

#### Scenario: Pay with exact ETH

- GIVEN the user selected ETH as payment method
- AND the estimated amount is 0.025 ETH
- WHEN the user clicks "Pay with ETH"
- THEN the wallet requests the exact ETH amount
- AND on success the modal shows "Payment successful!"

#### Scenario: ETH payment error handling

- GIVEN the user selected ETH
- WHEN the transaction fails (user rejected, insufficient balance, revert)
- THEN the modal shows the error with a "Try Again" button

### Requirement: Price Feed Address

The system MUST read `VITE_PRICE_FEED_ADDRESS` from environment and pass it to `payAppointmentEth`. If the env var is not set, the ETH payment option MUST be hidden.

#### Scenario: Price feed address unavailable

- GIVEN `VITE_PRICE_FEED_ADDRESS` is not set
- WHEN the payment modal opens
- THEN only the USDC option is shown
- AND no ETH option is displayed
