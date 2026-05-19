import type { MedicalAppointment } from "../../types/medicalAppointment";
import type { IAppointmentService } from "../appointmentService";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "../../../hooks/web3/contract";

/**
 * Web3 implementation of AppointmentService that reads directly from the VetRegistry contract.
 * Uses viem's public client (already available as a dependency).
 */
export const Web3AppointmentService: IAppointmentService = {
    getAppointments: async (petId: string): Promise<MedicalAppointment[]> => {
        const { createPublicClient, http } = await import("viem");
        const { localhost } = await import("viem/chains");

        const publicClient = createPublicClient({
            chain: localhost,
            transport: http("http://127.0.0.1:8545"),
        });

        // Get appointment IDs for this pet
        const appointmentIds = (await publicClient.readContract({
            address: VET_REGISTRY_ADDRESS,
            abi: vetRegistryABI,
            functionName: "getPetAppointments",
            args: [BigInt(petId)],
        })) as bigint[];

        if (appointmentIds.length === 0) return [];

        // Fetch full appointment struct for each ID
        const appointments: MedicalAppointment[] = [];
        for (const id of appointmentIds) {
            const record = await publicClient.readContract({
                address: VET_REGISTRY_ADDRESS,
                abi: vetRegistryABI,
                functionName: "getAppointment",
                args: [id],
            });

            const r = record as unknown as {
                petId: bigint;
                date: bigint;
                time: string;
                appointmentValue: bigint;
                paidValue: bigint;
            };

            appointments.push({
                id: id.toString(),
                petId: r.petId.toString(),
                date: new Date(Number(r.date) * 1000),
                time: r.time,
                appointmentValue: Number(r.appointmentValue),
                paidValue: Number(r.paidValue),
            });
        }

        return appointments;
    },
};
