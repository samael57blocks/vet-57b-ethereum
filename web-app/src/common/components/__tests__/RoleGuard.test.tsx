import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RoleGuard } from "../RoleGuard";

let mockIsConnected = true;
let mockIsVet = false;
let mockIsVetLoading = false;
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: mockIsConnected }),
}));

vi.mock("../../../hooks/web3/useIsVet", () => ({
  useIsVet: () => ({ isVet: mockIsVet, isLoading: mockIsVetLoading }),
}));

function renderGuard(allow: "vet" | "owner", initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={
            <RoleGuard allow={allow}>
              <div>Vet content</div>
            </RoleGuard>
          }
        />
        <Route
          path="/owner"
          element={
            <RoleGuard allow="owner">
              <div>Owner content</div>
            </RoleGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoleGuard", () => {
  beforeEach(() => {
    mockIsConnected = true;
    mockIsVet = false;
    mockIsVetLoading = false;
    mockNavigate.mockClear();
  });

  it("redirects non-vet from vet route to /owner", async () => {
    mockIsVet = false;
    renderGuard("vet", "/");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/owner", { replace: true });
    });
  });

  it("redirects vet from owner route to /", async () => {
    mockIsVet = true;
    renderGuard("owner", "/owner");
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("shows connect message when disconnected", () => {
    mockIsConnected = false;
    renderGuard("vet", "/");
    expect(
      screen.getByText("Connect your wallet to continue."),
    ).toBeInTheDocument();
  });

  it("renders children for vet on vet route", () => {
    mockIsVet = true;
    renderGuard("vet", "/");
    expect(screen.getByText("Vet content")).toBeInTheDocument();
  });
});
