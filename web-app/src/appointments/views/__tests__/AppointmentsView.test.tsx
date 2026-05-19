import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppointmentsView } from "../AppointmentsView";
import type { Pet } from "../../../pets/types/pet";
import type { MedicalAppointment } from "../../types/medicalAppointment";
import { APPOINTMENTS_QUERY_KEY } from "../../hooks/useAppointments";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockIsConnected = true;

vi.mock("wagmi", () => ({
    useAccount: () => ({ isConnected: mockIsConnected }),
    useConnect: () => ({ connect: vi.fn(), connectors: [] }),
}));

let currentTxState: Record<string, unknown> = { status: "idle" };
const mockScheduleAppointment = vi.fn();
const mockReset = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("../../../hooks/web3/useAppointments", () => ({
    useScheduleAppointment: () => ({
        scheduleAppointment: mockScheduleAppointment,
        get txState() {
            return currentTxState;
        },
        reset: mockReset,
        txHash: undefined,
    }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}));

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

const samplePets: Pet[] = [
    { id: "1", name: "Boby", age: 3, animalType: "Dog", caretakerName: "John", caretakerPhone: "+56912345678" },
    { id: "2", name: "Luna", age: 2, animalType: "Cat", caretakerName: "Jane", caretakerPhone: "+56987654321" },
];

const sampleAppointments: MedicalAppointment[] = [
    {
        id: "1",
        petId: "1",
        date: new Date("2026-06-01"),
        time: "10:00",
        appointmentValue: 5000,
        paidValue: 0,
    },
    {
        id: "2",
        petId: "1",
        date: new Date("2026-06-15"),
        time: "14:30",
        appointmentValue: 7500,
        paidValue: 7500,
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Helper: open the Schedule dialog by clicking the header button,
 * then return the dialog's submit button (index 1 when dialog is open).
 */
function openDialogAndGetSubmit(): HTMLElement {
    const openBtn = screen.getByRole("button", { name: /schedule appointment/i });
    fireEvent.click(openBtn);
    const allBtns = screen.getAllByRole("button", { name: /schedule appointment/i });
    // Index 0 = header button, Index 1 = dialog submit button
    return allBtns[1];
}

function fillScheduleForm() {
    fireEvent.change(screen.getByLabelText("Date"), {
        target: { value: "2026-06-01" },
    });
    fireEvent.change(screen.getByLabelText("Time"), {
        target: { value: "10:30" },
    });
    fireEvent.change(screen.getByLabelText("Value ($)"), {
        target: { value: "50.00" },
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppointmentsView", () => {
    beforeEach(() => {
        mockIsConnected = true;
        currentTxState = { status: "idle" };
        mockScheduleAppointment.mockReset();
        mockReset.mockReset();
        mockInvalidateQueries.mockReset();
    });

    describe("Wallet Guard", () => {
        it("shows wallet guard message when disconnected", () => {
            mockIsConnected = false;
            render(
                <AppointmentsView
                    isConnected={false}
                    pets={[]}
                    selectedPetId={null}
                    onSelectPet={vi.fn()}
                    appointments={[]}
                    loading={false}
                    error={null}
                />
            );

            expect(
                screen.getByText("Connect your wallet to view appointments")
            ).toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: /schedule appointment/i })
            ).not.toBeInTheDocument();
        });

        it("shows Schedule Appointment button when connected", () => {
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId={null}
                    onSelectPet={vi.fn()}
                    appointments={[]}
                    loading={false}
                    error={null}
                />
            );

            expect(
                screen.getByRole("button", { name: /schedule appointment/i })
            ).toBeInTheDocument();
            expect(
                screen.queryByText("Connect your wallet to view appointments")
            ).not.toBeInTheDocument();
        });
    });

    describe("Pet Selector", () => {
        it("renders pet selector when connected", () => {
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId={null}
                    onSelectPet={vi.fn()}
                    appointments={[]}
                    loading={false}
                    error={null}
                />
            );

            expect(screen.getByLabelText("Select Pet")).toBeInTheDocument();
            expect(screen.getByText("-- Select a pet --")).toBeInTheDocument();
            expect(screen.getByText("Boby")).toBeInTheDocument();
            expect(screen.getByText("Luna")).toBeInTheDocument();
        });

        it("calls onSelectPet when a pet is selected", () => {
            const onSelectPet = vi.fn();
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId={null}
                    onSelectPet={onSelectPet}
                    appointments={[]}
                    loading={false}
                    error={null}
                />
            );

            fireEvent.change(screen.getByLabelText("Select Pet"), {
                target: { value: "1" },
            });
            expect(onSelectPet).toHaveBeenCalledWith("1");
        });
    });

    describe("Appointment List", () => {
        it("shows empty state when no appointments", () => {
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={[]}
                    loading={false}
                    error={null}
                />
            );

            expect(
                screen.getByText("No appointments scheduled")
            ).toBeInTheDocument();
        });

        it("shows appointment cards when appointments exist", () => {
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            // Verify date formatting (timezone-aware — match 2026)
            const dates = screen.getAllByText(/2026/);
            expect(dates.length).toBeGreaterThanOrEqual(2);

            // Verify time
            expect(screen.getByText("10:00")).toBeInTheDocument();
            expect(screen.getByText("14:30")).toBeInTheDocument();

            // Verify value formatting
            expect(screen.getByText("$50.00")).toBeInTheDocument();
            expect(screen.getByText("$75.00")).toBeInTheDocument();

            // Verify paid status
            expect(screen.getByText("Pending")).toBeInTheDocument();
            expect(screen.getByText("Paid")).toBeInTheDocument();
        });

        it("shows loading state", () => {
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={[]}
                    loading={true}
                    error={null}
                />
            );

            expect(screen.getByText("Loading appointments...")).toBeInTheDocument();
        });

        it("shows error state", () => {
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={[]}
                    loading={false}
                    error="Something went wrong"
                />
            );

            expect(screen.getByText("Error: Something went wrong")).toBeInTheDocument();
        });
    });

    describe("ScheduleDialog — Form Validation", () => {
        it("shows validation errors when submitting empty form", () => {
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={[]}
                    loading={false}
                    error={null}
                />
            );

            // Open dialog + get submit button inside it
            const submitBtn = openDialogAndGetSubmit();

            // Submit with empty form
            fireEvent.click(submitBtn);

            // Validation errors
            expect(screen.getByText("Date is required")).toBeInTheDocument();
            expect(screen.getByText("Time is required")).toBeInTheDocument();
            expect(screen.getByText("Value must be greater than 0")).toBeInTheDocument();

            // ScheduleAppointment should NOT have been called
            expect(mockScheduleAppointment).not.toHaveBeenCalled();
        });

        it("opens dialog showing selected pet name", () => {
            render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            // Open dialog
            fireEvent.click(screen.getByRole("button", { name: /schedule appointment/i }));

            // Should show selected pet name in readonly input (there's also the option in select)
            const bobyElements = screen.getAllByDisplayValue("Boby");
            expect(bobyElements.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("ScheduleDialog — Tx Feedback", () => {
        it("shows MetaMask confirmation message on pending", () => {
            const { rerender } = render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            // Open + fill + submit using the dialog's submit
            fireEvent.click(screen.getByRole("button", { name: /schedule appointment/i }));
            fillScheduleForm();
            const submitBtn = screen.getAllByRole("button", { name: /schedule appointment/i })[1];
            fireEvent.click(submitBtn);

            // Simulate pending
            currentTxState = { status: "pending" };
            rerender(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            expect(screen.getByText("Confirm in MetaMask...")).toBeInTheDocument();
        });

        it("shows processing state", () => {
            const { rerender } = render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            // Open + fill + submit
            fireEvent.click(screen.getByRole("button", { name: /schedule appointment/i }));
            fillScheduleForm();
            const submitBtn = screen.getAllByRole("button", { name: /schedule appointment/i })[1];
            fireEvent.click(submitBtn);

            // Simulate processing
            currentTxState = { status: "processing" };
            rerender(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            expect(screen.getByText("Transaction processing...")).toBeInTheDocument();
        });

        it("shows success on confirmation", () => {
            const { rerender } = render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            // Open + fill + submit
            fireEvent.click(screen.getByRole("button", { name: /schedule appointment/i }));
            fillScheduleForm();
            const submitBtn = screen.getAllByRole("button", { name: /schedule appointment/i })[1];
            fireEvent.click(submitBtn);

            // Simulate success
            currentTxState = { status: "success", txHash: "0xabc" };
            rerender(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            expect(screen.getByText("Appointment scheduled!")).toBeInTheDocument();
            expect(mockInvalidateQueries).toHaveBeenCalledWith({
                queryKey: APPOINTMENTS_QUERY_KEY,
            });
        });

        it("shows error on failure and allows retry", () => {
            const { rerender } = render(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            // Open + fill + submit
            fireEvent.click(screen.getByRole("button", { name: /schedule appointment/i }));
            fillScheduleForm();
            const submitBtn = screen.getAllByRole("button", { name: /schedule appointment/i })[1];
            fireEvent.click(submitBtn);

            // Clear any prior calls
            mockScheduleAppointment.mockClear();

            // Simulate error
            currentTxState = {
                status: "error",
                error: new Error("User rejected transaction"),
            };
            rerender(
                <AppointmentsView
                    isConnected={true}
                    pets={samplePets}
                    selectedPetId="1"
                    onSelectPet={vi.fn()}
                    appointments={sampleAppointments}
                    loading={false}
                    error={null}
                />
            );

            expect(
                screen.getByText("Error: User rejected transaction")
            ).toBeInTheDocument();

            // Click Try Again
            fireEvent.click(screen.getByRole("button", { name: /try again/i }));
            expect(mockScheduleAppointment).toHaveBeenCalledTimes(1);
        });
    });
});
