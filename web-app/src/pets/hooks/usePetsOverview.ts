import { useQuery } from "@tanstack/react-query";
import { PetService } from "../services/petService";
import type { Pet } from "../types/pet";

/**
 * Query key for the pets list — importable for cache invalidation.
 */
export const PET_QUERY_KEY = ["vetRegistry", "pets"] as const;

/**
 * Hook to fetch pets overview using TanStack Query.
 *
 * Data source is determined by the PetService factory:
 * - VITE_USE_MOCK_DATA=true → MockPetService
 * - VITE_USE_MOCK_DATA=false → Web3PetService (reads from Ethereum contract)
 *
 * Preserves the original { pets, loading, error } return shape
 * for backward compatibility with PetsOverviewPage.
 */
export const usePetsOverview = () => {
  const { data: pets = [], isLoading: loading, error } = useQuery<Pet[], Error>({
    queryKey: PET_QUERY_KEY,
    queryFn: PetService.getPets,
  });

  // Normalize Error | null to string | null for backward compat
  const normalizedError = error ? error.message : null;

  return { pets, loading, error: normalizedError };
};
