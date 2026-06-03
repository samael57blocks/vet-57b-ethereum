import { useAccount } from "wagmi";
import { useRegisteredOwners } from "../../hooks/web3/useRegisteredOwners";
import { OwnerRegistrationView } from "../views/OwnerRegistrationView";
import { OwnerDashboardView } from "../views/OwnerDashboardView";

/**
 * OwnerPage Component
 *
 * Guard page that decides what to show based on the connected wallet:
 * - Not connected → "Connect your wallet" message
 * - Connected but not registered → OwnerRegistrationView
 * - Connected and registered → OwnerDashboardView
 */
export function OwnerPage() {
  const { isConnected, address } = useAccount();
  const { data: owners, isLoading, error } = useRegisteredOwners();

  // Not connected
  if (!isConnected) {
    return (
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">My Pets</h1>
        </div>
        <p className="wallet-guard">Connect your wallet to view your pets and appointments.</p>
      </main>
    );
  }

  // Loading owners list
  if (isLoading) {
    return (
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">My Pets</h1>
        </div>
        <p>Loading...</p>
      </main>
    );
  }

  // Error loading owners
  if (error) {
    return (
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">My Pets</h1>
        </div>
        <p className="tx-error">Error: {(error as Error).message}</p>
      </main>
    );
  }

  // Check if the connected wallet is registered
  const isRegistered = owners.some(
    (o) => o.address.toLowerCase() === address?.toLowerCase(),
  );

  if (isRegistered && address) {
    return <OwnerDashboardView ownerAddress={address as `0x${string}`} />;
  }

  return <OwnerRegistrationView />;
}
