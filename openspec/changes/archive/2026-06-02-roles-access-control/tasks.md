# Tasks: Roles & Access Control

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 150–200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Ownable→AccessControl + VET_ROLE + owner field + payment guards | Single PR | Tests same commit |

## Phase 1: Contract Changes

- [x] 1.1 Replace import `Ownable.sol` → `AccessControl.sol`; change `is Ownable` → `is AccessControl`
- [x] 1.2 Add `bytes32 public constant VET_ROLE`; constructor grants `DEFAULT_ADMIN_ROLE` + `VET_ROLE` to `msg.sender`
- [x] 1.3 Append `address owner` to `MedicalRecord` struct; add `address calldata owner` param to `registerPet` (between `animalType` and `caretakerName`)
- [x] 1.4 Update `MedicalRecordCreated` event: add `indexed address owner`; emit it in `registerPet`
- [x] 1.5 Add `onlyRole(VET_ROLE)` modifier to `registerPet` and `scheduleAppointment`
- [x] 1.6 Add `require(msg.sender == _medicalRecords[_appointments[id].petId].owner)` to `payAppointmentToken` and `payAppointmentEth`
- [x] 1.7 Replace `onlyOwner` with `onlyRole(DEFAULT_ADMIN_ROLE)` on `withdrawToken`/`withdrawEth`; replace `owner()` with `msg.sender`
- [x] 1.8 Rebuild TypeChain artifacts: `npx hardhat compile`

## Phase 2: Testing

- [x] 2.1 Update test setup: deployer holds both roles; `beforeEach` grants VET_ROLE to test signers
- [x] 2.2 Write VET_ROLE enforcement tests: non-VET reverts with `AccessControlUnauthorizedAccount` on `registerPet` and `scheduleAppointment`
- [x] 2.3 Write owner-gate tests: non-owner reverts on `payAppointmentToken` and `payAppointmentEth`
- [x] 2.4 Adapt existing payment tests: assign a distinct owner address per pet; pay with that owner
- [x] 2.5 Add admin role management tests: `grantRole`/`revokeRole` by admin, non-admin revert
- [x] 2.6 Run full test suite; confirm all pass

## Phase 3: Spec Sync (archive prep)

- [ ] 3.1 Update `openspec/specs/vet-contract/spec.md` with VET_ROLE guard and owner field
- [ ] 3.2 Update `openspec/specs/pet-registration/spec.md` with owner address param
- [ ] 3.3 Update `openspec/specs/payment/spec.md` with owner-gated requirement
