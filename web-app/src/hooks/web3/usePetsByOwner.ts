import { useReadContract } from "wagmi";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";

/**
 * Hook to read all pet IDs owned by a given address from the VetRegistry contract.
 *
 * Uses wagmi's useReadContract for automatic caching and refetching.
 * Query is enabled only when `owner` is provided.
 *
 * Usage:
 * ```tsx
 * const { data: petIds, isLoading } = usePetsByOwner("0x...");
 * ```
 */
export function usePetsByOwner(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: VET_REGISTRY_ADDRESS,
    abi: vetRegistryABI,
    functionName: "getPetsByOwner",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });
}
