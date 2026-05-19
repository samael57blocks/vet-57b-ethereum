/**
 * A medical appointment for a Pet in the 57B Vet.
 */
export interface MedicalAppointment {
    /** The ID of the medical appointment */
    id: string;
    /** The ID of the pet */
    petId: string;
    /** The date of the appointment */
    date: Date;
    /** The time of the appointment */
    time: string;
    /** The value of the appointment (in dollar cents) */
    appointmentValue: number;
    /** The paid value for the appointment (in dollar cents) */
    paidValue: number;
};
