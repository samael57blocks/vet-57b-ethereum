import type { MedicalAppointment } from "../../types/medicalAppointment";
import type { IAppointmentService } from "../appointmentService";

/**
 * Implementation of the AppointmentService using mock data.
 */
export const MockAppointmentService: IAppointmentService = {
    getAppointments: async (petId: string): Promise<MedicalAppointment[]> => {
        return [
            { id: "1", petId, date: new Date("2026-06-01"), time: "10:00", appointmentValue: 5000, paidValue: 0 },
            { id: "2", petId, date: new Date("2026-06-15"), time: "14:30", appointmentValue: 7500, paidValue: 7500 },
        ];
    },
};
