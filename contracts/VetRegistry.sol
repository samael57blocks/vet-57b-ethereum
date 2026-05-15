// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title VetRegistry
 * @notice Veterinary clinic registry for managing pet medical records and appointments
 */
contract VetRegistry {
    // ==================== Types ====================

    enum AnimalType { Dog, Cat }

    struct MedicalRecord {
        string name;
        uint8 age;
        AnimalType animalType;
        string caretakerName;
        string caretakerPhone;
    }

    struct MedicalAppointment {
        uint256 petId;
        uint256 date;
        string time;
        uint256 appointmentValue;
        uint256 paidValue;
    }

    // ==================== Events ====================

    event MedicalRecordCreated(
        uint256 indexed id,
        string name,
        uint8 age,
        AnimalType animalType,
        string caretakerName,
        string caretakerPhone
    );

    event MedicalAppointmentCreated(
        uint256 indexed id,
        uint256 indexed petId,
        uint256 date,
        string time,
        uint256 appointmentValue
    );

    // ==================== State ====================

    uint256 private _petCount;
    uint256 private _appointmentCount;

    mapping(uint256 => MedicalRecord) private _medicalRecords;
    mapping(uint256 => MedicalAppointment) private _appointments;

    // ==================== Public Functions ====================

    /**
     * @notice Register a new pet medical record
     * @param name Pet's name
     * @param age Pet's age
     * @param animalType Pet's animal type (Dog or Cat)
     * @param caretakerName Caretaker's name
     * @param caretakerPhone Caretaker's phone number
     * @return id The assigned unique identifier for the new record
     */
    function registerPet(
        string calldata name,
        uint8 age,
        AnimalType animalType,
        string calldata caretakerName,
        string calldata caretakerPhone
    ) external returns (uint256 id) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(age > 0, "Age must be greater than 0");

        _petCount++;
        uint256 newId = _petCount;

        _medicalRecords[newId] = MedicalRecord({
            name: name,
            age: age,
            animalType: animalType,
            caretakerName: caretakerName,
            caretakerPhone: caretakerPhone
        });

        emit MedicalRecordCreated(
            newId,
            name,
            age,
            animalType,
            caretakerName,
            caretakerPhone
        );

        return newId;
    }

    /**
     * @notice Get a pet's medical record by ID
     * @param id The pet's unique identifier
     * @return MedicalRecord The pet's medical record
     */
    function getMedicalRecord(uint256 id) external view returns (MedicalRecord memory) {
        require(id > 0 && id <= _petCount, "Pet does not exist");
        return _medicalRecords[id];
    }

    /**
     * @notice Get total number of registered pets
     * @return uint256 Total pet count
     */
    function getPetCount() external view returns (uint256) {
        return _petCount;
    }

    /**
     * @notice Schedule a medical appointment for a pet
     * @param petId The pet's unique identifier
     * @param date Appointment date (unix timestamp)
     * @param time Appointment time as string
     * @param appointmentValue Appointment cost in dollar cents
     * @return id The assigned unique identifier for the new appointment
     */
    function scheduleAppointment(
        uint256 petId,
        uint256 date,
        string calldata time,
        uint256 appointmentValue
    ) external returns (uint256 id) {
        require(petId > 0 && petId <= _petCount, "Pet does not exist");
        require(date > 0, "Date must be provided");
        require(appointmentValue > 0, "Appointment value must be greater than 0");

        _appointmentCount++;
        uint256 newId = _appointmentCount;

        _appointments[newId] = MedicalAppointment({
            petId: petId,
            date: date,
            time: time,
            appointmentValue: appointmentValue,
            paidValue: 0
        });

        emit MedicalAppointmentCreated(
            newId,
            petId,
            date,
            time,
            appointmentValue
        );

        return newId;
    }
}
