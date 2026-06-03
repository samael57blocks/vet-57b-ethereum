#!/usr/bin/env node
/**
 * generate-abi.mjs
 *
 * Reads the compiled VetRegistry artifact and generates
 * web-app/src/hooks/web3/abis.ts with the type-safe ABI.
 *
 * Usage:  node scripts/generate-abi.mjs
 *         (run after every `npx hardhat compile`)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const artifactPath = resolve(
  ROOT,
  "artifacts/contracts/VetRegistry.sol/VetRegistry.json",
);

const outPath = resolve(
  ROOT,
  "web-app/src/hooks/web3/abis.ts",
);

// ── Read artifact ──────────────────────────────────────────────
let artifact;
try {
  artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
} catch {
  console.error("❌  VetRegistry artifact not found. Run 'npx hardhat compile' first.");
  process.exit(1);
}

// ── Generate ABI ───────────────────────────────────────────────
const vetRegistryABI = artifact.abi
  .filter((entry) => entry.type !== "constructor" && entry.type !== "fallback");

const output = `/**
 * abis.ts — AUTO-GENERATED from compiled artifacts.
 * Do NOT edit manually. Run \`node scripts/generate-abi.mjs\` to regenerate.
 */

export const vetRegistryABI = ${JSON.stringify(vetRegistryABI, null, 2)} as const;
`;

writeFileSync(outPath, output, "utf-8");
console.log(`✅  Generated ${outPath} (${vetRegistryABI.length} ABI entries)`);
