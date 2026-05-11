import type { Pet } from "../types/pet";
import { MockPetService } from "./mock/petService";
import { AxiosPetService } from "./rest/petService";

/**
 * Defines the behavior a PetService implementation must follow.
 */
export interface IPetService {
    /**
     * Gets all the pets from the datasource.
     * @returns A promise that resolves to an array of pets.
     */
    getPets: () => Promise<Pet[]>;
}

export const PetService: IPetService = import.meta.env.VITE_USE_MOCK_DATA ? MockPetService : AxiosPetService;
