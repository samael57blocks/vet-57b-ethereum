import type { Pet } from "../types/pet";
import { MockPetService } from "./mock/petService";
import { Web3PetService } from "./web3/petService";

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

/**
 * PetService factory.
 * - VITE_USE_MOCK_DATA=true → MockPetService (hardcoded data)
 * - VITE_USE_MOCK_DATA=false → Web3PetService (reads from Ethereum contract)
 */
export const PetService: IPetService = import.meta.env.VITE_USE_MOCK_DATA === "true" ? MockPetService : Web3PetService;
