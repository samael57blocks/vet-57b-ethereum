import { useQuery } from "@tanstack/react-query";
import { AppointmentService } from "../services/appointmentService";
import type { MedicalAppointment } from "../types/medicalAppointment";

/**
 * Query key prefix for appointments — importable for cache invalidation.
 */
export const APPOINTMENTS_QUERY_KEY = ["vetRegistry", "appointments"] as const;

/**
 * Hook to fetch appointments for a given pet using TanStack Query.
 *
 * Query is enabled only when petId is truthy.
 * Data source is determined by the AppointmentService factory:
 * - VITE_USE_MOCK_DATA=true → MockAppointmentService
 * - VITE_USE_MOCK_DATA=false → Web3AppointmentService (reads from Ethereum contract)
 */
export function useAppointments(petId: string | null) {
    return useQuery<MedicalAppointment[], Error>({
        queryKey: [...APPOINTMENTS_QUERY_KEY, { petId }],
        queryFn: () => AppointmentService.getAppointments(petId!),
        enabled: !!petId,
    });
}
