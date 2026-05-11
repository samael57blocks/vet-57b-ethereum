/**
 * Type of animals that the Vet can treat.
 */
export const AnimalType = {
    DOG: 'Dog',
    CAT: 'Cat',
} as const;
/**
 * Type of animals that the Vet can treat.
 */
export type AnimalType = typeof AnimalType[keyof typeof AnimalType];

/**
 * Defines the structure of a medical record for a Pet
 */
export interface Pet {
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
