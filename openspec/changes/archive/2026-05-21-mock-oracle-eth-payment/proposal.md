# Proposal: mock-oracle-eth-payment

## Intent

Pet owners can pay appointment fees directly with ETH. A mock Chainlink price feed (AggregatorV3Interface) converts the appointment's dollar-cent value to the required ETH amount.

## Scope

### In Scope
- `MockPriceFeed.sol` — implements AggregatorV3Interface, `setPrice()` for test manipulation
- `VetRegistry.payAppointmentEth(id, priceFeed)` — payable, computes expected ETH via `_centsToEth()`, refunds excess
- `VetRegistry.withdrawEth()` — owner-only ETH withdrawal
- Event `AppointmentPaidEth` — consistent with existing `AppointmentPaidToken` pattern
- Deploy script — add MockPriceFeed deployment, print `VITE_PRICE_FEED_ADDRESS`
- `dev.sh` — export price feed address to frontend env
- Test suite — MockPriceFeed unit tests + ETH payment integration tests
- `PayAppointmentModal` — payment method selector (dropdown) to choose between USDC and ETH
- `usePayAppointmentEth` hook — ETH payment via `payAppointmentEth(id, priceFeed)` with `msg.value`
- `contract.ts` — add `payAppointmentEth`, `withdrawEth`, `AppointmentPaidEth` to ABI; add `PRICE_FEED_ADDRESS` export
- `.env.example` — add `VITE_PRICE_FEED_ADDRESS`

### Out of Scope
- Real Chainlink integration / production price feed
- Staleness checks (MAX_DELAY) — mock always returns fresh data
- Price feed address registry / owner-set address — callers specify it per tx
- AGENTS.md update (prescribes ethers.js v6, actual code uses wagmi/viem)

## Capabilities

### New Capabilities
- `payment-ui`: Frontend payment method selector allowing users to choose between USDC and ETH when paying an appointment. ETH amount display with estimated conversion.

### Modified Capabilities
- `payment`: ETH payment added alongside existing ERC20 token payment. `ETH Rejection` requirement updated to allow explicit `payAppointmentEth`. New requirements: ETH price calculation via AggregatorV3Interface, refund of excess, owner ETH withdrawal.

## Approach

**MockPriceFeed** follows the MockERC20 pattern (MIT license, no imports, `^0.8.28`). Default price is $2000/ETH (8 decimals). `setPrice()` lets tests manipulate it.

**VetRegistry** adds `payAppointmentEth(id, priceFeed)`:
- Reads `latestRoundData()` from caller-supplied feed address
- Computes `expectedEth = (cents * 1e24) / uint256(price)`
- `require(msg.value >= expectedEth)`, refunds excess via CEI pattern
- New `receive()` accepts ETH (replaces revert — required for refunds to work)

**Formula verified**: `5000 cents * 1e24 / 200_000_000_000 = 0.025 ETH = $50` ✅

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contracts/test/MockPriceFeed.sol` | **New** | Mock AggregatorV3Interface |
| `contracts/VetRegistry.sol` | **Modified** | +payAppointmentEth, +withdrawEth, +_centsToEth, +event, update receive() |
| `scripts/deploy.ts` | **Modified** | +MockPriceFeed deployment |
| `test/VetRegistry.test.ts` | **Modified** | +MockPriceFeed + ETH payment tests |
| `dev.sh` | **Modified** | +VITE_PRICE_FEED_ADDRESS extraction |
| `web-app/src/hooks/web3/usePayAppointmentEth.ts` | **New** | Hook for ETH payment flow via `payAppointmentEth` |
| `web-app/src/appointments/components/PayAppointmentModal.tsx` | **Modified** | Add payment method selector (USDC/ETH dropdown) |
| `web-app/src/hooks/web3/contract.ts` | **Modified** | Add ABI entries + PRICE_FEED_ADDRESS |
| `web-app/.env.example` | **Modified** | Add VITE_PRICE_FEED_ADDRESS |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Re-entrancy via ETH refund | Low | CEI pattern: update state (`paidValue`) before external `.call{value: refund}` |
| Price feed address spoofing | Low (test env) | Acceptable for mock — production would use a registry |
| Division truncation loses sub-wei | Low | Truncation < 1 wei is financially negligible |
| Overflow in `cents * 1e24` | Low | Max realistic value ~1e33, well under uint256 max |

## Rollback Plan

Revert `scripts/deploy.ts` to remove MockPriceFeed deployment. The contract can stay in the repo — it's a test utility, not wired into production logic. `VetRegistry` changes are additive (no breaking changes to existing payment flow).

## Dependencies

- `@chainlink/contracts` not required — interface is implemented manually

## Success Criteria

- [ ] All Hardhat tests pass (MockPriceFeed + new VetRegistry ETH tests)
- [ ] Formula verified: `cents * 1e24 / price` produces correct ETH amount in wei
- [ ] Excess ETH returned to caller on overpayment
- [ ] Owner can withdraw accumulated ETH
- [ ] Direct ETH transfers without calling `payAppointmentEth` revert
- [ ] Deploy script outputs MockPriceFeed address
- [ ] Payment modal shows selector between USDC and ETH
- [ ] ETH payment flow completes end-to-end (hook → contract → event)
