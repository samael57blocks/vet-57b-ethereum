import { apiClient } from "../../../config/axios";
import type { Pet } from "../../types/pet";
import type { IPetService } from "../petService";

/**
 * Restful API implementation of the PetService using axios.
 */
export const AxiosPetService: IPetService = {
    getPets: async (): Promise<Pet[]> => {
        const response = await apiClient.get<Pet[]>('/pet');
        return response.data;
    },
};
