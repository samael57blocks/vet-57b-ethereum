import { useAccount } from "wagmi";
import { useIsRegisteredOwner } from "../../hooks/web3/useIsRegisteredOwner";
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
  const { isRegisteredOwner, isLoading, error } = useIsRegisteredOwner();

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

  if (error) {
    return (
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">My Pets</h1>
        </div>
        <p className="tx-error">Error: {error.message}</p>
      </main>
    );
  }

  if (isRegisteredOwner && address) {
    return <OwnerDashboardView ownerAddress={address as `0x${string}`} />;
  }

  return <OwnerRegistrationView />;
}
