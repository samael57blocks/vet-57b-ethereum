# Appointments Page Specification

## Purpose

Enable viewing and scheduling medical appointments for registered pets. Users select a pet, see its appointments, and schedule new ones via contract write with wallet guard, transaction feedback, and automatic list refresh.

## Requirements

### Requirement: Appointment List View

The page MUST show a pet selector and, when a pet is selected, display its appointments (date, time, value, paid status). If no wallet is connected, a guard message is shown instead.

#### Scenario: Select pet and view appointments

- GIVEN a wallet is connected
- AND there are pets registered
- WHEN the user selects a pet from the dropdown
- THEN the page fetches and displays that pet's appointments
- AND each appointment shows date, time, appointmentValue, and paidValue

#### Scenario: No appointments for selected pet

- GIVEN a wallet is connected
- AND the selected pet has no appointments
- WHEN the appointments list renders
- THEN an empty state message "No appointments scheduled" is displayed

#### Scenario: Wallet guard when disconnected

- GIVEN no wallet is connected
- WHEN the user navigates to the appointments page
- THEN a "Connect your wallet to view appointments" message is shown
- AND the pet selector and schedule form are not displayed

### Requirement: Schedule Appointment

The user MUST be able to schedule a new appointment for a selected pet via a form with fields: pet (selector), date (date picker, must be future), time (text input), and appointment value (number, must be >0). All fields are required and validated before submission.

#### Scenario: Successful appointment scheduling

- GIVEN a wallet is connected
- AND a pet is selected
- AND all form fields contain valid data (future date, valid time, value > 0)
- WHEN the user submits the form
- THEN a MetaMask transaction prompt appears
- AND the UI shows "Confirm in MetaMask..."
- WHEN the transaction is confirmed
- THEN the form clears
- AND the appointments list updates automatically

#### Scenario: Validation blocks invalid data

- GIVEN the form has invalid data (past date, empty time, value ≤ 0, or no pet selected)
- WHEN the user clicks Schedule
- THEN validation errors appear for each invalid field
- AND no transaction is sent

#### Scenario: User rejects in MetaMask

- GIVEN the user submitted a valid form
- WHEN MetaMask rejects the transaction
- THEN an error message "Transaction rejected" is displayed
- AND the form remains open for retry

### Requirement: Transaction Lifecycle Feedback

The system MUST display distinct UI states during the transaction lifecycle: idle, pending (wallet approval), processing (mining), success, and error.

#### Scenario: States displayed in sequence

- GIVEN the user submitted a valid form
- WHEN the write to `scheduleAppointment` begins
- THEN the dialog shows "Confirm in MetaMask..."
- WHEN the transaction is submitted
- THEN the dialog shows "Transaction processing..."
- WHEN the transaction is confirmed
- THEN a success indicator appears and the form resets

#### Scenario: Error on rejection or failure

- GIVEN the user submitted a valid form
- WHEN the transaction reverts on-chain
- THEN an error message is displayed
- AND the form remains open for retry

### Requirement: Auto-Refresh after Schedule

The system MUST refresh the appointments list after a successful schedule without user action.

#### Scenario: List refreshes on success

- GIVEN a successful schedule transaction
- WHEN the transaction is confirmed
- THEN the appointments query cache is invalidated
- AND the UI re-renders with the new appointment in the list

### Requirement: Pay with USDC Action

The appointment card MUST show a "Pay with USDC" button when the appointment is unpaid (`paidValue === 0`) AND the viewer is NOT a vet. The button MUST NOT appear when `paidValue > 0` OR the viewer IS a vet. The payment flow MUST integrate with `usePayAppointmentToken` and follow the TxState lifecycle.
(Previously: Show button when `paidValue === 0`, hide when `paidValue > 0`, no vet awareness)

#### Scenario: Show Pay button for non-vet viewer with unpaid appointment

- GIVEN an appointment with `paidValue === 0`
- AND the connected wallet is NOT a registered vet
- WHEN the appointment card renders
- THEN a "Pay with USDC" button is visible

#### Scenario: Hide Pay button when viewer is a vet

- GIVEN an appointment with `paidValue === 0`
- AND the connected wallet IS a registered vet
- WHEN the appointment card renders
- THEN no pay button is visible

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
