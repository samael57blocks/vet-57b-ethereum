# Archive Report: Fix Payment Modal Not Closing

**Date**: 2026-05-20
**Change**: `fix-payment-modal-not-closing`
**Verdict**: PASS

## Artifact Summary

| Artifact | Path | Status |
|----------|------|--------|
| Proposal | `openspec/changes/fix-payment-modal-not-closing/proposal.md` | ✅ Read |
| Tasks | `openspec/changes/fix-payment-modal-not-closing/tasks.md` | ✅ Read (16/16 tasks complete) |
| Verify Report | `openspec/changes/fix-payment-modal-not-closing/verify-report.md` | ✅ Read (PASS) |
| Apply Progress | `openspec/changes/fix-payment-modal-not-closing/apply-progress.md` | ❌ Not found |
| Delta Specs | `openspec/changes/fix-payment-modal-not-closing/specs/` | ❌ Not found (no spec changes — pure bugfix) |

## Spec Sync

No delta specs to merge. Proposal explicitly states:
- **New Capabilities**: None — pure bugfix, no new spec-level requirements.
- **Modified Capabilities**: None — payment spec requirements are unchanged; only the frontend state machine behavior is corrected.

**Result**: No spec sync needed. Main specs remain unchanged.

## Implementation Summary

3 files modified across 10 implementation tasks:

| Area | Change |
|------|--------|
| `web-app/src/hooks/web3/usePayAppointmentToken.ts` | Added `payTxSubmitted` guard + `approveTxSubmitted` state + error destructuring |
| `web-app/src/appointments/components/PayAppointmentModal.tsx` | Stabilized `onSuccess` with `useRef` |
| `web-app/src/appointments/views/AppointmentsView.tsx` | Added explicit `queryClient.invalidateQueries` in `handlePaySuccess` |

## Verification Summary

- ✅ TypeScript: 0 errors
- ✅ Unit tests: 30 passed / 0 failed
- ✅ Contract tests: 26 passed / 0 failed
- ✅ All 4 success criteria met
- ✅ No critical/warning/suggestion issues
- ✅ One design deviation (approveTxSubmitted not used in derivation guard) — correct by design, approve side has no race condition

## Archive Details

- **Archived to**: `openspec/changes/archive/2026-05-20-fix-payment-modal-not-closing/`
- **Source of truth**: Main specs unchanged (no specs modified)
- **SDD Cycle**: Complete — all phases (propose, spec, design, tasks, apply, verify, archive) fully executed
