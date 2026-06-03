# Owner Registration Specification

## Purpose

Allow pet owners to register their wallet on-chain, enabling a personalized dashboard and vet-side owner selection via dropdown.

## Requirements

### Requirement: Owner Self-Registration

Any address MAY call `registerAsOwner(string name)` to register. No role guard — registration is permissionless. The name MUST be between 2 and 32 characters. Re-registration by the same address MUST update the name but MUST NOT add a duplicate entry to the owners list.

#### Scenario: First-time registration succeeds

- GIVEN any wallet is connected
- WHEN `registerAsOwner("Alice")` is submitted
- THEN the transaction succeeds
- AND an `OwnerRegistered(address, "Alice")` event is emitted

#### Scenario: Re-registration updates name

- GIVEN address `0xA` is already registered as "Alice"
- WHEN `registerAsOwner("Alice Smith")` is called from `0xA`
- THEN the stored name updates to "Alice Smith"
- AND the owners list does NOT grow (no duplicate entry)

#### Scenario: Empty name reverts

- GIVEN a wallet is connected
- WHEN `registerAsOwner("")` is called
- THEN the transaction reverts

### Requirement: Registered Owners Query

The system MUST return all registered owners as an array of `(address, string name)` tuples via `getRegisteredOwners()`.

#### Scenario: Returns all registered owners

- GIVEN two addresses `0xA` and `0xB` are registered
- WHEN `getRegisteredOwners()` is called
- THEN an array of 2 owner tuples is returned
- AND each entry contains the correct address and name

#### Scenario: No owners returns empty

- GIVEN no owner has ever registered
- WHEN `getRegisteredOwners()` is called
- THEN an empty array is returned

### Requirement: Pets by Owner Query

The system MUST return an array of pet IDs owned by a given address via `getPetsByOwner(address)`.

#### Scenario: Owner has pets

- GIVEN address `0xA` owns pets with IDs 1, 3, 5
- WHEN `getPetsByOwner(0xA)` is called
- THEN `[1, 3, 5]` is returned

#### Scenario: Owner has no pets

- GIVEN address `0xA` is registered but owns no pets
- WHEN `getPetsByOwner(0xA)` is called
- THEN an empty array is returned

### Requirement: Owner Dashboard

When the connected wallet is a registered owner, the system MUST display a dashboard with the owner's pets, their unpaid appointments, and a pay button per appointment. The dashboard MUST be under the `/owner` route. A "My Pets" link SHOULD appear in the NavBar when a registered owner wallet is detected.

#### Scenario: Registered owner sees dashboard

- GIVEN the connected wallet is registered as an owner
- WHEN navigating to `/owner`
- THEN the owner's pets are listed
- AND each pet shows its unpaid appointments with value and pay button

#### Scenario: Unregistered wallet sees registration form

- GIVEN the connected wallet is NOT registered as an owner
- WHEN navigating to `/owner`
- THEN a registration form is displayed (name input + submit)
- AND no dashboard is shown

#### Scenario: No wallet connected

- GIVEN no wallet is connected
- WHEN navigating to `/owner`
- THEN a "Connect your wallet" message is displayed
