# Proposal: Fix Payment Modal Not Closing

## Intent

After a user confirms a USDC payment in MetaMask, the modal falls back to the "Pay with USDC" state instead of showing success and auto-closing. This is caused by a race condition in the payment state machine: once `isApproved` is `true` from a prior approval, it perpetually stays `true`, so when the pay tx confirmation briefly leaves all pay-related flags `false`, the state derivation falls through to `isApproved → ready-to-pay`.

Three additional bugs compound the issue: (1) error state never triggers because `isError` is not destructured from `useWaitForTransactionReceipt`, (2) the `onSuccess` callback is an inline function that resets the auto-close timer on every parent render, and (3) `handlePaySuccess` calls `onSelectPet` with the same value, bailing out of React re-render so appointment data never refreshes.

## Scope

### In Scope
- Fix state derivation in `usePayAppointmentToken.ts` — add a `payTxSubmitted` guard to prevent fallthrough to `isApproved` once a pay tx has been submitted.
- Destructure `isError`/`error` from `useWaitForTransactionReceipt` and surface reverted transaction errors.
- Stabilize `onSuccess` in `PayAppointmentModal.tsx` with `useRef` to prevent timer reset.
- Add explicit `queryClient.invalidateQueries` in `AppointmentsView.handlePaySuccess`.
- Verify the full flow: approve → pay → success → auto-close.

### Out of Scope
- Refactoring the state machine to `useReducer` or xstate (deferred — the `payTxSubmitted` guard is sufficient for now).
- Adding optimistic UI updates for payment status.

## Capabilities

### New Capabilities
None — pure bugfix, no new spec-level requirements.

### Modified Capabilities
None — payment spec (`openspec/specs/payment/spec.md`) requirements are unchanged; only the frontend state machine behavior is corrected.

## Approach

Three targeted fixes across three files:

1. **`usePayAppointmentToken.ts`**: Introduce `payTxSubmitted` state (boolean, set to `true` when `pay()` is called). In state derivation, check `payTxSubmitted` before `isApproved` — if a pay tx has been submitted, skip the ready-to-pay branch. Also destructure `isError`/`error` from the pay receipt watcher and return an error state when the tx reverts.

2. **`PayAppointmentModal.tsx`**: Wrap `onSuccess` in a `useRef` so the `useEffect` with `setTimeout` always reads the latest callback without resetting the timer.

3. **`AppointmentsView.tsx`**: In `handlePaySuccess`, call `queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY })` before calling `onSelectPet`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `web-app/src/hooks/web3/usePayAppointmentToken.ts` | Modified | Add `payTxSubmitted` guard + error destructuring |
| `web-app/src/appointments/components/PayAppointmentModal.tsx` | Modified | Stabilize `onSuccess` with `useRef` |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Modified | Explicit query invalidation in `handlePaySuccess` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `payTxSubmitted` never resets for a second payment | Low | `reset()` already clears `stablePayTxHash` — add `payTxSubmitted` clear in `reset` |
| Edge case: user creates two payments | Low | Modal unmounts on close, component state resets |

## Rollback Plan

`git revert <merge-commit>` — three self-contained commits that are safe to revert individually or as a group. No migration, no config changes.

## Dependencies

None.

## Success Criteria

- [ ] After user confirms pay tx in MetaMask, modal shows "Payment successful!" for 2 seconds then auto-closes
- [ ] If pay tx reverts on-chain, modal shows error message with "Try Again" button
- [ ] After payment success, appointment card refreshes to show "Paid" status without manual page reload
- [ ] All existing approval flows (needs-approval → approving → ready-to-pay) continue working unchanged
