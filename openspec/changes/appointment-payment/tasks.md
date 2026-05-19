# Tasks: Appointment Payment with USDC

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~630 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Contract (~200) → PR 2: Frontend hooks (~225) → PR 3: Frontend UI (~205) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Contract layer (MockERC20 + VetRegistry + tests) | PR 1 | ~200 lines, standalone base |
| 2 | Frontend ABIs + usePayAppointmentToken hook + hook tests | PR 2 | ~225 lines, depends on PR 1 |
| 3 | PayAppointmentModal + AppointmentsView + component tests | PR 3 | ~205 lines, depends on PR 2 |

## Phase 1: Contract Layer

- [x] 1.1 Create `contracts/test/MockERC20.sol` — full ERC20 implementation (6 decimals, totalSupply, balances, approve, transfer, transferFrom) for Hardhat testing
- [x] 1.2 Modify `contracts/VetRegistry.sol` — add IERC20 interface, `owner` state + `onlyOwner` modifier + constructor, `_centsToTokenUnits` helper, `payAppointmentToken`, `withdrawToken`, `AppointmentPaidToken` event, `receive()` revert
- [x] 1.3 Modify `test/VetRegistry.test.ts` — deploy MockERC20, add `describe("Payment")` block with 9 test cases: happy path, bad id, already paid, zero allowance, insufficient balance, owner withdraw, non-owner withdraw, ETH reject

## Phase 2: Frontend Hooks + ABIs

- [x] 2.1 Modify `web-app/src/hooks/web3/contract.ts` — add `payAppointmentToken`/`withdrawToken`/`owner` ABI entries, `erc20ABI` constant, `VITE_USDC_ADDRESS` env export
- [x] 2.2 Create `web-app/src/hooks/web3/usePayAppointmentToken.ts` — single hook: allowance check via `useReadContract`, approve + pay via `useWriteContract` + `useWaitForTransactionReceipt`, `PaymentState` discriminated union, APPOINTMENTS_QUERY_KEY invalidation on success
- [x] 2.3 Create `web-app/src/hooks/web3/__tests__/usePayAppointmentToken.test.tsx` — 3 Vitest cases: sufficient allowance skips approval, approval then pay, error state

## Phase 3: Frontend UI

- [ ] 3.1 Create `web-app/src/appointments/components/PayAppointmentModal.tsx` — approve step → pay step → tx feedback, `PayAppointmentModalProps` interface
- [ ] 3.2 Modify `web-app/src/appointments/views/AppointmentsView.tsx` — add "Pay with USDC" button in `AppointmentCard` (condition: `paidValue === 0`), modal state management, imports
- [ ] 3.3 Modify `web-app/src/appointments/views/__tests__/AppointmentsView.test.tsx` — add 4 testing-library cases: pay button shown/hidden, modal approve step, modal pay step, error display
