import { type ReactNode } from "react";
import { WagmiProvider, http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { localhost } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

/**
 * Custom getProvider that explicitly validates MetaMask.
 * This avoids Phantom or other wallets that override window.ethereum.
 */
function getMetaMaskProvider() {
  if (typeof window === "undefined") return undefined;
  // EIP-1193: check if window.ethereum is actually MetaMask
  if ((window as any).ethereum?.isMetaMask) {
    return (window as any).ethereum;
  }
  // If MetaMask isn't the active provider, return undefined
  // wagmi will show "No wallet found" instead of connecting to Phantom
  return undefined;
}

/**
 * Wagmi configuration for local Hardhat network.
 * Uses injected connector with explicit MetaMask provider detection.
 * Replace with mainnet/testnet config for production.
 */
const wagmiConfig = createConfig({
  chains: [localhost],
  connectors: [
    injected({
      target: "metaMask",
      getProvider: getMetaMaskProvider,
    }),
  ],
  transports: {
    [localhost.id]: http("http://127.0.0.1:8545"),
  },
});

const queryClient = new QueryClient();

/**
 * Web3Provider wraps the application with wagmi and TanStack Query providers.
 * Must be rendered at the root level of the app.
 */
export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
