import { PublicKey } from "@solana/web3.js";

/**
 * Type of animal that the Vet can treat.
 */
export enum AnimalType {
  DOG = 'Dog',
  Cat = 'Cat',
};

/**
 * A medical record for a Pet in the 57B Vet.
 */
export interface MedicalRecord {
  /** The ID of the medical record */
  id: PublicKey;
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

/**
 * Class definition for the medical record account.
 */
export class MedicalRecord {
  /**
   * Derives the address of the medical record account from the ID of the medical record.
   * @param id - The ID of the medical record.
   * @param programId - The ID of the program.
   * @returns The address of the medical record account.
   */
  static deriveAddress(id: PublicKey, programId: PublicKey): PublicKey {
    throw new Error('Not implemented');
  }
}

/**
 * The information required to create a new medical record for a Pet in the 57B Vet.
 */
export interface NewMedicalRecord {
  /** The ID of the medical record */
  id: PublicKey;
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
