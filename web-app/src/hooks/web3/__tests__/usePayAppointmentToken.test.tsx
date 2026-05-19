import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePayAppointmentToken } from "../usePayAppointmentToken";
import { VET_REGISTRY_ADDRESS, erc20ABI, vetRegistryABI } from "../contract";

// ---------------------------------------------------------------------------
// Wagmi mocks — hoisted so vi.mock captures the correct references
// ---------------------------------------------------------------------------

const { mockUseAccount, mockUseReadContract, mockUseWriteContract, mockUseWaitForTransactionReceipt } = vi.hoisted(() => {
  return {
    mockUseAccount: vi.fn().mockReturnValue({ address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" }),
    mockUseReadContract: vi.fn().mockReturnValue({ data: undefined, refetch: vi.fn(), isFetching: false }),
    mockUseWriteContract: vi.fn().mockReturnValue({
      writeContract: vi.fn(),
      data: undefined,
      isPending: false,
      error: null,
      reset: vi.fn(),
    }),
    mockUseWaitForTransactionReceipt: vi.fn().mockReturnValue({
      isLoading: false,
      isSuccess: false,
    }),
  };
});

vi.mock("wagmi", () => ({
  useAccount: (...args: any[]) => mockUseAccount(...args),
  useReadContract: (...args: any[]) => mockUseReadContract(...args),
  useWriteContract: (...args: any[]) => mockUseWriteContract(...args),
  useWaitForTransactionReceipt: (...args: any[]) => mockUseWaitForTransactionReceipt(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const USER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const TOKEN_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const APPOINTMENT_ID = 1n;
const AMOUNT = 100_000_000n; // 100 USDC (6 decimals)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usePayAppointmentToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Restore default mock return values
    mockUseAccount.mockReturnValue({ address: USER_ADDRESS });
    mockUseReadContract.mockReturnValue({ data: undefined, refetch: vi.fn(), isFetching: false });
    mockUseWriteContract.mockReturnValue({
      writeContract: vi.fn(),
      data: undefined,
      isPending: false,
      error: null,
      reset: vi.fn(),
    });
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: false,
    });
  });

  // -----------------------------------------------------------------------
  // Test 1 — Sufficient allowance skips approval path
  // -----------------------------------------------------------------------
  it("shows ready-to-pay when allowance is sufficient and pay() calls payAppointmentToken", () => {
    // Arrange: allowance >= required amount
    const refetch = vi.fn();
    mockUseReadContract.mockReturnValue({
      data: AMOUNT,
      refetch,
      isFetching: false,
    });

    const writeContract = vi.fn();
    mockUseWriteContract.mockReturnValue({
      writeContract,
      data: undefined,
      isPending: false,
      error: null,
      reset: vi.fn(),
    });

    const { result } = renderHook(
      () => usePayAppointmentToken(APPOINTMENT_ID, TOKEN_ADDRESS, AMOUNT),
      { wrapper: createWrapper() },
    );

    // Assert: skipping approval path
    expect(result.current.paymentState).toEqual({ status: "ready-to-pay" });

    // Act: user clicks pay
    act(() => {
      result.current.pay();
    });

    // Assert: correct contract function called
    expect(writeContract).toHaveBeenCalledWith({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "payAppointmentToken",
      args: [APPOINTMENT_ID, TOKEN_ADDRESS],
    });
  });

  // -----------------------------------------------------------------------
  // Test 2 — Approval then pay flow
  // -----------------------------------------------------------------------
  it("shows needs-approval when allowance is insufficient, approve() calls approve on ERC-20, then transitions to ready-to-pay and pay() calls payAppointmentToken", () => {
    const refetch = vi.fn();
    const writeContract = vi.fn();

    // Phase 1 — Insufficient allowance → needs-approval
    mockUseReadContract.mockReturnValue({
      data: 0n,
      refetch,
      isFetching: false,
    });

    mockUseWriteContract.mockReturnValue({
      writeContract,
      data: undefined,
      isPending: false,
      error: null,
      reset: vi.fn(),
    });

    const { result, rerender } = renderHook(
      () => usePayAppointmentToken(APPOINTMENT_ID, TOKEN_ADDRESS, AMOUNT),
      { wrapper: createWrapper() },
    );

    expect(result.current.paymentState).toEqual({ status: "needs-approval" });

    // Act: user clicks approve
    act(() => {
      result.current.approve();
    });

    // Assert: approve dispatches ERC-20 approve
    expect(writeContract).toHaveBeenCalledWith({
      address: TOKEN_ADDRESS,
      abi: erc20ABI,
      functionName: "approve",
      args: [VET_REGISTRY_ADDRESS, AMOUNT],
    });

    // Phase 2 — Simulate post-approval allowance becoming sufficient
    // In production, the approve tx confirms and useAllowance refetches.
    // Here we update the allowance mock directly and rerender.
    const payWriteContract = vi.fn();
    mockUseReadContract.mockReturnValue({
      data: AMOUNT,
      refetch,
      isFetching: false,
    });
    mockUseWriteContract.mockReturnValue({
      writeContract: payWriteContract,
      data: undefined,
      isPending: false,
      error: null,
      reset: vi.fn(),
    });

    rerender();

    // Assert: now ready-to-pay
    expect(result.current.paymentState).toEqual({ status: "ready-to-pay" });

    // Act: user clicks pay
    act(() => {
      result.current.pay();
    });

    // Assert: pay dispatches payAppointmentToken
    expect(payWriteContract).toHaveBeenCalledWith({
      address: VET_REGISTRY_ADDRESS,
      abi: vetRegistryABI,
      functionName: "payAppointmentToken",
      args: [APPOINTMENT_ID, TOKEN_ADDRESS],
    });
  });

  // -----------------------------------------------------------------------
  // Test 3 — Error state rendering
  // -----------------------------------------------------------------------
  it("exposes error state when a write operation fails", () => {
    const testError = new Error("User rejected transaction");

    mockUseReadContract.mockReturnValue({
      data: 0n,
      refetch: vi.fn(),
      isFetching: false,
    });

    // Both useWriteContract calls return the same error
    mockUseWriteContract.mockReturnValue({
      writeContract: vi.fn(),
      data: undefined,
      isPending: false,
      error: testError,
      reset: vi.fn(),
    });

    const { result } = renderHook(
      () => usePayAppointmentToken(APPOINTMENT_ID, TOKEN_ADDRESS, AMOUNT),
      { wrapper: createWrapper() },
    );

    expect(result.current.paymentState).toEqual({
      status: "error",
      error: testError,
    });
  });
});
