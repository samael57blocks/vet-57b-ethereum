import type { Pet } from "../../types/pet";
import type { IPetService } from "../petService";

/**
 * Implementation of the PetService using mock data
 */
export const MockPetService: IPetService = {
    getPets: async (): Promise<Pet[]> => {
        return [
            {
                id: '1',
                name: 'Buddy',
                age: 3,
            },
            {
                id: '2',
                name: 'Max',
                age: 2,
            },
            {
                id: '3',
                name: 'Bella',
                age: 1,
            },
        ]
    },
};