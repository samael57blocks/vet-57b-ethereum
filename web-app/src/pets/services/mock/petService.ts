import type { Pet } from "../../types/pet";
import type { IPetService } from "../petService";

/**
 * Implementation of the PetService using mock data
 */
export const MockPetService: IPetService = {
    getPets: async (): Promise<Pet[]> => {
        return [
            { id: '1', name: 'Buddy', age: 3, animalType: 'Dog' as const, caretakerName: 'Alice', caretakerPhone: '+56911111111', owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
            { id: '2', name: 'Max', age: 2, animalType: 'Dog' as const, caretakerName: 'Bob', caretakerPhone: '+56922222222', owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
            { id: '3', name: 'Bella', age: 1, animalType: 'Cat' as const, caretakerName: 'Carol', caretakerPhone: '+56933333333', owner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
        ]
    },
};