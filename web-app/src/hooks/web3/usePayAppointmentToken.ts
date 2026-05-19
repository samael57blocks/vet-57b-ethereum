import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { VET_REGISTRY_ADDRESS, erc20ABI, vetRegistryABI } from "./contract";
import { APPOINTMENTS_QUERY_KEY } from "../../appointments/hooks/useAppointments";

/**
 * Payment state discriminated union for the approve-then-pay flow.
 *
 * - idle: No transaction initiated, allowance not yet determined
 * - needs-approval: Allowance is insufficient — user should call approve()
 * - approving: Approve tx submitted to wallet, waiting for user confirmation
 * - approval-processing: Approve tx confirmed on-chain, allowance refetch in progress
 * - ready-to-pay: Allowance sufficient — user can call pay()
 * - pending: Pay tx submitted to wallet, waiting for user confirmation
 * - processing: Pay tx submitted on-chain, waiting for receipt
 * - success: Pay tx confirmed
 * - error: Any write operation failed
 */
export type PaymentState =
  | { status: "idle" }
  | { status: "needs-approval" }
  | { status: "approving" }
  | { status: "approval-processing" }
  | { status: "ready-to-pay" }
  | { status: "pending" }
  | { status: "processing" }
  | { status: "success"; txHash: string }
  | { status: "error"; error: Error };

/**
 * Single hook that orchestrates the approve-then-pay flow for USDC appointment payments.
 *
 * 1. Reads USDC allowance via useReadContract (auto-refetches on chain switch)
 * 2. If allowance < amount, exposes approve() to request token approval
 * 3. Once allowance is sufficient, exposes pay() to call payAppointmentToken
 * 4. On pay success, invalidates APPOINTMENTS_QUERY_KEY so the UI refreshes
 *
 * @param appointmentId - The on-chain appointment ID
 * @param tokenAddress - The USDC (or other ERC-20) token address
 * @param amount - The required token amount (in token decimals, not cents)
 */
export function usePayAppointmentToken(
  appointmentId: bigint,
  tokenAddress: `0x${string}`,
  amount: bigint,
) {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  // -----------------------------------------------------------------------
  // Allowance check
  // -----------------------------------------------------------------------
  const {
    data: allowance,
    refetch: refetchAllowance,
    isFetching: isAllowanceFetching,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20ABI,
    functionName: "allowance",
    args: address ? [address, VET_REGISTRY_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const hasSufficientAllowance =
    allowance !== undefined && allowance >= amount;

  // -----------------------------------------------------------------------
  // Approve transaction
  // -----------------------------------------------------------------------
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApproveWrite,
  } = useWriteContract();

  /** Stable approve tx hash — keeps useWaitForTransactionReceipt alive */
  const [stableApproveTxHash, setStableApproveTxHash] = useState<
    `0x${string}` | undefined
  >();

  useEffect(() => {
    if (approveTxHash) setStableApproveTxHash(approveTxHash);
  }, [approveTxHash]);

  const {
    isLoading: isApproveConfirming,
    isSuccess: isApproved,
  } = useWaitForTransactionReceipt({
    hash: stableApproveTxHash,
  });

  // Refetch allowance when approve tx confirms
  useEffect(() => {
    if (isApproved) {
      void refetchAllowance();
    }
  }, [isApproved, refetchAllowance]);

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

  /** Approve the VetRegistry contract to spend `amount` tokens. */
  const approve = useCallback(() => {
    writeApprove({
      address: tokenAddress,
      abi: erc20ABI,
      functionName: "approve",
      args: [VET_REGISTRY_ADDRESS, amount],
    });
  }, [writeApprove, tokenAddress, amount]);

  /** Pay for the appointment via payAppointmentToken. */
  const pay = useCallback(() => {
    writePay({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "payAppointmentToken",
      args: [appointmentId, tokenAddress],
    });
  }, [writePay, appointmentId, tokenAddress]);

  /**
   * Reset all transaction state back to idle.
   * Call this after success/error to allow a fresh start.
   */
  const reset = useCallback(() => {
    setStableApproveTxHash(undefined);
    setStablePayTxHash(undefined);
    resetApproveWrite?.();
    resetPayWrite?.();
  }, [resetApproveWrite, resetPayWrite]);

  // -----------------------------------------------------------------------
  // Derive PaymentState
  // -----------------------------------------------------------------------
  let paymentState: PaymentState = { status: "idle" };

  if (payError) {
    paymentState = { status: "error", error: payError };
  } else if (approveError) {
    paymentState = { status: "error", error: approveError };
  } else if (isPaid) {
    paymentState = {
      status: "success",
      txHash: stablePayTxHash ?? "",
    };
  } else if (isPayConfirming) {
    paymentState = { status: "processing" };
  } else if (isPayPending) {
    paymentState = { status: "pending" };
  } else if (isApproved) {
    // Approve tx confirmed — check if refetch completed and allowance is now sufficient
    if (hasSufficientAllowance) {
      paymentState = { status: "ready-to-pay" };
    } else if (isAllowanceFetching) {
      paymentState = { status: "approval-processing" };
    } else {
      // Refetch completed but allowance still insufficient → approve more
      paymentState = { status: "needs-approval" };
    }
  } else if (isApproveConfirming) {
    paymentState = { status: "approval-processing" };
  } else if (isApprovePending) {
    paymentState = { status: "approving" };
  } else if (allowance !== undefined) {
    // Allowance loaded — decide based on value
    paymentState = hasSufficientAllowance
      ? { status: "ready-to-pay" }
      : { status: "needs-approval" };
  }
  // else: allowance still loading → idle

  return { paymentState, approve, pay, reset };
}
