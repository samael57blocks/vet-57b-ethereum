import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useIsVet } from "../../hooks/web3/useIsVet";

export type GuardRole = "vet" | "owner";

interface RoleGuardProps {
  allow: GuardRole;
  children: ReactNode;
}

/**
 * Restricts routes by wallet role. Vets may not access owner routes; non-vets may not access vet routes.
 */
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { isConnected } = useAccount();
  const { isVet, isLoading } = useIsVet();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !isConnected) return;
    if (allow === "vet" && !isVet) {
      navigate("/owner", { replace: true });
    }
    if (allow === "owner" && isVet) {
      navigate("/", { replace: true });
    }
  }, [allow, isConnected, isVet, isLoading, navigate]);

  if (!isConnected) {
    return (
      <main className="main-content">
        <p className="wallet-guard">Connect your wallet to continue.</p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="main-content">
        <p>Loading...</p>
      </main>
    );
  }

  if (allow === "vet" && !isVet) {
    return null;
  }

  if (allow === "owner" && isVet) {
    return null;
  }

  return <>{children}</>;
}
