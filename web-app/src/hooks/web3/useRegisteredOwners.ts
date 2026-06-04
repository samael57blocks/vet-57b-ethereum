import { useReadContract } from "wagmi";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";
import type { Owner } from "../../owners/types/owner";

/** TanStack Query key for invalidating registered-owners reads across the app. */
export const REGISTERED_OWNERS_QUERY_KEY = [
  "vetRegistry",
  "getRegisteredOwners",
] as const;

type OwnerInfoStruct = {
  wallet?: string;
  name?: string;
  registered?: boolean;
};

function mapOwnerEntry(entry: unknown): Owner | null {
  if (entry === null || entry === undefined) return null;

  if (typeof entry === "object" && "wallet" in entry) {
    const struct = entry as OwnerInfoStruct;
    const wallet = struct.wallet;
    if (!wallet) return null;
    return {
      address: wallet.toLowerCase(),
      name: struct.name ?? "",
    };
  }

  if (Array.isArray(entry)) {
    const [wallet, name] = entry as [string, string, boolean?];
    if (!wallet) return null;
    return {
      address: String(wallet).toLowerCase(),
      name: String(name ?? ""),
    };
  }

  return null;
}

/**
 * Maps raw OwnerInfo from the contract to the frontend Owner type.
 * Viem/wagmi decode structs as `{ wallet, name, registered }`; legacy tuples are supported.
 */
export function mapOwnerInfo(raw: unknown): Owner[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(mapOwnerEntry)
    .filter((owner): owner is Owner => owner !== null);
}

/**
 * Hook to read all registered owners from the VetRegistry contract.
 *
 * Uses wagmi's useReadContract for automatic caching and refetching.
 *
 * Usage:
 * ```tsx
 * const { data: owners, isLoading, refetch } = useRegisteredOwners();
 * ```
 */
export function useRegisteredOwners() {
  const result = useReadContract({
    address: VET_REGISTRY_ADDRESS,
    abi: vetRegistryABI,
    functionName: "getRegisteredOwners",
    query: {
      queryKey: [...REGISTERED_OWNERS_QUERY_KEY],
    },
  });

  const owners: Owner[] = mapOwnerInfo(result.data);

  return {
    ...result,
    data: owners,
  };
}
