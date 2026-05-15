import { useReadContract } from "wagmi";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";

/**
 * Hook to fetch total registered pet count.
 */
export function usePetCount() {
  return useReadContract({
    address: VET_REGISTRY_ADDRESS,
    abi: vetRegistryABI,
    functionName: "getPetCount",
  });
}

/**
 * Hook to fetch a single pet by ID.
 */
export function usePet(id: bigint | undefined) {
  return useReadContract({
    address: VET_REGISTRY_ADDRESS,
    abi: vetRegistryABI,
    functionName: "getMedicalRecord",
    args: id !== undefined ? [id] : undefined,
    query: {
      enabled: id !== undefined && id > 0n,
    },
  });
}

/**
 * Hook to fetch all pets via the contract.
 * Uses the Web3PetService which handles batch reads.
 * For real-time reactive reads, consider multicall or Graph protocol.
 */
export function usePets() {
  const { data: count, isLoading: countLoading, error } = usePetCount();

  return {
    count: count ?? 0n,
    isLoading: countLoading,
    error,
  };
}
