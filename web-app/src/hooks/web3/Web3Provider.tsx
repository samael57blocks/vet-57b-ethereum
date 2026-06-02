import { type ReactNode } from "react";
import { WagmiProvider, http, createConfig } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { localhost } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

/**
 * Wagmi configuration for local Hardhat network.
 * Uses explicit MetaMask connector to avoid Phantom conflicts.
 * Replace with mainnet/testnet config for production.
 */
const wagmiConfig = createConfig({
  chains: [localhost],
  connectors: [metaMask()],
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
