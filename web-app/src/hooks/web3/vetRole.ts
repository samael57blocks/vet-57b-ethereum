import { keccak256, toBytes } from "viem";

/** Matches VetRegistry `VET_ROLE = keccak256("VET_ROLE")`. */
export const VET_ROLE = keccak256(toBytes("VET_ROLE"));
