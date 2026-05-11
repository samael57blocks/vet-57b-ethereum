import { PublicKey } from "@solana/web3.js";

/**
 * A medical appointment for a Pet in the 57B Vet.
 */
export type MedicalAppointment = {
  /** The ID of the medical appointment */
  id: PublicKey;
  /** The address of the pet's medical record account */
  medicalRecord: PublicKey;
  /** The date of the appointment */
  date: Date;
  /** The time of the appointment */
  time: string;
  /** The value of the appointment (in dollar cents) */
  appointmentValue: number;
  /** The paid value for the appointment (in dollar cents) */
  paidValue: number;
};

/**
 * The information required to create a new medical appointment.
 */
export type NewMedicalAppointment = {
  /** The ID of the medical appointment */
  id: PublicKey;
  /** The address of the pet's medical record account */
  medicalRecord: PublicKey;
  /** The date of the appointment */
  date: Date;
  /** The time of the appointment */
  time: string;
  /** The value of the appointment (in dollar cents) */
  appointmentValue: number;
};
