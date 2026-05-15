import { useEffect, useState } from "react";
import { PetService } from "../services/petService";
import type { Pet } from "../types/pet";

/**
 * Hook to fetch pets overview.
 *
 * Data source is determined by the PetService factory:
 * - VITE_USE_MOCK_DATA=true → MockPetService
 * - VITE_USE_MOCK_DATA=false → Web3PetService (reads from Ethereum contract)
 */
export const usePetsOverview = () => {
    const [pets, setPets] = useState<Pet[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError(null);

        PetService.getPets()
            .then((data) => {
                if (!cancelled) {
                    setPets(data);
                }
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    console.error("Error fetching pets", err);
                    setError(err.message);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    return { pets, loading, error };
};
