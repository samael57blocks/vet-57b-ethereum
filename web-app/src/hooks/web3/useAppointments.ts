import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";
import { APPOINTMENTS_QUERY_KEY } from "../../appointments/hooks/useAppointments";

/**
 * Transaction states for UI feedback.
 *
 * - idle: No transaction in progress
 * - pending: Wallet approval requested
 * - processing: Transaction submitted, waiting for confirmation
 * - success: Transaction confirmed on-chain
 * - error: Transaction failed or was rejected
 */
export type TxState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "processing" }
  | { status: "success"; txHash: string }
  | { status: "error"; error: Error };

/**
 * Hook to schedule a medical appointment for a pet.
 *
 * Exposes txState for lifecycle feedback (idle → pending → processing → success/error).
 * Auto-invalidates the appointments query cache on successful confirmation.
 *
 * Usage:
 * ```tsx
 * const { scheduleAppointment, txState, reset } = useScheduleAppointment();
 * scheduleAppointment(petId, date, time, value);
 * ```
 */
export function useScheduleAppointment() {
  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset: resetWrite,
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

  const queryClient = useQueryClient();

  // Auto-invalidate appointments cache on successful confirmation
  useEffect(() => {
    if (isConfirmed) {
      queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
    }
  }, [isConfirmed, queryClient]);

  /**
   * Schedules an appointment for a given pet.
   * @param petId - The pet's on-chain ID
   * @param date - Unix timestamp for the appointment date
   * @param time - Time string (e.g. "10:30")
   * @param appointmentValue - Cost in dollar cents
   */
  const scheduleAppointment = (
    petId: bigint,
    date: bigint,
    time: string,
    appointmentValue: bigint
  ) => {
    writeContract({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "scheduleAppointment",
      args: [petId, date, time, appointmentValue],
    });
  };

  /** Resets txState back to idle. Call after success/error to clear state. */
  const reset = () => {
    setStableTxHash(undefined);
    resetWrite?.();
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

  return { scheduleAppointment, txState, reset, txHash: stableTxHash };
}
