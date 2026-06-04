import { useAccount } from "wagmi";
import { useRegisteredOwners } from "./useRegisteredOwners";

/**
 * True when the connected wallet is listed in getRegisteredOwners().
 */
export function useIsRegisteredOwner(): {
  isRegisteredOwner: boolean;
  isLoading: boolean;
  error: Error | null;
} {
  const { address, isConnected } = useAccount();
  const { data: owners = [], isLoading, error } = useRegisteredOwners();

  if (!isConnected || !address) {
    return { isRegisteredOwner: false, isLoading: false, error: null };
  }

  const isRegisteredOwner = owners.some(
    (o) => o.address === address.toLowerCase(),
  );

  return {
    isRegisteredOwner,
    isLoading: isLoading && isConnected,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
  };
}
