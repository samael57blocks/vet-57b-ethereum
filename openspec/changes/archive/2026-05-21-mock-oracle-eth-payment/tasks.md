# Tasks: Mock Oracle ETH Payment

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Foundation — MockPriceFeed

- [x] 1.1 Create `contracts/test/MockPriceFeed.sol` — inline AggregatorV3Interface, `int256 public price` default 2000e8, `setPrice(int256)`, `latestRoundData()` returns with auto-increment roundId
- [x] 1.2 Verify compilation: `npx hardhat compile` includes MockPriceFeed without errors

## Phase 2: Core Implementation — VetRegistry

- [x] 2.1 Modify `contracts/VetRegistry.sol` — add `AggregatorV3Interface` interface, add `event AppointmentPaidEth`
- [x] 2.2 Add `_centsToEth(uint256 cents, uint256 price)` internal pure — `(cents * 1e24) / uint256(price)`
- [x] 2.3 Add `payAppointmentEth(uint256 id, address priceFeed)` external payable — validate, CEI, refund, emit
- [x] 2.4 Add `withdrawEth()` external onlyOwner — transfers `address(this).balance` to owner

## Phase 3: Deployment Wiring

- [x] 3.1 Modify `scripts/deploy.ts` — deploy MockPriceFeed, output `VITE_PRICE_FEED_ADDRESS`
- [x] 3.2 Modify `dev.sh` — parse `VITE_PRICE_FEED_ADDRESS` from deploy output, write to `.env`
- [x] 3.3 Modify `web-app/.env.example` — add `VITE_PRICE_FEED_ADDRESS` placeholder

## Phase 4: Frontend — ETH Payment UI

- [x] 4.1 Modify `web-app/src/hooks/web3/contract.ts` — add ABI entries for `payAppointmentEth`, `withdrawEth`, `AppointmentPaidEth`; export `PRICE_FEED_ADDRESS` from `VITE_PRICE_FEED_ADDRESS`
- [x] 4.2 Create `web-app/src/hooks/web3/usePayAppointmentEth.ts` — hook wrapping `payAppointmentEth` with `value: expectedEth`; states: idle → pending → processing → success/error; invalidate appointments on success
- [x] 4.3 Modify `web-app/src/appointments/components/PayAppointmentModal.tsx` — add payment method selector (USDC/ETH dropdown), conditionally render ETH flow or USDC approve-then-pay, integrate `usePayAppointmentEth`, gate ETH option behind `PRICE_FEED_ADDRESS`

## Phase 5: Testing

- [x] 5.1 Add `describe("ETH Payment")` block in `test/VetRegistry.test.ts` — MockPriceFeed fixture, 8 test cases: exact payment, refund excess, non-existent revert, already paid revert, insufficient ETH revert, zero price revert, owner withdraw, non-owner withdraw revert
- [x] 5.2 Run `npx hardhat test` — confirm all existing + new tests pass
