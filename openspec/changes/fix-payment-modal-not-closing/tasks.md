# Tasks: Fix Payment Modal Not Closing

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~60-80 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Fix state machine in `usePayAppointmentToken.ts` | PR 1 | Core race condition fix — `payTxSubmitted` guard + error destructuring |
| 2 | Stabilize `onSuccess` in `PayAppointmentModal.tsx` | PR 1 | `useRef` wrap prevents timer reset |
| 3 | Force refresh in `AppointmentsView.tsx` | PR 1 | `queryClient.invalidateQueries` before modal close |

## Phase 1: Core State Machine Fix

- [x] 1.1 In `usePayAppointmentToken.ts`, add `payTxSubmitted` state (boolean, default `false`), set `true` inside `pay()` callback
- [x] 1.2 In state derivation, check `payTxSubmitted` before `isApproved` — if `payTxSubmitted` and not yet `isPaid`/`isPayConfirming`, show `"processing"` state
- [x] 1.3 Destructure `isError`/`error` from `useWaitForTransactionReceipt` for pay tx; add pay receipt error branch before `payError` in state derivation
- [x] 1.4 Reset `payTxSubmitted` in `reset()` alongside `stablePayTxHash`
- [x] 1.5 Add same `approveTxSubmitted` guard + reset for approve side consistency

## Phase 2: Modal Callback Stabilization

- [x] 2.1 In `PayAppointmentModal.tsx`, import `useRef`
- [x] 2.2 Wrap `onSuccess` prop in `useRef(onSuccess)` so the effect always reads the latest callback without resetting the timer
- [x] 2.3 Remove `onSuccess` from `useEffect` dependency array

## Phase 3: Data Refresh After Payment

- [x] 3.1 In `AppointmentsView.tsx`, confirm `useQueryClient` and `APPOINTMENTS_QUERY_KEY` are already imported (lines 5-6)
- [x] 3.2 In `handlePaySuccess`, call `queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY })` before setting `payingAppointmentId` to `null`

## Phase 4: Verification

- [ ] 4.1 Verify approval flow still works: needs-approval → approving → approval-processing → ready-to-pay
- [ ] 4.2 Verify pay flow: ready-to-pay → pay → pending → processing → success auto-closes after 2s
- [ ] 4.3 Verify reverted pay tx shows error with "Try Again" button
- [ ] 4.4 Verify appointment card refreshes to "Paid" status after success
- [ ] 4.5 Verify `reset()` clears all state for a fresh payment attempt
- [ ] 4.6 Run existing tests — all must pass
