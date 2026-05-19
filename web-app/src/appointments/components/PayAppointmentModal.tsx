import { useEffect } from "react";
import { usePayAppointmentToken } from "../../hooks/web3/usePayAppointmentToken";
import { USDC_ADDRESS } from "../../hooks/web3/contract";

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
 * PayAppointmentModal — two-step approve-then-pay modal for USDC payments.
 *
 * 1. Checks USDC allowance via usePayAppointmentToken
 * 2. Shows "Approve USDC" if allowance insufficient, or "Pay with USDC" if ready
 * 3. Handles tx feedback (approving, pending, processing, success, error)
 * 4. Auto-closes via onSuccess when payment completes
 */
export function PayAppointmentModal({
    appointmentId,
    amountInCents,
    onClose,
    onSuccess,
}: PayAppointmentModalProps) {
    const tokenAmount = BigInt(Math.round(amountInCents * 100)) * BigInt(10 ** 4);
    const { paymentState, approve, pay, reset } = usePayAppointmentToken(
        appointmentId,
        USDC_ADDRESS!,
        tokenAmount,
    );

    /** Watch for success → auto-close via onSuccess */
    useEffect(() => {
        if (paymentState.status === "success") {
            const timer = setTimeout(() => {
                onSuccess();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [paymentState.status, onSuccess]);

    const handleClose = () => {
        reset();
        onClose();
    };

    const dollarAmount = `$${(amountInCents / 100).toFixed(2)}`;

    const renderContent = () => {
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
                        <p className="tx-error">
                            Error: {paymentState.error.message}
                        </p>
                        <div className="dialog-actions">
                            <button className="btn-primary" onClick={reset}>
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

    return (
        <div className="dialog-overlay" onClick={handleClose}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
                <h2 className="dialog-title">Pay Appointment</h2>
                {renderContent()}
            </div>
        </div>
    );
}
