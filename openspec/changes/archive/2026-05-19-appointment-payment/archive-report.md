## Archive Report

### Change Summary
- Name: appointment-payment
- Description: USDC stablecoin payment for veterinary appointments. Extends VetRegistry with ERC20 payment (payAppointmentToken, withdrawToken, owner auth), frontend hook (usePayAppointmentToken with approve-then-pay flow), and PayAppointmentModal UI.
- Created: 2026-05-19
- Completed: 2026-05-19

### Deliverables
| PR | Description | Commit |
|----|-------------|--------|
| PR 1 | Contract layer (MockERC20 + VetRegistry payment + 9 Hardhat tests) | `b192102691d1` |
| PR 2 | Frontend hooks + ABIs (usePayAppointmentToken, erc20ABI, 3 Vitest tests) | `547102ce0f2f` |
| PR 3 | Frontend UI (PayAppointmentModal, Pay button in AppointmentCard, 4 Vitest tests) | `7b97e2f92605` |

### Artifacts
- Spec delta: openspec/specs/payment/spec.md (new permanent domain spec)
- Spec delta: openspec/specs/vet-contract/spec.md (merged: Payment Functions requirement)
- Spec delta: openspec/specs/contract-writes/spec.md (merged: Pay Appointment Hook + Token Approval Hook)
- Spec delta: openspec/specs/appointments-page/spec.md (merged: Pay with USDC Action)
- Archive: openspec/changes/archive/2026-05-19-appointment-payment/

### Engram Observation IDs
| Artifact | ID |
|----------|----|
| Spec | #86 |
| Design | #87 |
| Tasks | #88 |
| Apply Progress | #89 |
| Archive Report | (this record) |

### Stats
- Total tasks: 9/9
- Scenarios verified: 17/17
- Hardhat tests: 26 (17 existing + 9 new payment tests)
- Vitest tests: 30 (26 existing + 4 new hook tests + ...)
- Lines changed: ~630
- PRs: 3 (chained stacked-to-main)

### Scenarios Coverage
| Domain | Scenarios | Status |
|--------|-----------|--------|
| Payment (new) | 8 | ✅ Implemented |
| Vet Contract (delta) | 7 | ✅ Merged into main spec |
| Contract Writes (delta) | 4 | ✅ Merged into main spec |
| Appointments Page (delta) | 6 | ✅ Merged into main spec |

### Verdict
ARCHIVED ✅
