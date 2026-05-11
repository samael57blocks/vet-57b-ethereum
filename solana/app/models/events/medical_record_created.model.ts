import { AnimalType } from "../medical_record.model";

/**
 * Defines the information emitted by the event when a new medical record
 * is created for a pet.
 */
export interface MedicalRecordCreatedEvent {
    /** The ID of the medical record */
    id: string;
    /** The name of the patient */
    name: string;
    /** The age of the patient */
    age: number;
    /** The type of animal */
    animalType: AnimalType;

    /** The name of the pet's caretaker */
    caretakerName: string;
    /** The phone number of the pet's caretaker */
    caretakerPhone: string;
};
