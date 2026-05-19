# Proposal: Appointment Payment with USDC (v1)

## Intent

Enable pet owners to pay for medical appointments using USDC stablecoin. Currently appointments have an `appointmentValue` and `paidValue` field, but no mechanism to actually pay them. This adds on-chain payment via ERC20 (USDC) with owner withdrawal.

## Scope

### In Scope
- `payAppointmentToken` and `withdrawToken` functions in VetRegistry.sol
- Minimal `IERC20` interface (transferFrom only) + `onlyOwner` modifier + constructor
- `AppointmentPaidToken` event
- `_centsToTokenUnits` conversion helper (USDC: 6 decimals → 1 cent = 10^4 base units)
- Mock ERC20 token for test suite + all edge cases (already paid, non-existent, insufficient allowance/balance)
- `usePayAppointmentToken` hook with built-in allowance check + approval flow
- `useApproveToken` helper hook
- ABI entries for new functions and ERC20 minimal interface
- "Pay with USDC" button in AppointmentCard when `paidValue === 0`

### Out of Scope
- ETH payments (v2)
- Price oracle (v1 uses direct USDC, no price feed needed)
- Partial payments (full amount only)
- Multi-stablecoin support
- Production deployment or indexing backend
- OpenZeppelin dependency (minimal IERC20 defined in-house)

## Capabilities

### New Capabilities
- `payment`: USDC payment for appointments (payer) and token withdrawal (owner)

### Modified Capabilities
- `vet-contract`: add `payAppointmentToken`, `withdrawToken`, `owner`, `onlyOwner`, constructor
- `contract-writes`: add `usePayAppointmentToken` + `useApproveToken` hooks
- `appointments-page`: add pay button + payment modal in appointment cards

## Approach

**Contract**: Add `owner` state + `onlyOwner` modifier. Inline minimal `IERC20` interface. `payAppointmentToken` validates appointment, checks `paidValue == 0`, computes token amount via `_centsToTokenUnits`, calls `transferFrom`, updates `paidValue`. `withdrawToken` sends contract balance to owner. Constructor sets `owner = msg.sender`. `receive()` reverts.

**Tests**: Deploy mock ERC20 (6 decimals). Fund payer, approve contract, pay. Test all revert paths: already paid, bad id, insufficient allowance, insufficient balance. Test `withdrawToken` owner vs non-owner.

**Frontend**: `usePayAppointmentToken` hook checks USDC allowance. If insufficient, returns `needsApproval: true` with `approve` fn from `useApproveToken`. Once allowance is sufficient, calls `payAppointmentToken`. Uses existing `TxState` pattern. AppointmentCard shows "Pay with USDC" when `paidValue === 0`, opens modal with payment flow.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contracts/VetRegistry.sol` | Modified | +owner, +IERC20, +payAppointmentToken, +withdrawToken |
| `test/VetRegistry.test.ts` | Modified | +mock ERC20, +payment tests, +withdrawal tests |
| `web-app/src/hooks/web3/contract.ts` | Modified | +new ABIs for vet registry + ERC20 minimal |
| `web-app/src/hooks/web3/usePayAppointmentToken.ts` | New | payment hook with allowance check |
| `web-app/src/hooks/web3/useApproveToken.ts` | New | ERC20 approval hook |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Modified | +pay button + payment modal |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reentrancy in `transferFrom` | Low | CEI pattern: update `paidValue` before external call |
| ERC20 approval UX friction | Med | Bake allowance check into hook — show approve step before payment |
| Precision loss in cent→token | Low | `tokenDecimals > 2` enforced in require; 10^(decimals-2) is uint safe |
| Non-standard ERC20 (USDT) | Low | v1 targets standard USDC only; documented scope |

## Rollback Plan

- **Contract**: Deploy new version without payment functions; the old contract preserves existing data. Owner can `withdrawToken` before redeploying.
- **Frontend**: Revert to previous commit; payment hooks are additive, no breaking changes to existing flow.
- **Tests**: Revert test additions — no production impact.

## Dependencies

- USDC deployed on target network (Sepolia/Mainnet). No npm dependencies — minimal IERC20 defined in-house.

## Success Criteria

- [ ] Pet owner can pay an unpaid appointment with USDC in one tx (or two if approval needed)
- [ ] All revert paths tested: already paid, nonexistent appointment, zero allowance, insufficient balance
- [ ] Owner can withdraw all USDC from contract
- [ ] Non-owner cannot withdraw
- [ ] UI shows Pay button only when `paidValue === 0`
- [ ] Transaction lifecycle (pending → processing → success/error) displayed in payment modal
