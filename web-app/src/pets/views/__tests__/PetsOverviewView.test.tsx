import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PetsOverviewView } from "../PetsOverviewView";
import { PET_QUERY_KEY } from "../../hooks/usePetsOverview";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockIsConnected = true;

vi.mock("wagmi", () => ({
  useAccount: () => ({
    isConnected: mockIsConnected,
    address: "0x1234567890abcdef1234567890abcdef12345678",
  }),
  useReadContract: () => ({ data: [], isLoading: false }),
}));

let currentTxState: Record<string, unknown> = { status: "idle" };
const mockRegisterPet = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("../../../hooks/web3/useRegisterPet", () => ({
  useRegisterPet: () => ({
    registerPet: mockRegisterPet,
    get txState() {
      return currentTxState;
    },
    txHash: undefined,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillForm() {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Boby" },
  });
  fireEvent.change(screen.getByLabelText("Age"), {
    target: { value: "3" },
  });
  fireEvent.change(screen.getByLabelText("Animal Type"), {
    target: { value: "Dog" },
  });
  fireEvent.change(screen.getByLabelText("Caretaker Name"), {
    target: { value: "John" },
  });
  fireEvent.change(screen.getByLabelText("Caretaker Phone"), {
    target: { value: "+56912345678" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PetsOverviewView", () => {
  beforeEach(() => {
    mockIsConnected = true;
    currentTxState = { status: "idle" };
    mockRegisterPet.mockReset();
    mockInvalidateQueries.mockReset();
  });

  describe("Wallet Guard", () => {
    it("shows wallet guard message and hides Register Pet button when disconnected", () => {
      mockIsConnected = false;
      render(<PetsOverviewView pets={[]} />);

      expect(
        screen.getByText("Connect your wallet to register a pet")
      ).toBeInTheDocument();
      expect(
        screen.queryAllByRole("button", { name: /register pet/i })
      ).toHaveLength(0);
    });

    it("shows Register Pet button when connected", () => {
      render(<PetsOverviewView pets={[]} />);

      expect(
        screen.getByRole("button", { name: /register pet/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Connect your wallet to register a pet")
      ).not.toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("blocks submission with empty fields and shows validation errors", () => {
      render(<PetsOverviewView pets={[]} />);

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /register pet/i }));

      // Submit with empty form
      fireEvent.click(screen.getAllByRole("button", { name: /register pet/i })[1]);

      // Assert validation errors visible
      expect(
        screen.getByText("Name must have at least 2 characters")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Age must be a number greater than 0")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Select an animal type")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Caretaker name must have at least 2 characters")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Caretaker phone is required")
      ).toBeInTheDocument();

      // Assert registerPet NOT called
      expect(mockRegisterPet).not.toHaveBeenCalled();
    });
  });

  describe("Registration Flow", () => {
    it("calls registerPet with valid data and shows tx state transitions", () => {
      const { rerender } = render(<PetsOverviewView pets={[]} />);

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /register pet/i }));

      // Fill form with valid data
      fillForm();

      // Submit
      fireEvent.click(screen.getAllByRole("button", { name: /register pet/i })[1]);

      // registerPet should have been called with correct args
      expect(mockRegisterPet).toHaveBeenCalledWith({
        name: "Boby",
        age: 3,
        animalType: 0,
        owner: "0x1234567890abcdef1234567890abcdef12345678",
        caretakerName: "John",
        caretakerPhone: "+56912345678",
      });

      // Simulate pending state
      currentTxState = { status: "pending" };
      rerender(<PetsOverviewView pets={[]} />);
      expect(
        screen.getByText("Confirm transaction in MetaMask...")
      ).toBeInTheDocument();

      // Simulate processing state
      currentTxState = { status: "processing" };
      rerender(<PetsOverviewView pets={[]} />);
      expect(
        screen.getByText("Transaction processing...")
      ).toBeInTheDocument();

      // Simulate success → auto-close + invalidate
      currentTxState = { status: "success", txHash: "0xabc" };
      rerender(<PetsOverviewView pets={[]} />);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: PET_QUERY_KEY,
      });
      expect(screen.queryByText("Register New Pet")).not.toBeInTheDocument();
    });

    it("shows error state on transaction failure and allows retry", () => {
      const { rerender } = render(<PetsOverviewView pets={[]} />);

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /register pet/i }));

      // Fill and submit
      fillForm();
      fireEvent.click(screen.getAllByRole("button", { name: /register pet/i })[1]);

      // Clear initial call count
      mockRegisterPet.mockClear();

      // Simulate error
      currentTxState = {
        status: "error",
        error: new Error("User rejected transaction"),
      };
      rerender(<PetsOverviewView pets={[]} />);

      expect(
        screen.getByText("Error: User rejected transaction")
      ).toBeInTheDocument();

      // Click Try Again
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      // Should submit again
      expect(mockRegisterPet).toHaveBeenCalledTimes(1);
    });
  });
});
