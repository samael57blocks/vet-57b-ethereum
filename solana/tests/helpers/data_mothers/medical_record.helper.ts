import { AnimalType, NewMedicalRecord } from "../../../app/models";
import { Keypair, PublicKey } from "@solana/web3.js";

/**
 * Creates a NewMedicalRecord request based on partial information proved by the developer.
 * @param data - The partial information to create the request.
 * @returns A NewMedicalRecord request.
 */
export function givenNewMedicalRecord(data?: Partial<NewMedicalRecord>): NewMedicalRecord {
    // Define the default values
    const defaultValues: NewMedicalRecord = {
        id: Keypair.generate().publicKey,
        name: 'Boby',
        age: 5,
        animalType: AnimalType.DOG,
        caretakerName: 'John Doe',
        caretakerPhone: '+56912345678',
    };
    // Merge the default values with the provided data
    return Object.assign(defaultValues, data);
}
