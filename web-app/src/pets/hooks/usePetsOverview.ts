import { useEffect, useState } from "react";
import { PetService } from "../services/petService";
import type { Pet } from "../types/pet";

export const usePetsOverview = () => {
    // Define the pets state to use in the overview
    const [pets, setPets] = useState<Pet[]>([]);

    useEffect(() => {
        // Fetch the pets from the datasource
        PetService.getPets().then((pets) => {
            // Set the pets in the state
            setPets(pets);
        }).catch((error) => {
            console.error('Error fetching pets', error);
        });
    }, []);

    return { pets };
};
