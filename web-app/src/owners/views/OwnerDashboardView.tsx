import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePetsByOwner } from "../../hooks/web3/usePetsByOwner";
import { useAppointments } from "../../appointments/hooks/useAppointments";
import { PayAppointmentModal } from "../../appointments/components/PayAppointmentModal";
import { APPOINTMENTS_QUERY_KEY } from "../../appointments/hooks/useAppointments";

/**
 * Props for the OwnerDashboardView component.
 */
interface OwnerDashboardViewProps {
  /** The connected wallet address */
  ownerAddress: `0x${string}`;
}

/** Formats cents to dollar string, e.g., 5000 → "$50.00" */
function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Formats a Date to a human-readable string */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * OwnerDashboardView Component
 *
 * Shows the connected owner's pets and their unpaid appointments.
 * Reuses PayAppointmentModal from appointments/components/.
 */
export function OwnerDashboardView({ ownerAddress }: OwnerDashboardViewProps) {
  const queryClient = useQueryClient();
  const { data: petIds, isLoading: petsLoading, error: petsError, refetch: refetchPets } = usePetsByOwner(ownerAddress);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [payingAppointmentId, setPayingAppointmentId] = useState<string | null>(null);

  const petIdStrings: string[] = petIds
    ? (petIds as bigint[]).map((id) => id.toString())
    : [];

  // Auto-select the first pet when data loads and no selection exists
  useEffect(() => {
    if (petIdStrings.length > 0 && !selectedPetId) {
      setSelectedPetId(petIdStrings[0]);
    }
    if (petIdStrings.length === 0) {
      setSelectedPetId(null);
    }
  }, [petIdStrings.length, selectedPetId]);

  const {
    data: appointments = [],
    isLoading: apptLoading,
    error: apptError,
  } = useAppointments(selectedPetId);

  const unpaidAppointments = appointments.filter((a) => a.paidValue === 0);

  /** Find the appointment being paid so we can pass its value to the modal */
  const payingAppointment = payingAppointmentId
    ? appointments.find((a) => a.id === payingAppointmentId)
    : undefined;

  const handlePaySuccess = () => {
    queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
    setPayingAppointmentId(null);
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <main className="main-content">
      <div className="page-header">
        <h1 className="page-title">My Pets</h1>
      </div>

      {/* Loading state */}
      {petsLoading && <p>Loading your pets...</p>}

      {/* Error state */}
      {petsError && (
        <div className="tx-feedback">
          <p className="tx-error">Error loading pets: {petsError.message}</p>
          <button className="btn-primary" onClick={() => refetchPets()} style={{ marginTop: "0.5rem" }}>
            Retry
          </button>
        </div>
      )}

      {/* No pets */}
      {!petsLoading && !petsError && petIdStrings.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🐾</div>
          <p className="empty-state-text">You don't have any registered pets yet</p>
        </div>
      )}

      {/* Pets count and pet selector */}
      {!petsLoading && petIdStrings.length > 0 && (
        <>
          <p style={{ marginBottom: "1rem" }}>
            You have <strong>{petIdStrings.length}</strong> registered pet{petIdStrings.length !== 1 ? "s" : ""}.
          </p>

          {petIdStrings.length > 1 && (
            <div className="form-group" style={{ maxWidth: "400px", marginBottom: "1.5rem" }}>
              <label className="form-label" htmlFor="owner-pet-selector">
                Select Pet
              </label>
              <select
                id="owner-pet-selector"
                className="form-input"
                value={selectedPetId ?? ""}
                onChange={(e) => setSelectedPetId(e.target.value || null)}
              >
                {petIdStrings.map((id) => (
                  <option key={id} value={id}>
                    Pet #{id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Appointments section */}
          <h2 className="page-title" style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
            {petIdStrings.length > 1
              ? `Appointments for Pet #${selectedPetId}`
              : "Appointments"}
          </h2>

          {apptLoading && <p>Loading appointments...</p>}

          {apptError && <p className="tx-error">Error: {apptError.message}</p>}

          {!apptLoading && !apptError && selectedPetId && unpaidAppointments.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <p className="empty-state-text">No unpaid appointments</p>
            </div>
          )}

          {!apptLoading && !apptError && unpaidAppointments.length > 0 && (
            <div className="pets-grid">
              {unpaidAppointments.map((appt) => (
                <div className="appointment-card" key={appt.id}>
                  <div className="appointment-card-header">
                    <p className="appointment-card-date">{formatDate(appt.date)}</p>
                  </div>
                  <div className="appointment-card-body">
                    <p className="appointment-card-detail">
                      <span className="appointment-card-detail-label">Time</span>
                      <span className="appointment-card-value">{appt.time}</span>
                    </p>
                    <p className="appointment-card-detail">
                      <span className="appointment-card-detail-label">Value</span>
                      <span className="appointment-card-value">{formatDollars(appt.appointmentValue)}</span>
                    </p>
                    <p className="appointment-card-detail">
                      <span className="appointment-card-detail-label">Status</span>
                      <span className="appointment-card-status appointment-card-status--pending">
                        Unpaid
                      </span>
                    </p>
                    <button
                      className="btn-primary"
                      onClick={() => setPayingAppointmentId(appt.id)}
                      style={{ marginTop: "0.75rem" }}
                    >
                      Pay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!apptLoading && !apptError && !selectedPetId && (
            <p className="pet-detail">Select a pet to view appointments.</p>
          )}
        </>
      )}

      {/* Pay appointment modal */}
      {payingAppointment && (
        <PayAppointmentModal
          appointmentId={BigInt(payingAppointment.id)}
          amountInCents={payingAppointment.appointmentValue}
          onClose={() => setPayingAppointmentId(null)}
          onSuccess={handlePaySuccess}
        />
      )}
    </main>
  );
}
