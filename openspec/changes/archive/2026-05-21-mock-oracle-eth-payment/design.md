# Design: Mock Oracle ETH Payment

## Technical Approach

Add ETH payment to VetRegistry via a mock Chainlink price feed. `payAppointmentEth(id, priceFeed)` converts the appointment's dollar-cent value to required ETH using `_centsToEth(cents, price)` — formula `(cents * 1e24) / uint256(price)`. Excess ETH is refunded via CEI pattern. A new `MockPriceFeed.sol` implements `AggregatorV3Interface` inline (no Chainlink dependency), matching the `MockERC20.sol` pattern: MIT license, no imports, ^0.8.28, open access.

**Frontend**: The existing `PayAppointmentModal` gets a payment method selector (dropdown) to choose between USDC and ETH. A new `usePayAppointmentEth` hook handles the ETH payment flow (no approve step — sends `msg.value` directly). The ETH option is gated by `VITE_PRICE_FEED_ADDRESS`.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Chainlink dependency | Install `@chainlink/contracts` vs inline `AggregatorV3Interface` | Install adds dependency weight for a mock env; inline adds zero maintenance for a stable interface | **Inline interface** |
| MockPriceFeed access | `onlyOwner` vs open | `onlyOwner` adds test boilerplate; open matches MockERC20 pattern | **Open** (no access control) |
| `receive()` behavior | Accept ETH vs keep reverting | Accepting ETH creates an implicit payable path; reverting enforces explicit-only | **Keep reverting** |
| Refund method | `send`/`transfer` vs low-level `call` | `send`/`transfer` limit 2300 gas and are deprecated; `call` is the modern recommended pattern | **Low-level `call`** with CEI |
| Helper consistency | `_centsToEth` standalone vs reuse `_centsToTokenUnits` | Different unit target (wei vs token units); separate helper is clearer | **New `_centsToEth(cents, price)`** |
| Payment method UI | Dropdown vs toggle vs tabs | Dropdown is compact, familiar, scales to more options; toggle is binary; tabs take more space | **Dropdown** selector |
| ETH hook reuse | Extend `usePayAppointmentToken` vs new hook | New hook is cleaner (ETH has no approve step); extending adds conditionals everywhere | **New `usePayAppointmentEth`** |
| ETH price gating | Env var vs contract call | Env var is simple and matches existing pattern (`VITE_USDC_ADDRESS`); contract call adds complexity for initial display | **Env var `VITE_PRICE_FEED_ADDRESS`** |

## Data Flow

### Contract side

```
User TX ──→ payAppointmentEth(id, feedAddr)
                │
                ├─ validate: appointment exists, unpaid
                ├─ feed.latestRoundData() ──→ price
                ├─ _centsToEth(cents, price) ──→ expectedEth
                ├─ require(msg.value >= expectedEth)
                ├─ CEI: _appointments[id].paidValue = cents
                ├─ if msg.value > expectedEth → refund via call
                └─ emit AppointmentPaidEth(id, payer, expectedEth, cents)
```

### Frontend side

```
Modal opens
  │
  ├─ Check VITE_PRICE_FEED_ADDRESS
  │    ├─ Set → show USDC|ETH selector (default USDC)
  │    └─ Not set → show USDC only
  │
  ├─ User selects ETH
  │    ├─ Fetch price from price feed (optional display)
  │    ├─ Show estimated ETH amount: "≈ {formatUnits(expectedEth, 18)} ETH"
  │    └─ User clicks "Pay with ETH"
  │         └─ usePayAppointmentEth → writeContract({functionName: "payAppointmentEth", value: expectedEth})
  │
  └─ User selects USDC
       └─ Existing approve-then-pay flow (unchanged)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `contracts/test/MockPriceFeed.sol` | **Create** | Mock AggregatorV3Interface with default $2000/ETH, `setPrice()`, auto-increment `roundId` |
| `contracts/VetRegistry.sol` | **Modify** | Add `AppointmentPaidEth` event (+1 line), `payAppointmentEth()` (+25 lines), `_centsToEth()` (+4 lines), `withdrawEth()` (+8 lines) |
| `scripts/deploy.ts` | **Modify** | Deploy MockPriceFeed after VetRegistry; output `VITE_PRICE_FEED_ADDRESS` |
| `test/VetRegistry.test.ts` | **Modify** | Add `MockPriceFeed` unit tests + ETH payment integration tests (~120 lines) |
| `dev.sh` | **Modify** | Extract `VITE_PRICE_FEED_ADDRESS` from deploy output; write to `.env` (+5 lines) |
| `web-app/src/hooks/web3/usePayAppointmentEth.ts` | **Create** | Hook wrapping `payAppointmentEth` with `msg.value = expectedEth`; state: idle → pending → processing → success/error |
| `web-app/src/appointments/components/PayAppointmentModal.tsx` | **Modify** | Add payment method selector (dropdown), branch flow based on selection, integrate `usePayAppointmentEth` |
| `web-app/src/hooks/web3/contract.ts` | **Modify** | Add ABI entries for `payAppointmentEth`, `withdrawEth`, `AppointmentPaidEth`; export `PRICE_FEED_ADDRESS` |
| `web-app/.env.example` | **Modify** | Add `VITE_PRICE_FEED_ADDRESS` placeholder |

## Interfaces / Contracts

```solidity
// Inline in VetRegistry.sol (no import needed)
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function latestRoundData()
        external view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
```

New event and function signatures:

```solidity
event AppointmentPaidEth(uint256 indexed appointmentId, address indexed payer, uint256 ethAmount, uint256 usdCents);

function payAppointmentEth(uint256 id, address priceFeed) external payable;
function _centsToEth(uint256 cents, uint256 price) internal pure returns (uint256);
function withdrawEth() external onlyOwner;
```

### Frontend Hook Signature

```typescript
// usePayAppointmentEth(appointmentId, amountInCents, priceFeedAddress)
// Returns { ethState, payEth, resetEth }
// ethState: { status: "idle" | "pending" | "processing" | "success" | "error", ... }

// Payment method type
type PaymentMethod = "USDC" | "ETH";
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | MockPriceFeed defaults, setPrice, roundId tracking | Deploy MockPriceFeed, assert decimals (8), description, version, price update, roundId increment |
| Integration | `payAppointmentEth` happy path, refunds, edge cases | Schedule appt → pay with exact ETH, excess ETH, insufficient ETH, zero price, already paid, non-existent |
| Integration | Owner ETH withdrawal | Multiple payments → `withdrawEth()` → assert balance transfer; non-owner revert |
| Regression | Direct ETH still reverts | Existing test passes unchanged |
| Frontend | Payment method selector renders | Modal shows selector when env var set, hides when unset (manual QA — no frontend test infra) |
| Frontend | ETH flow completes | Manual QA: select ETH → pay → confirm success |

## Migration / Rollout

No migration required. All changes are additive — existing ERC20 payment flow, events, and storage layouts remain untouched. `VetRegistry` gets new functions and a new event, all backwards-compatible.

## Open Questions

None. All decisions resolved in exploration and spec phases.
