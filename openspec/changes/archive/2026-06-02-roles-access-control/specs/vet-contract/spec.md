# Delta for Vet Contract

## MODIFIED Requirements

### Requirement: Medical Record Creation

The system MUST allow creating a pet medical record with name, age, animal type, owner address, caretaker name, and caretaker phone. The caller MUST have VET_ROLE. The emitted `MedicalRecordCreated` event MUST include `owner` as an indexed parameter.
(Previously: no owner field in MedicalRecord, no VET_ROLE guard, no owner in event)

#### Scenario: Register a new pet

- GIVEN a caller with VET_ROLE
- WHEN they call `registerPet` with name, age, animalType, owner, caretakerName, caretakerPhone
- THEN the pet is stored on-chain with a unique ID
- AND a `MedicalRecordCreated` event is emitted with all fields including `owner` indexed

#### Scenario: Non-VET cannot register

- GIVEN a caller without VET_ROLE
- WHEN they call `registerPet` with valid params
- THEN the call reverts with `AccessControlUnauthorizedAccount`

### Requirement: Appointment Scheduling

The system MUST allow creating a medical appointment linked to an existing pet. The caller MUST have VET_ROLE.
(Previously: no role guard on scheduleAppointment)

#### Scenario: Schedule appointment for existing pet

- GIVEN a caller with VET_ROLE
- AND a pet with ID `0x1` exists
- WHEN calling `scheduleAppointment` with petId, date (unix), time string, appointmentValue
- THEN the appointment is stored with a unique ID and `paidValue = 0`
- AND a `MedicalAppointmentCreated` event is emitted

#### Scenario: Non-VET cannot schedule

- GIVEN a caller without VET_ROLE
- WHEN they call `scheduleAppointment` with valid params
- THEN the call reverts with `AccessControlUnauthorizedAccount`
