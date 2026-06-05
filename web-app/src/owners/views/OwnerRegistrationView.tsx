import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRegisterOwner } from "../../hooks/web3/useRegisterOwner";
import {
  useRegisteredOwners,
  REGISTERED_OWNERS_QUERY_KEY,
} from "../../hooks/web3/useRegisteredOwners";

/**
 * OwnerRegistrationView Component
 *
 * Form to register the connected wallet as an owner with a display name.
 * Follows the same TxState pattern as the Register Pet dialog in PetsOverviewView.
 */
export function OwnerRegistrationView() {
  const { registerOwner, txState } = useRegisterOwner();
  const { refetch } = useRegisteredOwners();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  /**
   * On success, refetch on-chain owners so OwnerPage can switch to the dashboard.
   * Do not reset hasSubmitted here — that re-shows the form before the parent re-renders.
   */
  useEffect(() => {
    if (txState.status === "success" && hasSubmitted) {
      void refetch();
      queryClient.invalidateQueries({ queryKey: REGISTERED_OWNERS_QUERY_KEY });
    }
  }, [txState.status, hasSubmitted, queryClient, refetch]);

  const validate = (): boolean => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      setError("Name must be between 2 and 32 characters");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setHasSubmitted(true);
    registerOwner(name.trim());
  };

  const handleRetry = () => {
    setHasSubmitted(true);
    if (!validate()) {
      setHasSubmitted(false);
      return;
    }
    registerOwner(name.trim());
  };

  /** Render the registration form */
  const renderForm = () => (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label" htmlFor="owner-name">
          Owner Name
        </label>
        <input
          id="owner-name"
          type="text"
          className={`form-input ${error ? "error" : ""}`}
          placeholder="Enter your name (2-32 characters)"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          minLength={2}
          maxLength={32}
        />
        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="dialog-actions" style={{ marginTop: "1.5rem" }}>
        <button type="submit" className="btn-primary">
          Register as Owner
        </button>
      </div>
    </form>
  );

  /** Render transaction feedback UI based on current state */
  const renderTxFeedback = () => {
    switch (txState.status) {
      case "idle":
      case "pending":
        return (
          <div className="tx-feedback">
            <div className="spinner" />
            <p>Confirm transaction in MetaMask...</p>
          </div>
        );
      case "processing":
        return (
          <div className="tx-feedback">
            <div className="spinner" />
            <p>Transaction processing...</p>
          </div>
        );
      case "success":
        return (
          <div className="tx-feedback">
            <p>Owner registered successfully!</p>
            <p style={{ marginTop: "0.5rem" }}>Loading your dashboard...</p>
          </div>
        );
      case "error":
        return (
          <div className="tx-feedback">
            <p className="tx-error">Error: {txState.error.message}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleRetry}
              style={{ marginTop: "1rem" }}
            >
              Try Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="main-content">
      <div className="page-header">
        <h1 className="page-title">Owner Registration</h1>
      </div>
      <p className="pet-detail" style={{ marginBottom: "1.5rem" }}>
        Register yourself as a pet owner to view your pets and manage appointments.
      </p>

      <div style={{ maxWidth: "480px" }}>
        {!hasSubmitted ? renderForm() : renderTxFeedback()}
      </div>
    </main>
  );
}
