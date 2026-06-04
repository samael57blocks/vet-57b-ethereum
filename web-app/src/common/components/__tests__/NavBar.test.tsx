import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NavBar from "../NavBar";

let mockIsConnected = true;
let mockIsVet = false;
let mockIsVetLoading = false;

vi.mock("wagmi", () => ({
  useAccount: () => ({
    isConnected: mockIsConnected,
    address: "0x1234567890123456789012345678901234567890",
  }),
  useConnect: () => ({ connect: vi.fn(), connectors: [{ id: "mock" }] }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));

vi.mock("../../../hooks/web3/useIsVet", () => ({
  useIsVet: () => ({ isVet: mockIsVet, isLoading: mockIsVetLoading }),
}));

describe("NavBar", () => {
  beforeEach(() => {
    mockIsConnected = true;
    mockIsVet = false;
    mockIsVetLoading = false;
  });

  it("shows Pets and Appointments for vet wallet", () => {
    mockIsVet = true;
    render(<NavBar />);
    expect(screen.getByRole("link", { name: "Pets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Appointments" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Pets" })).not.toBeInTheDocument();
  });

  it("shows My Pets only for connected non-vet (owner)", () => {
    mockIsVet = false;
    render(<NavBar />);
    expect(screen.getByRole("link", { name: "My Pets" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Appointments" })).not.toBeInTheDocument();
  });

  it("hides role links when disconnected", () => {
    mockIsConnected = false;
    render(<NavBar />);
    expect(screen.queryByRole("link", { name: "Pets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Pets" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeInTheDocument();
  });
});
