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
  {
    type: "function",
    name: "payAppointmentToken",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "token", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "payAppointmentEth",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "priceFeed", type: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "withdrawEth",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AppointmentPaidEth",
    inputs: [
      { name: "appointmentId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "ethAmount", type: "uint256", indexed: false },
      { name: "usdCents", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "withdrawToken",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

/**
 * Minimal ERC-20 ABI for USDC interactions.
 * Only includes functions needed by the payment flow.
 */
export const erc20ABI = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

/**
 * Minimal AggregatorV3Interface ABI for reading ETH/USD price from MockPriceFeed.
 */
export const priceFeedABI = [
  {
    type: "function",
    name: "latestRoundData",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
  },
] as const;

/**
 * USDC token address from environment.
 * Set VITE_USDC_ADDRESS in .env with the deployed USDC address for the target network.
 */
export const USDC_ADDRESS =
  import.meta.env.VITE_USDC_ADDRESS as `0x${string}` | undefined;

/**
 * MockPriceFeed address for ETH/USD price conversion.
 * Set VITE_PRICE_FEED_ADDRESS in .env with the deployed MockPriceFeed address.
 * When undefined, the ETH payment option is hidden in the UI.
 */
export const PRICE_FEED_ADDRESS =
  import.meta.env.VITE_PRICE_FEED_ADDRESS as `0x${string}` | undefined;
