import { useAccount, useReadContract } from "wagmi";
import { VET_REGISTRY_ADDRESS, vetRegistryABI, VET_ADDRESS } from "./contract";
import { VET_ROLE } from "./vetRole";

const useMockData = import.meta.env.VITE_USE_MOCK_DATA === "true";

/**
 * True when the connected wallet is a veterinarian.
 * Mock mode: address matches VITE_VET_ADDRESS. Live mode: hasRole(VET_ROLE) on VetRegistry.
 */
export function useIsVet(): { isVet: boolean; isLoading: boolean } {
  const { address, isConnected } = useAccount();

  const { data: hasRole, isLoading } = useReadContract({
    address: VET_REGISTRY_ADDRESS,
    abi: vetRegistryABI,
    functionName: "hasRole",
    args: address ? [VET_ROLE, address] : undefined,
    query: {
      enabled: isConnected && !!address && !useMockData,
    },
  });

  if (!isConnected || !address) {
    return { isVet: false, isLoading: false };
  }

  if (useMockData) {
    const vetAddr = VET_ADDRESS?.toLowerCase();
    return {
      isVet: !!vetAddr && address.toLowerCase() === vetAddr,
      isLoading: false,
    };
  }

  return { isVet: !!hasRole, isLoading };
}
