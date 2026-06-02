/**
 * VetRegistry contract configuration for wagmi + viem.
 *
 * The ABI is auto-generated from the compiled artifact.
 * Run \`node scripts/generate-abi.mjs\` (or \`./dev.sh\`) to regenerate.
 *
 * Update VITE_CONTRACT_ADDRESS in .env with the deployed contract address.
 */

import { vetRegistryABI } from "./abis";

export { vetRegistryABI };

export const VET_REGISTRY_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000";

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
