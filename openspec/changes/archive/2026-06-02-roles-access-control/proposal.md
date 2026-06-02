# Proposal: Roles & Access Control

## Intent

`registerPet()`, `scheduleAppointment()`, and payment functions are public — anyone can register, schedule, or pay any appointment. There's no ownership link between a pet and its owner, and no role gating for vet operations. This breaks trust assumptions: a non-vet can register pets, and a stranger can pay for someone else's appointment.

## Scope

### In Scope
- Replace `Ownable` with OZ `AccessControl`; add `VET_ROLE`
- Add `address owner` to `MedicalRecord` struct; vet passes it on registration
- Gate `registerPet()` and `scheduleAppointment()` with `VET_ROLE`
- Gate `payAppointmentToken()` and `payAppointmentEth()` to `MedicalRecord.owner`
- Update `MedicalRecordCreated` event with `owner` param
- Adapt existing tests; add new scenarios for role enforcement and owner-gated payments
- Update `openspec/specs/` (vet-contract, pet-registration, payment)

### Out of Scope
- No frontend changes to pet registration form fields
- No admin UI for role management (use `grantRole` / `revokeRole` directly via block explorer or scripts)
- No `DEFAULT_ADMIN_ROLE` delegation (deployer retains it)
- No `PAYER_ROLE` — owner-by-address is sufficient
- No `payAppointment` ETH signature change beyond the owner check

## Capabilities

### New Capabilities
- `contract-roles`: RBAC for vet operations — VET_ROLE gating, role management via AccessControl

### Modified Capabilities
- `vet-contract`: MedicalRecord gains `address owner`; registration requires owner param
- `payment`: Payment functions restricted to MedicalRecord.owner instead of public

## Approach

1. Replace `import Ownable` with `import AccessControl`; `is Ownable` → `is AccessControl`
2. Define `bytes32 public constant VET_ROLE = keccak256("VET_ROLE")`
3. Constructor grants `DEFAULT_ADMIN_ROLE` and `VET_ROLE` to `msg.sender`
4. Add `address owner` to `MedicalRecord` struct and matching param to `registerPet()`
5. Add `onlyRole(VET_ROLE)` to `registerPet()` and `scheduleAppointment()`
6. Add `require(msg.sender == _medicalRecords[_appointments[id].petId].owner)` to both payment functions
7. Rebuild TypeChain artifacts; adapt tests

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contracts/VetRegistry.sol` | Modified | AccessControl, VET_ROLE, owner field, payment guards |
| `test/VetRegistry.test.ts` | Modified | New tests for role enforcement + owner checks |
| `openspec/specs/vet-contract/spec.md` | Modified | Owner param in MedicalRecord, VET_ROLE gate |
| `openspec/specs/pet-registration/spec.md` | Modified | Owner address in registration flow |
| `openspec/specs/payment/spec.md` | Modified | Owner-gated payment requirement |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Storage layout change (struct append) | High | Appending to struct end is OZ-safe; test storage reads after upgrade |
| Event signature change breaks off-chain indexers | Medium | Accept as breaking change; align with frontend team |
| High test churn from access control assertions | Medium | Write role setup in `beforeEach`; reuse across test blocks |

## Rollback Plan

`git revert` the commit, re-deploy the contract (immutable storage — revert + re-deploy required either way). No migration needed since no production data.

## Dependencies

None. OpenZeppelin contracts v5.6.1 already installed (includes AccessControl).

## Success Criteria

- [ ] Only accounts with VET_ROLE can call `registerPet()` or `scheduleAppointment()`
- [ ] Only the pet's recorded owner can call `payAppointmentToken()` / `payAppointmentEth()` for that pet
- [ ] `MedicalRecordCreated` event includes the `owner` address
- [ ] All existing tests pass with minimal adaptation
- [ ] Deploy script works with AccessControl constructor
