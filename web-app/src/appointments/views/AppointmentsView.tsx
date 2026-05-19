import { useState, useEffect } from "react";
import { useConnect } from "wagmi";
import type { Pet } from "../../pets/types/pet";
import type { MedicalAppointment } from "../types/medicalAppointment";
import { useScheduleAppointment } from "../../hooks/web3/useAppointments";
import { APPOINTMENTS_QUERY_KEY } from "../hooks/useAppointments";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Props for the AppointmentsView component.
 */
interface AppointmentsViewProps {
    isConnected: boolean;
    pets: Pet[];
    selectedPetId: string | null;
    onSelectPet: (petId: string | null) => void;
    appointments: MedicalAppointment[];
    loading: boolean;
    error: string | null;
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
 * AppointmentCard — displays a single appointment's date, time, value, and paid status.
 */
function AppointmentCard({ appointment }: { appointment: MedicalAppointment }) {
    const isPaid = appointment.paidValue > 0;

    return (
        <div className="pet-card">
            <div className="pet-info">
                <p className="pet-name">{formatDate(appointment.date)}</p>
                <p className="pet-detail">Time: {appointment.time}</p>
                <p className="pet-detail">Value: {formatDollars(appointment.appointmentValue)}</p>
                <p className="pet-detail">
                    Status:{" "}
                    <span className={isPaid ? "status-paid" : "status-pending"}>
                        {isPaid ? "Paid" : "Pending"}
                    </span>
                </p>
            </div>
        </div>
    );
}

/**
 * ScheduleDialog — modal with form + tx feedback for scheduling appointments.
 */
function ScheduleDialog({
    selectedPetId,
    pets,
    onClose,
}: {
    selectedPetId: string | null;
    pets: Pet[];
    onClose: () => void;
}) {
    const { scheduleAppointment, txState, reset } = useScheduleAppointment();
    const queryClient = useQueryClient();
    const [hasSubmitted, setHasSubmitted] = useState(false);

    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [value, setValue] = useState("");
    const [errors, setErrors] = useState<{ date?: string; time?: string; value?: string }>({});

    const today = new Date().toISOString().split("T")[0];
    const selectedPet = pets.find((p) => p.id === selectedPetId);

    /** Watch for successful transaction → invalidate + close */
    useEffect(() => {
        if (txState.status === "success" && hasSubmitted) {
            queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
            setHasSubmitted(false);
            // Auto-close after 2 seconds
            const timer = setTimeout(() => {
                reset();
                onClose();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [txState.status, hasSubmitted, queryClient, reset, onClose]);

    /** Reset all form state */
    const resetForm = () => {
        setDate("");
        setTime("");
        setValue("");
        setErrors({});
        setHasSubmitted(false);
        reset();
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const validate = (): boolean => {
        const newErrors: { date?: string; time?: string; value?: string } = {};

        if (!date) {
            newErrors.date = "Date is required";
        } else if (date < today) {
            newErrors.date = "Date must be today or later";
        }

        if (!time) {
            newErrors.time = "Time is required";
        }

        const valueNum = parseFloat(value);
        if (!value || isNaN(valueNum) || valueNum <= 0) {
            newErrors.value = "Value must be greater than 0";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPetId) return;
        if (!validate()) return;

        const dateObj = new Date(`${date}T${time}:00`);
        const unixTimestamp = BigInt(Math.floor(dateObj.getTime() / 1000));
        const valueInCents = BigInt(Math.round(parseFloat(value) * 100));

        setHasSubmitted(true);
        scheduleAppointment(BigInt(selectedPetId), unixTimestamp, time, valueInCents);
    };

    /** Render the appointment form */
    const renderForm = () => (
        <form onSubmit={handleSubmit}>
            <div className="form-group">
                <label className="form-label" htmlFor="appointment-pet">
                    Pet
                </label>
                <input
                    id="appointment-pet"
                    type="text"
                    className="form-input"
                    value={selectedPet ? selectedPet.name : "No pet selected"}
                    readOnly
                    disabled
                />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="appointment-date">
                    Date
                </label>
                <input
                    id="appointment-date"
                    type="date"
                    className={`form-input ${errors.date ? "error" : ""}`}
                    value={date}
                    onChange={(e) => {
                        setDate(e.target.value);
                        if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
                    }}
                    min={today}
                />
                {errors.date && <p className="form-error">{errors.date}</p>}
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="appointment-time">
                    Time
                </label>
                <input
                    id="appointment-time"
                    type="time"
                    className={`form-input ${errors.time ? "error" : ""}`}
                    value={time}
                    onChange={(e) => {
                        setTime(e.target.value);
                        if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
                    }}
                />
                {errors.time && <p className="form-error">{errors.time}</p>}
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="appointment-value">
                    Value ($)
                </label>
                <input
                    id="appointment-value"
                    type="number"
                    className={`form-input ${errors.value ? "error" : ""}`}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        if (errors.value) setErrors((prev) => ({ ...prev, value: undefined }));
                    }}
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                />
                {errors.value && <p className="form-error">{errors.value}</p>}
            </div>

            <div className="dialog-actions">
                <button type="button" className="btn-secondary" onClick={handleClose}>
                    Cancel
                </button>
                <button type="submit" className="btn-primary">
                    Schedule Appointment
                </button>
            </div>
        </form>
    );

    /** Render transaction feedback based on current txState */
    const renderTxFeedback = () => {
        switch (txState.status) {
            case "idle":
            case "pending":
                return (
                    <div className="tx-feedback">
                        <div className="spinner" />
                        <p>Confirm in MetaMask...</p>
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
                        <p>Appointment scheduled!</p>
                    </div>
                );
            case "error":
                return (
                    <div className="tx-feedback">
                        <p className="tx-error">Error: {txState.error.message}</p>
                        <button className="btn-primary" onClick={handleSubmit}>
                            Try Again
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="dialog-overlay" onClick={handleClose}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
                <h2 className="dialog-title">Schedule Appointment</h2>
                {!hasSubmitted && txState.status !== "success"
                    ? renderForm()
                    : renderTxFeedback()}
            </div>
        </div>
    );
}

/**
 * AppointmentsView Component
 * Displays appointments for a selected pet with wallet guard, pet selector,
 * appointment list, and a schedule dialog.
 */
export function AppointmentsView({
    isConnected,
    pets,
    selectedPetId,
    onSelectPet,
    appointments,
    loading,
    error,
}: AppointmentsViewProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <main className="main-content">
            <div className="page-header">
                <h1 className="page-title">Appointments</h1>
                {isConnected ? (
                    <button
                        className="btn-primary"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        Schedule Appointment
                    </button>
                ) : (
                    <p className="wallet-guard">Connect your wallet to view appointments</p>
                )}
            </div>

            {/* Pet selector — visible when connected */}
            {isConnected && (
                <div className="form-group" style={{ maxWidth: "400px", marginBottom: "1.5rem" }}>
                    <label className="form-label" htmlFor="pet-selector">
                        Select Pet
                    </label>
                    <select
                        id="pet-selector"
                        className="form-input"
                        value={selectedPetId ?? ""}
                        onChange={(e) => onSelectPet(e.target.value || null)}
                    >
                        <option value="">-- Select a pet --</option>
                        {pets.map((pet) => (
                            <option key={pet.id} value={pet.id}>
                                {pet.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Loading state */}
            {loading && <p>Loading appointments...</p>}

            {/* Error state */}
            {error && <p className="tx-error">Error: {error}</p>}

            {/* Empty state */}
            {!loading && !error && selectedPetId && appointments.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <p className="empty-state-text">No appointments scheduled</p>
                </div>
            )}

            {/* Appointment list */}
            {!loading && !error && appointments.length > 0 && (
                <div className="pets-grid">
                    {appointments.map((appt) => (
                        <AppointmentCard key={appt.id} appointment={appt} />
                    ))}
                </div>
            )}

            {/* No pet selected prompt */}
            {!loading && !error && isConnected && !selectedPetId && (
                <p className="pet-detail">Select a pet to view appointments</p>
            )}

            {/* Schedule dialog */}
            {isDialogOpen && (
                <ScheduleDialog
                    selectedPetId={selectedPetId}
                    pets={pets}
                    onClose={() => {
                        setIsDialogOpen(false);
                    }}
                />
            )}
        </main>
    );
}
