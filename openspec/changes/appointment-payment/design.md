# Design: Appointment Payment with USDC

## Technical Approach

Extend VetRegistry with ERC20 payment using a minimal inline IERC20 interface (no OpenZeppelin). Amounts stored in cents; `_centsToTokenUnits` converts to token precision (USDC = 6 decimals). On-chain: validate, convert, CEI update, `transferFrom`. Off-chain: `usePayAppointmentToken` hook orchestrates allowance check, optional approve, and pay.

## Architecture Decisions

### CEI — paidValue before transferFrom

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **State before call** | Reentrancy blocked by `paidValue>0` guard; EVM rollback on revert | **Selected** |
| State after call | Reentrancy window between transfer and write | Rejected |
| OpenZeppelin guard | Dependency + gas; unnecessary for reverting ERC20s | Rejected |

### Single payment hook

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **One hook** | Allowance + approve + pay in one import | **Selected** |
| Three separate hooks | Composable but UI orchestration overhead | Rejected |

### Inline IERC20

Only `transferFrom`, `transfer`, `balanceOf`, `decimals`. `receive()` reverts ETH.

## Data Flow

```
Pay button clicked (paidValue === 0)
  → PaymentModal renders
    → usePayAppointmentToken reads allowance via useReadContract
      ├── allowance < amount → needsApproval=true
      │     → "Approve USDC" button
      │       → approve() → MetaMask → tx confirmed
      │         → allowance refetched → ready-to-pay
      └── allowance ≥ amount → needsApproval=false
            → "Pay with USDC" button
              → pay() → MetaMask → tx pending → processing → success/error
                → on success: invalidate APPOINTMENTS_QUERY_KEY
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `contracts/VetRegistry.sol` | Modify | +owner, +onlyOwner, +IERC20, +payAppointmentToken, +withdrawToken, +_centsToTokenUnits, +AppointmentPaidToken event, +constructor, +receive() revert |
| `contracts/test/MockERC20.sol` | Create | Minimal ERC20 (6 decimals) for Hardhat tests |
| `test/VetRegistry.test.ts` | Modify | +9 test cases: payment happy path + 4 reverts + withdrawal + ETH rejection |
| `web-app/src/hooks/web3/contract.ts` | Modify | +payAppointmentToken/withdrawToken/owner ABIs, +erc20ABI, +USDC_ADDRESS env export |
| `web-app/src/hooks/web3/usePayAppointmentToken.ts` | Create | Single hook: allowance check + approve + pay, follows TxState lifecycle |
| `web-app/src/appointments/components/PayAppointmentModal.tsx` | Create | Modal: approve step → pay step → tx feedback |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Modify | +Pay button in unpaid cards, +modal state, +imports |

## Interfaces / Contracts

### VetRegistry (Solidity delta)

```solidity
interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function decimals() external view returns (uint8);
}

address public owner;
modifier onlyOwner() { require(msg.sender == owner, "Ownable: caller is not the owner"); _; }
event AppointmentPaidToken(uint256 indexed appointmentId, address indexed payer, address token, uint256 amount);

constructor() { owner = msg.sender; }

function _centsToTokenUnits(uint256 cents, uint8 d) internal pure returns (uint256) {
    require(d > 2, "Token decimals must be > 2"); return cents * 10 ** (d - 2);
}

function payAppointmentToken(uint256 id, address token) external {
    require(id > 0 && id <= _appointmentCount, "Appointment does not exist");
    require(_appointments[id].paidValue == 0, "Already paid");
    uint256 amount = _centsToTokenUnits(_appointments[id].appointmentValue, IERC20(token).decimals());
    _appointments[id].paidValue = _appointments[id].appointmentValue; // CEI
    require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
    emit AppointmentPaidToken(id, msg.sender, token, amount);
}

function withdrawToken(address token) external onlyOwner {
    uint256 bal = IERC20(token).balanceOf(address(this));
    require(bal > 0, "No tokens");
    require(IERC20(token).transfer(owner, bal), "Transfer failed");
}

receive() external payable { revert("ETH not supported"); }
```

### TypeScript interfaces

```typescript
type PaymentState =
  | { status: "idle" } | { status: "needs-approval" }
  | { status: "approving" } | { status: "approval-processing" }
  | { status: "ready-to-pay" }
  | { status: "pending" } | { status: "processing" }
  | { status: "success"; txHash: string }
  | { status: "error"; error: Error };

interface PayAppointmentModalProps {
  appointmentId: bigint; tokenAddress: `0x${string}`;
  amountInCents: number; onClose: () => void;
}
```

`usePayAppointmentToken(appointmentId, tokenAddress, amount)` returns `{ paymentState, approve, pay, reset }`. Follows stable-tx-hash pattern from `useRegisterPet.ts`. Uses wagmi `useReadContract` for allowance (auto-refetches on chain switch), `useWriteContract` + `useWaitForTransactionReceipt` for approve and pay.

## Testing Strategy

| Layer | Cases | Approach |
|-------|-------|----------|
| Contract | 9 cases | Hardhat + MockERC20: happy path, bad id, already paid, zero allowance, insufficient balance, owner withdraw, non-owner withdraw, ETH reject, zero-value edge |
| Hook | 3 cases | Vitest + wagmi mocks: sufficient allowance skips approval, approval then pay, error state |
| Component | 4 cases | Vitest + testing-library: pay button shown/ hidden, modal approve step, modal pay step, error display |

## Migration / Rollout

No migration. Payment is additive — existing appointments have `paidValue = 0` and become payable. Owner set to deployer on next deployment. Withdraw only works after payments accrue.

## Open Questions

- USDC address per network — needs `VITE_USDC_ADDRESS` in `.env` and config in `contract.ts`
- Should `withdrawToken` emit a `TokensWithdrawn` event? Not in spec but useful for indexing.
