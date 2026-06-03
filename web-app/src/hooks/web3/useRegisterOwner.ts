import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";

/**
 * Transaction states for UI feedback.
 */
export type TxState =
  | { status: "idle" }
  | { status: "pending" }       // Wallet approval
  | { status: "processing" }    // Transaction mining
  | { status: "success"; txHash: string }
  | { status: "error"; error: Error };

/**
 * Hook to register as an owner via the VetRegistry contract.
 *
 * Stores the tx hash in local state so even if wagmi resets,
 * useWaitForTransactionReceipt keeps polling for the receipt.
 *
 * Usage:
 * ```tsx
 * const { registerOwner, txState } = useRegisterOwner();
 * registerOwner("John Doe");
 * ```
 */
export function useRegisterOwner() {
  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();

  /** Stable tx hash — once set, never clears. Keeps useWaitForTransactionReceipt alive. */
  const [stableTxHash, setStableTxHash] = useState<`0x${string}` | undefined>();

  useEffect(() => {
    if (txHash) setStableTxHash(txHash);
  }, [txHash]);

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: stableTxHash,
    });

  /**
   * Sends a registerAsOwner transaction to the contract.
   * @param name - Owner display name (2-32 chars enforced by contract)
   */
  const registerOwner = (name: string) => {
    writeContract({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "registerAsOwner",
      args: [name],
    });
  };

  /** Derive current transaction state */
  let txState: TxState = { status: "idle" };

  if (writeError) {
    txState = { status: "error", error: writeError };
  } else if (isConfirmed) {
    txState = { status: "success", txHash: stableTxHash ?? "" };
  } else if (isConfirming) {
    txState = { status: "processing" };
  } else if (isPending) {
    txState = { status: "pending" };
  }

  return { registerOwner, txState, txHash: stableTxHash };
}
