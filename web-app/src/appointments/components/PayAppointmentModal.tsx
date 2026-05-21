import { useEffect, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { usePayAppointmentToken } from "../../hooks/web3/usePayAppointmentToken";
import { usePayAppointmentEth } from "../../hooks/web3/usePayAppointmentEth";
import {
  USDC_ADDRESS,
  PRICE_FEED_ADDRESS,
  priceFeedABI,
} from "../../hooks/web3/contract";

/**
 * Payment method type for the selector dropdown.
 */
type PaymentMethod = "USDC" | "ETH";

/**
 * Props for the PayAppointmentModal component.
 */
export interface PayAppointmentModalProps {
  appointmentId: bigint;
  amountInCents: number;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Constant: 10^24 used for _centsToEth computation.
 * Formula: expectedEth = (cents * 1e24) / price
 */
const ONE_E24 = BigInt(10) ** 24n;

/**
 * PayAppointmentModal — payment method selector with USDC approve-then-pay
 * or ETH direct-pay flow.
 *
 * ETH option is only shown when VITE_PRICE_FEED_ADDRESS is set.
 * Default payment method is USDC.
 */
export function PayAppointmentModal({
  appointmentId,
  amountInCents,
  onClose,
  onSuccess,
}: PayAppointmentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("USDC");

  const showEthOption = !!PRICE_FEED_ADDRESS;

  // -------------------------------------------------------------------
  // USDC flow (existing approve-then-pay)
  // -------------------------------------------------------------------
  // Convert cents to USDC units (6 decimals):
  // contract does cents * 10^(tokenDecimals - 2) → 5000 * 10^4 = 50,000,000 for USDC
  const tokenAmount = BigInt(amountInCents) * BigInt(10 ** 4);
  const { paymentState, approve, pay, reset: resetUsdc } =
    usePayAppointmentToken(
      appointmentId,
      USDC_ADDRESS!,
      tokenAmount,
    );

  // -------------------------------------------------------------------
  // ETH flow — read price feed for estimate
  // -------------------------------------------------------------------
  const { data: roundData } = useReadContract({
    address: PRICE_FEED_ADDRESS,
    abi: priceFeedABI,
    functionName: "latestRoundData",
    query: { enabled: !!PRICE_FEED_ADDRESS },
  });

  // roundData is a tuple: (roundId, answer, startedAt, updatedAt, answeredInRound)
  const price = (roundData as unknown as bigint[])?.[1] ?? 0n;
  const expectedEth =
    price > 0n
      ? (BigInt(amountInCents) * ONE_E24) / price
      : 0n;

  const { ethState, payEth, resetEth } = usePayAppointmentEth(
    appointmentId,
    PRICE_FEED_ADDRESS,
    expectedEth,
  );

  // Reset the other flow when switching payment method
  const prevMethodRef = useRef<PaymentMethod>(paymentMethod);
  useEffect(() => {
    if (prevMethodRef.current !== paymentMethod) {
      if (paymentMethod === "USDC") {
        resetEth();
      } else {
        resetUsdc();
      }
      prevMethodRef.current = paymentMethod;
    }
  }, [paymentMethod, resetUsdc, resetEth]);

  // -------------------------------------------------------------------
  // Shared handlers
  // -------------------------------------------------------------------
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  /** Watch for success → auto-close via onSuccess */
  useEffect(() => {
    const isSuccess =
      paymentMethod === "USDC"
        ? paymentState.status === "success"
        : ethState.status === "success";
    if (isSuccess) {
      const timer = setTimeout(() => {
        onSuccessRef.current();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [paymentState.status, ethState.status, paymentMethod]);

  const handleClose = () => {
    resetUsdc();
    resetEth();
    onClose();
  };

  const dollarAmount = `$${(amountInCents / 100).toFixed(2)}`;
  const ethEstimate =
    expectedEth > 0n ? `≈ ${formatUnits(expectedEth, 18)} ETH` : "≈ estimating...";

  // -------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------

  /** Payment method dropdown — only shown when ETH feed address is available */
  const renderPaymentSelector = () => {
    if (!showEthOption) return null;

    return (
      <div className="payment-method-selector">
        <label htmlFor="payment-method">Pay with</label>
        <select
          id="payment-method"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
        >
          <option value="USDC">USDC</option>
          <option value="ETH">ETH</option>
        </select>
      </div>
    );
  };

  /** USDC approve-then-pay flow (existing) */
  const renderUsdcContent = () => {
    switch (paymentState.status) {
      case "idle":
        return (
          <div className="tx-feedback">
            <div className="spinner" />
            <p>Checking allowance...</p>
          </div>
        );

      case "needs-approval":
        return (
          <>
            <p className="dialog-description">
              Pay {dollarAmount} USDC for this appointment.
            </p>
            <p className="dialog-description">
              First, approve the USDC spending limit.
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button className="btn-primary" onClick={approve}>
                Approve USDC
              </button>
            </div>
          </>
        );

      case "approving":
      case "approval-processing":
        return (
          <div className="tx-feedback">
            <div className="spinner" />
            <p>Approving USDC...</p>
          </div>
        );

      case "ready-to-pay":
        return (
          <>
            <p className="dialog-description">
              Pay {dollarAmount} USDC for this appointment.
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button className="btn-primary" onClick={pay}>
                Pay with USDC
              </button>
            </div>
          </>
        );

      case "pending":
      case "processing":
        return (
          <div className="tx-feedback">
            <div className="spinner" />
            <p>Processing payment...</p>
          </div>
        );

      case "success":
        return (
          <div className="tx-feedback">
            <p>Payment successful!</p>
          </div>
        );

      case "error":
        return (
          <div className="tx-feedback">
            <p className="tx-error">Error: {paymentState.error.message}</p>
            <div className="dialog-actions">
              <button className="btn-primary" onClick={resetUsdc}>
                Try Again
              </button>
              <button className="btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  /** ETH direct-pay flow (no approve step) */
  const renderEthContent = () => {
    switch (ethState.status) {
      case "idle":
        return (
          <>
            <p className="dialog-description">
              Pay {dollarAmount} ({ethEstimate}) for this appointment.
            </p>
            <p className="dialog-description">
              No approve step needed — ETH is sent directly.
            </p>
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={payEth}
                disabled={expectedEth <= 0n}
              >
                Pay with ETH
              </button>
            </div>
          </>
        );

      case "pending":
      case "processing":
        return (
          <div className="tx-feedback">
            <div className="spinner" />
            <p>Processing ETH payment...</p>
          </div>
        );

      case "success":
        return (
          <div className="tx-feedback">
            <p>Payment successful!</p>
          </div>
        );

      case "error":
        return (
          <div className="tx-feedback">
            <p className="tx-error">Error: {ethState.error.message}</p>
            <div className="dialog-actions">
              <button className="btn-primary" onClick={resetEth}>
                Try Again
              </button>
              <button className="btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // -------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------
  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Pay Appointment</h2>
        {renderPaymentSelector()}
        {paymentMethod === "USDC" ? renderUsdcContent() : renderEthContent()}
      </div>
    </div>
  );
}
