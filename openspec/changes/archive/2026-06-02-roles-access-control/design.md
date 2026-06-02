# Design: Roles & Access Control

## Technical Approach

Replace single-owner (`Ownable`) with multi-role (`AccessControl`), gate vet operations with `VET_ROLE`, and restrict payments to the pet's recorded owner. All changes are backward-incompatible by nature (immutable contract) — deploy a new version.

---

## Architecture Decisions

### Decision 1: AccessControl vs Ownable

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `Ownable` (current) | Single owner, no role granularity | ❌ Reject — cannot distinguish vets from admin |
| `AccessControl` | Lightweight, standard, gas efficient for 1-2 roles | ✅ **Accept** — adequate for project scope |
| `AccessControlDefaultAdminRules` | Adds safe admin transfer with timelock | ❌ Reject — complexity not needed; can add later |

**Rationale**: `AccessControl` is already in the OZ v5 dependency. Two roles (`DEFAULT_ADMIN_ROLE` + `VET_ROLE`) cost minimal gas. Admin transfer can be added later via `grantRole`/`renounceRole`.

### Decision 2: VET_ROLE Gating

| Function | Guard | Rationale |
|----------|-------|-----------|
| `registerPet` | `onlyRole(VET_ROLE)` | Only vets should create records |
| `scheduleAppointment` | `onlyRole(VET_ROLE)` | Only vets should schedule |

Constructor grants both `DEFAULT_ADMIN_ROLE` and `VET_ROLE` to `msg.sender`. Admin calls `grantRole(VET_ROLE, addr)` to add vets.

### Decision 3: Owner field in MedicalRecord

New `address owner` appended at **end** of struct — storage-compatible append (existing slots unchanged). `registerPet` signature adds `address owner` param between `animalType` and `caretakerName`. `MedicalRecordCreated` event gains a new `indexed address owner` param.

### Decision 4: Payment owner-gating

```
payAppointmentToken(id, token):
  require(msg.sender == _medicalRecords[_appointments[id].petId].owner, "Not pet owner")

payAppointmentEth(id, priceFeed):
  require(msg.sender == _medicalRecords[_appointments[id].petId].owner, "Not pet owner")
```

No changes to appointment value, paid value, or transfer logic. Withdraw functions remain `onlyRole(DEFAULT_ADMIN_ROLE)` (replacing `onlyOwner`).

---

## Data Flow

```
Admin ── grantRole(VET_ROLE, addr) ──→ Vet
Vet   ── registerPet(..., owner)   ──→ MedicalRecord { ..., owner: 0x... }
Vet   ── scheduleAppointment(petId) ──→ Appointment { petId → record }
Owner ── payAppointment*(id)        ──→ require(msg.sender == record.owner)
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `contracts/VetRegistry.sol` | Modify | Ownable→AccessControl, VET_ROLE, owner field, payment guards |
| `test/VetRegistry.test.ts` | Modify | VET_ROLE setup, owner-based payment tests, new unauthorized tests |
| `scripts/deploy.ts` | No change | Constructor still takes no arguments |

---

## Interfaces / Contracts

```solidity
// New imports
import "@openzeppelin/contracts/access/AccessControl.sol";
// Remove: import "@openzeppelin/contracts/access/Ownable.sol";

contract VetRegistry is AccessControl {
    bytes32 public constant VET_ROLE = keccak256("VET_ROLE");

    struct MedicalRecord {
        string name;
        uint8 age;
        AnimalType animalType;
        string caretakerName;
        string caretakerPhone;
        address owner;          // ← NEW, at end
    }

    // registerPet: new `address owner` param between animalType and caretakerName
    // Events: MedicalRecordCreated gains `indexed address owner`
}
```

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `registerPet` with/without VET_ROLE | `beforeEach`: grant VET_ROLE to test signer; expect `AccessControlUnauthorizedAccount` |
| Unit | `scheduleAppointment` with/without VET_ROLE | Same pattern as above |
| Unit | `payAppointmentToken` owner vs non-owner | Register with owner=A, pay with owner=B → revert |
| Unit | `payAppointmentEth` owner vs non-owner | Same as token |
| Unit | Admin `grantRole`/`revokeRole` | Standard AccessControl tests |
| Integration | Full flow: VET registers → owner pays | Happy path with both token and ETH |

Key adaptation: existing tests use `owner` signer for registration + scheduling — they already work since deployer gets VET_ROLE. Payment tests must switch from generic `payer` to the actual pet `owner`.

---

## Migration / Rollout

No migration required. This is a fresh deploy (immutable contract). No production data exists.

---

## Open Questions

None. Specs and proposal fully define the scope.
