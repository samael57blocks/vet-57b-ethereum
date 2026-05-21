import type { MedicalAppointment } from "../types/medicalAppointment";
import { MockAppointmentService } from "./mock/appointmentService";
import { Web3AppointmentService } from "./web3/appointmentService";
import { apiClient } from "../../config/axios";

/**
 * Defines the behavior an AppointmentService implementation must follow.
 */
export interface IAppointmentService {
    /**
     * Gets all appointments for a given pet.
     * @param petId - The pet's ID
     * @returns A promise that resolves to an array of medical appointments.
     */
    getAppointments: (petId: string) => Promise<MedicalAppointment[]>;
}

// ---------------------------------------------------------------------------
// Axios AppointmentService — reads from the Go backend REST API
// ---------------------------------------------------------------------------

/** Shape of an appointment returned by the backend. */
interface AppointmentResponse {
    id: number;
    petId: number;
    date: number; // unix timestamp (seconds)
    time: string;
    appointmentValue: string; // NUMERIC(78,0) as string
    paidValue: string; // NUMERIC(78,0) as string
    createdAt: string;
}

/** Shape of the paginated API response. */
interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

/**
 * Implementation of AppointmentService that reads from the backend indexer
 * REST API. Called when VITE_USE_MOCK_DATA is not "true".
 */
export const AxiosAppointmentService: IAppointmentService = {
    getAppointments: async (petId: string): Promise<MedicalAppointment[]> => {
        const response = await apiClient.get<PaginatedResponse<AppointmentResponse>>(
            `/api/v1/pets/${petId}/appointments`,
        );

        return response.data.data.map((a) => ({
            id: a.id.toString(),
            petId: a.petId.toString(),
            date: new Date(a.date * 1000),
            time: a.time,
            appointmentValue: Number(a.appointmentValue),
            paidValue: Number(a.paidValue),
        }));
    },
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * AppointmentService factory.
 * - VITE_USE_MOCK_DATA=true → MockAppointmentService (hardcoded data)
 * - VITE_USE_MOCK_DATA=false → AxiosAppointmentService (reads from Go backend)
 * - (unset) → AxiosAppointmentService (same as false — default to backend)
 */
export const AppointmentService: IAppointmentService =
    import.meta.env.VITE_USE_MOCK_DATA === "true"
        ? MockAppointmentService
        : AxiosAppointmentService;
