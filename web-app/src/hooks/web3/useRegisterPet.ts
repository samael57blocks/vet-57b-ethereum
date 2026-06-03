import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";

export type AnimalTypeRaw = 0 | 1;

export interface RegisterPetParams {
  name: string;
  age: number;
  animalType: AnimalTypeRaw;
  owner: `0x${string}`;
  caretakerName: string;
  caretakerPhone: string;
}

/**
 * Transaction states for UI feedback.
 */
export type TxState =
  | { status: "idle" }
  | { status: "pending" }       // Wallet approval
  | { status: "processing" }    // Transaction mining
  | { status: "success"; txHash: string; petId?: bigint }
  | { status: "error"; error: Error };

/**
 * Hook to register a new pet via the VetRegistry contract.
 *
 * Stores the tx hash in local state so even if wagmi resets,
 * useWaitForTransactionReceipt keeps polling for the receipt.
 *
 * Usage:
 * ```tsx
 * const { registerPet, txState } = useRegisterPet();
 *
 * // When user submits the form:
 * registerPet({ name: "Boby", age: 5, animalType: 0, owner: "0x...", caretakerName: "John", caretakerPhone: "+56912345678" });
 * ```
 */
export function useRegisterPet() {
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
   * Sends a registerPet transaction to the contract.
   */
  const registerPet = (params: RegisterPetParams) => {
    writeContract({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "registerPet",
      args: [
        params.name,
        params.age,
        params.animalType,
        params.owner,
        params.caretakerName,
        params.caretakerPhone,
      ],
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

  return { registerPet, txState, txHash: stableTxHash };
}
