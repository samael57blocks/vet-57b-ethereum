# Vet Contract Specification

## Purpose

Contrato inteligente `VetRegistry` que almacena y gestiona registros médicos de mascotas y citas veterinarias en la blockchain Ethereum.

## Requirements

### Requirement: Medical Record Creation

The system MUST allow creating a pet medical record with name, age, animal type, caretaker name, and caretaker phone.

#### Scenario: Register a new pet

- GIVEN a caller with a valid Ethereum address
- WHEN they call `registerPet` with name, age, animalType, caretakerName, caretakerPhone
- THEN the pet is stored on-chain with a unique ID
- AND a `MedicalRecordCreated` event is emitted with all fields

### Requirement: Medical Record Query

The system MUST allow reading a pet's medical record by its ID.

#### Scenario: Query existing pet

- GIVEN a pet with ID `0x1` exists
- WHEN calling `getMedicalRecord(0x1)`
- THEN the record's name, age, animalType, caretakerName, and caretakerPhone are returned

### Requirement: Appointment Scheduling

The system MUST allow creating a medical appointment linked to an existing pet.

#### Scenario: Schedule appointment for existing pet

- GIVEN a pet with ID `0x1` exists
- WHEN calling `scheduleAppointment` with petId, date (unix), time string, appointmentValue
- THEN the appointment is stored with a unique ID and `paidValue = 0`
- AND a `MedicalAppointmentCreated` event is emitted

### Requirement: Record Count Tracking

The system MUST track the total count of pets and appointments to enable client-side enumeration.

#### Scenario: Query total pets

- WHEN calling `getPetCount()`
- THEN the total number of registered pets is returned

### Requirement: Appointment Query

The system MUST allow reading an appointment by its ID, returning the full MedicalAppointment struct.

#### Scenario: Query existing appointment

- GIVEN an appointment with ID `0x1` exists
- WHEN calling `getAppointment(0x1)`
- THEN the appointment's petId, date, time, appointmentValue, and paidValue are returned

#### Scenario: Query non-existent appointment reverts

- GIVEN no appointment with ID `0x99` exists
- WHEN calling `getAppointment(0x99)`
- THEN the call reverts

### Requirement: Pet Appointments Query

The system MUST allow listing all appointment IDs for a given pet.

#### Scenario: List appointments for a pet

- GIVEN a pet with ID `0x1` has 2 appointments
- WHEN calling `getPetAppointments(0x1)`
- THEN an array of 2 appointment IDs is returned

#### Scenario: No appointments returns empty

- GIVEN a pet with ID `0x1` has no appointments
- WHEN calling `getPetAppointments(0x1)`
- THEN an empty array is returned

### Requirement: Appointment Count Tracking

The system MUST expose the total count of all appointments.

#### Scenario: Query appointment count

- GIVEN 3 appointments exist
- WHEN calling `getAppointmentCount()`
- THEN the total count returned is 3

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
