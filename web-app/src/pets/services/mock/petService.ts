import type { Pet } from "../../types/pet";
import type { IPetService } from "../petService";

/**
 * Implementation of the PetService using mock data
 */
export const MockPetService: IPetService = {
    getPets: async (): Promise<Pet[]> => {
        return [
            { id: '1', name: 'Buddy', age: 3, animalType: 'Dog' as const, caretakerName: 'Alice', caretakerPhone: '+56911111111' },
            { id: '2', name: 'Max', age: 2, animalType: 'Dog' as const, caretakerName: 'Bob', caretakerPhone: '+56922222222' },
            { id: '3', name: 'Bella', age: 1, animalType: 'Cat' as const, caretakerName: 'Carol', caretakerPhone: '+56933333333' },
        ]
    },
};