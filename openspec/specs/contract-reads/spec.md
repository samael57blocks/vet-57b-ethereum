# Contract Reads Specification

## Purpose

Hooks TanStack Query que encapsulan la lectura de datos desde el contrato VetRegistry con caching, refetch automático, y loading states.

## Requirements

### Requirement: Pet List Query

The system MUST expose a hook `usePets` that fetches all medical records from the contract.

#### Scenario: Fetch all pets

- GIVEN the contract has 3 pets registered
- WHEN `usePets()` is called
- THEN it returns an array of 3 Pet objects with loading and error states
- AND data is cached with key `['vetRegistry', 'pets']`

#### Scenario: Contract not deployed

- GIVEN no contract is deployed at the configured address
- WHEN `usePets()` resolves
- THEN error state is set
- AND the UI remains functional using mock data fallback

### Requirement: Pet Detail Query

The system MUST expose a hook `usePet(id)` that fetches a single medical record.

#### Scenario: Fetch single pet

- GIVEN pet ID `0x1` exists
- WHEN `usePet('0x1')` is called
- THEN the pet's data is returned
- AND the query key is `['vetRegistry', 'pet', { id }]`

### Requirement: Auto-refetch on Mutation

The system MUST invalidate pet queries after a successful write transaction.

#### Scenario: Refetch after registration

- GIVEN a new pet was just registered via mutation
- WHEN the mutation succeeds
- THEN `onSuccess` invalidates `['vetRegistry', 'pets']` queries
- AND the UI updates to show the new pet
