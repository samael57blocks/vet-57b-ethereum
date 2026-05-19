/**
 * VetRegistry contract configuration for wagmi + viem.
 *
 * The ABI is auto-generated from the Hardhat compilation output.
 * Update VITE_CONTRACT_ADDRESS in .env with the deployed contract address.
 */

export const VET_REGISTRY_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000";

export const vetRegistryABI = [
  {
    type: "event",
    name: "MedicalAppointmentCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "petId", type: "uint256", indexed: true },
      { name: "date", type: "uint256", indexed: false },
      { name: "time", type: "string", indexed: false },
      { name: "appointmentValue", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MedicalRecordCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "age", type: "uint8", indexed: false },
      { name: "animalType", type: "uint8", indexed: false },
      { name: "caretakerName", type: "string", indexed: false },
      { name: "caretakerPhone", type: "string", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getMedicalRecord",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "age", type: "uint8" },
          { name: "animalType", type: "uint8" },
          { name: "caretakerName", type: "string" },
          { name: "caretakerPhone", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPetCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerPet",
    inputs: [
      { name: "name", type: "string" },
      { name: "age", type: "uint8" },
      { name: "animalType", type: "uint8" },
      { name: "caretakerName", type: "string" },
      { name: "caretakerPhone", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "scheduleAppointment",
    inputs: [
      { name: "petId", type: "uint256" },
      { name: "date", type: "uint256" },
      { name: "time", type: "string" },
      { name: "appointmentValue", type: "uint256" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAppointment",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "petId", type: "uint256" },
          { name: "date", type: "uint256" },
          { name: "time", type: "string" },
          { name: "appointmentValue", type: "uint256" },
          { name: "paidValue", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPetAppointments",
    inputs: [{ name: "petId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAppointmentCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
