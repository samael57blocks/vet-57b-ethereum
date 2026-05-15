import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VET_REGISTRY_ADDRESS, vetRegistryABI } from "./contract";

/**
 * Hook to schedule a medical appointment for a pet.
 */
export function useScheduleAppointment() {
  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  /**
   * Schedules an appointment for a given pet.
   * @param petId - The pet's on-chain ID
   * @param date - Unix timestamp for the appointment date
   * @param time - Time string (e.g. "10:30")
   * @param appointmentValue - Cost in dollar cents
   */
  const scheduleAppointment = (
    petId: bigint,
    date: bigint,
    time: string,
    appointmentValue: bigint
  ) => {
    writeContract({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "scheduleAppointment",
      args: [petId, date, time, appointmentValue],
    });
  };

  return {
    scheduleAppointment,
    isPending,
    isConfirming,
    isConfirmed,
    txHash,
    error: writeError,
  };
}

/**
 * Placeholder hook to watch MedicalAppointmentCreated events.
 * Future enhancement: use useWatchContractEvent for real-time updates.
 */
export function useAppointments() {
  // This would use useWatchContractEvent in a production app
  return {
    appointments: [] as unknown[],
    isLoading: false,
  };
}
