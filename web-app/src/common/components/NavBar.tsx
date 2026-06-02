import { useAccount, useConnect, useDisconnect } from "wagmi";
import { metaMask } from "wagmi/connectors";

function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
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
    <button className="btn-connect" onClick={() => connect({ connector: metaMask() })}>
      Connect Wallet
    </button>
  );
}

function NavBar() {
  return (
    <nav className="navigation-bar">
      <a href="/">Pets</a>
      <a href="/appointments">Appointments</a>
      <div className="nav-right">
        <ConnectWallet />
      </div>
    </nav>
  );
}

export default NavBar;
