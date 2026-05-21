import { useState, useEffect, useCallback } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";
import { APPOINTMENTS_QUERY_KEY } from "../../appointments/hooks/useAppointments";

/**
 * ETH payment state discriminated union.
 *
 * Simpler than the USDC flow — no approve step:
 * - idle: No transaction initiated
 * - pending: Pay tx submitted to wallet, waiting for user confirmation
 * - processing: Pay tx submitted on-chain, waiting for receipt
 * - success: Pay tx confirmed
 * - error: Transaction failed
 */
export type EthPaymentState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "processing" }
  | { status: "success"; txHash: string }
  | { status: "error"; error: Error };

/**
 * Hook for paying an appointment with ETH via `payAppointmentEth`.
 *
 * Unlike the USDC flow, ETH is sent directly as `msg.value` —
 * no approve step needed. On success, invalidates appointments query.
 *
 * @param appointmentId - The on-chain appointment ID
 * @param priceFeedAddress - The MockPriceFeed contract address
 * @param expectedEth - The pre-computed ETH amount in wei to send
 */
export function usePayAppointmentEth(
  appointmentId: bigint,
  priceFeedAddress: `0x${string}` | undefined,
  expectedEth: bigint,
) {
  const queryClient = useQueryClient();

  /**
   * Tracks whether the user has fired pay().
   * Prevents the state derivation from falling through to idle
   * during the render gap between wallet confirm and watcher activation.
   */
  const [payTxSubmitted, setPayTxSubmitted] = useState(false);

  // -----------------------------------------------------------------------
  // Pay transaction
  // -----------------------------------------------------------------------
  const {
    writeContract: writePay,
    data: payTxHash,
    isPending: isPayPending,
    error: payError,
    reset: resetPayWrite,
  } = useWriteContract();

  /** Stable pay tx hash — keeps useWaitForTransactionReceipt alive */
  const [stablePayTxHash, setStablePayTxHash] = useState<
    `0x${string}` | undefined
  >();

  useEffect(() => {
    if (payTxHash) setStablePayTxHash(payTxHash);
  }, [payTxHash]);

  const {
    isLoading: isPayConfirming,
    isSuccess: isPaid,
    isError: isPayReceiptError,
    error: payReceiptError,
  } = useWaitForTransactionReceipt({
    hash: stablePayTxHash,
  });

  // Invalidate appointments on pay success
  useEffect(() => {
    if (isPaid) {
      queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
    }
  }, [isPaid, queryClient]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /** Pay for the appointment via payAppointmentEth with value = expectedEth. */
  const payEth = useCallback(() => {
    if (!priceFeedAddress || expectedEth <= 0n) return;

    setPayTxSubmitted(true);
    writePay({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "payAppointmentEth",
      args: [appointmentId, priceFeedAddress],
      value: expectedEth,
    });
  }, [writePay, appointmentId, priceFeedAddress, expectedEth]);

  /**
   * Reset all transaction state back to idle.
   */
  const resetEth = useCallback(() => {
    setPayTxSubmitted(false);
    setStablePayTxHash(undefined);
    resetPayWrite?.();
  }, [resetPayWrite]);

  // -----------------------------------------------------------------------
  // Derive EthPaymentState
  // -----------------------------------------------------------------------
  let ethState: EthPaymentState = { status: "idle" };

  // 1. Transaction errors (highest priority)
  if (payError) {
    ethState = { status: "error", error: payError };
  }
  // 2. Pay tx reverted on-chain
  else if (isPayReceiptError && (stablePayTxHash || payTxHash)) {
    ethState = {
      status: "error",
      error: payReceiptError ?? new Error("Transaction reverted"),
    };
  }
  // 3. Pay tx confirmed on-chain → success
  else if (isPaid) {
    ethState = {
      status: "success",
      txHash: stablePayTxHash ?? "",
    };
  }
  // 4. useWaitForTransactionReceipt actively watching for receipt
  else if (isPayConfirming) {
    ethState = { status: "processing" };
  }
  // 5. MetaMask waiting for user to confirm the pay tx
  else if (isPayPending) {
    ethState = { status: "pending" };
  }
  // 6. RACE CONDITION GUARD: tx submitted but watcher not yet active
  else if (payTxSubmitted || stablePayTxHash || payTxHash) {
    ethState = { status: "processing" };
  }
  // else: idle

  return { ethState, payEth, resetEth };
}
