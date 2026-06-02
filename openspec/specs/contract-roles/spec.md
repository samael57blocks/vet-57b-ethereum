# Contract Roles Specification

## Purpose

Role-based access control for the VetRegistry contract using OpenZeppelin AccessControl. Defines VET_ROLE for gating veterinary operations and DEFAULT_ADMIN_ROLE for role management.

## Requirements

### Requirement: VET_ROLE Definition

The contract MUST define a `VET_ROLE` constant as `keccak256("VET_ROLE")`. The deployer MUST be granted both `DEFAULT_ADMIN_ROLE` and `VET_ROLE` in the constructor.

#### Scenario: Deployer receives both roles

- GIVEN a contract deployment
- WHEN the constructor executes
- THEN `msg.sender` has both `DEFAULT_ADMIN_ROLE` and `VET_ROLE`

### Requirement: VET_ROLE Gating

The `registerPet` and `scheduleAppointment` functions MUST revert when called by an account without `VET_ROLE`.

#### Scenario: VET_ROLE holder calls gated function

- GIVEN the caller has `VET_ROLE`
- WHEN they call `registerPet` or `scheduleAppointment`
- THEN the call succeeds

#### Scenario: Non-VET caller is rejected

- GIVEN the caller does NOT have `VET_ROLE`
- WHEN they call `registerPet` or `scheduleAppointment`
- THEN the call reverts with `AccessControlUnauthorizedAccount(caller, VET_ROLE)`

### Requirement: Role Management

Accounts with `DEFAULT_ADMIN_ROLE` MUST be able to grant and revoke `VET_ROLE` to/from any account.

#### Scenario: Admin grants VET_ROLE

- GIVEN the caller has `DEFAULT_ADMIN_ROLE`
- WHEN they call `grantRole(VET_ROLE, account)`
- THEN the account receives `VET_ROLE`

#### Scenario: Admin revokes VET_ROLE

- GIVEN an account has `VET_ROLE`
- AND the caller has `DEFAULT_ADMIN_ROLE`
- WHEN they call `revokeRole(VET_ROLE, account)`
- THEN the account loses `VET_ROLE`

#### Scenario: Non-admin cannot grant

- GIVEN the caller does NOT have `DEFAULT_ADMIN_ROLE`
- WHEN they call `grantRole(VET_ROLE, account)`
- THEN the call reverts with `AccessControlUnauthorizedAccount`
