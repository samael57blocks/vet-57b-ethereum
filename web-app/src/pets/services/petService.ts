import type { Pet } from "../types/pet";
import { MockPetService } from "./mock/petService";
import { Web3PetService } from "./web3/petService";
import { apiClient } from "../../config/axios";

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

// ---------------------------------------------------------------------------
// Axios PetService — reads from the Go backend REST API
// ---------------------------------------------------------------------------

/** Shape of a pet returned by the backend (JSON numbers for id/age). */
interface PetResponse {
    id: number;
    name: string;
    age: number;
    animalType: string;
    caretakerName: string;
    caretakerPhone: string;
    owner: string;
    createdAt: string;
}

/** Shape of the paginated API response. */
interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

/**
 * Implementation of PetService that reads from the backend indexer REST API.
 * Called when VITE_USE_MOCK_DATA is not "true" (i.e. false or unset).
 */
export const AxiosPetService: IPetService = {
    getPets: async (): Promise<Pet[]> => {
        const response = await apiClient.get<PaginatedResponse<PetResponse>>(
            "/api/v1/pets?limit=100",
        );

        return response.data.data.map((p) => ({
            id: p.id.toString(),
            name: p.name,
            age: p.age,
            animalType: p.animalType as Pet["animalType"],
            caretakerName: p.caretakerName,
            caretakerPhone: p.caretakerPhone,
            owner: p.owner,
        }));
    },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * PetService factory.
 * - VITE_USE_MOCK_DATA=true → MockPetService (hardcoded data)
 * - VITE_USE_MOCK_DATA=false → AxiosPetService (reads from Go backend REST API)
 * - (unset) → AxiosPetService (same as false — default to backend)
 */
export const PetService: IPetService =
    import.meta.env.VITE_USE_MOCK_DATA === "true"
        ? MockPetService
        : AxiosPetService;
