import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useIsVet } from "../../hooks/web3/useIsVet";

function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="wallet-info">
        <span className="wallet-address">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button className="btn-connect" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      className="btn-connect"
      onClick={() => connect({ connector: connectors[0] })}
    >
      Connect Wallet
    </button>
  );
}

function NavBar() {
  const { isConnected } = useAccount();
  const { isVet, isLoading } = useIsVet();

  const showVetLinks = isConnected && !isLoading && isVet;
  const showOwnerLink = isConnected && !isLoading && !isVet;

  return (
    <nav className="navigation-bar">
      {showVetLinks && (
        <>
          <a href="/">Pets</a>
          <a href="/appointments">Appointments</a>
        </>
      )}
      {showOwnerLink && <a href="/owner">My Pets</a>}
      <div className="nav-right">
        <ConnectWallet />
      </div>
    </nav>
  );
}

export default NavBar;
