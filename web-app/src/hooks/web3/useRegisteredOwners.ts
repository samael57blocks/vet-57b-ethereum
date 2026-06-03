import { useReadContract } from "wagmi";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";
import type { Owner } from "../../owners/types/owner";

/**
 * Maps raw OwnerInfo tuples from the contract to the frontend Owner type.
 *
 * The contract returns OwnerInfo[] where each entry is a tuple:
 *   [wallet: address, name: string, registered: bool]
 */
function mapOwnerInfo(raw: unknown): Owner[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry: unknown) => {
    const tuple = entry as [string, string, boolean];
    return {
      address: tuple[0]?.toLowerCase() ?? "",
      name: tuple[1] ?? "",
    };
  });
}

/**
 * Hook to read all registered owners from the VetRegistry contract.
 *
 * Uses wagmi's useReadContract for automatic caching and refetching.
 *
 * Usage:
 * ```tsx
 * const { data: owners, isLoading } = useRegisteredOwners();
 * ```
 */
export function useRegisteredOwners() {
  const result = useReadContract({
    address: VET_REGISTRY_ADDRESS,
    abi: vetRegistryABI,
    functionName: "getRegisteredOwners",
  });

  const owners: Owner[] = mapOwnerInfo(result.data);

  return {
    ...result,
    data: owners,
  };
}
