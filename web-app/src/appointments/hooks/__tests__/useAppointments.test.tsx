import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppointments } from "../useAppointments";
import type { MedicalAppointment } from "../../types/medicalAppointment";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAppointments = vi.fn();

vi.mock("../../services/appointmentService", () => ({
    AppointmentService: {
        getAppointments: (...args: Parameters<typeof mockGetAppointments>) =>
            mockGetAppointments(...args),
    },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    };
}

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
// Tests
// ---------------------------------------------------------------------------

describe("useAppointments", () => {
    beforeEach(() => {
        mockGetAppointments.mockReset();
    });

    it("returns loading state initially", () => {
        mockGetAppointments.mockReturnValue(new Promise(() => {})); // never resolves

        const { result } = renderHook(() => useAppointments("1"), {
            wrapper: createWrapper(),
        });

        expect(result.current.isLoading).toBe(true);
        expect(result.current.data).toBeUndefined();
        expect(result.current.error).toBeNull();
    });

    it("returns data after service resolves", async () => {
        mockGetAppointments.mockResolvedValue(sampleAppointments);

        const { result } = renderHook(() => useAppointments("1"), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data).toEqual(sampleAppointments);
        expect(result.current.error).toBeNull();
        expect(mockGetAppointments).toHaveBeenCalledWith("1");
    });

    it("is not enabled when petId is null", () => {
        mockGetAppointments.mockResolvedValue(sampleAppointments);

        const { result } = renderHook(() => useAppointments(null), {
            wrapper: createWrapper(),
        });

        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeUndefined();
        expect(mockGetAppointments).not.toHaveBeenCalled();
    });

    it("returns error when service rejects", async () => {
        const testError = new Error("Failed to fetch");
        mockGetAppointments.mockRejectedValue(testError);

        const { result } = renderHook(() => useAppointments("1"), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toBe("Failed to fetch");
        expect(result.current.data).toBeUndefined();
    });
});
