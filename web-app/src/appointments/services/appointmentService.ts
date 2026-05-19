import type { MedicalAppointment } from "../types/medicalAppointment";
import { MockAppointmentService } from "./mock/appointmentService";
import { Web3AppointmentService } from "./web3/appointmentService";

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

/**
 * AppointmentService factory.
 * - VITE_USE_MOCK_DATA=true → MockAppointmentService (hardcoded data)
 * - VITE_USE_MOCK_DATA=false → Web3AppointmentService (reads from Ethereum contract)
 */
export const AppointmentService: IAppointmentService =
    import.meta.env.VITE_USE_MOCK_DATA === "true"
        ? MockAppointmentService
        : Web3AppointmentService;
