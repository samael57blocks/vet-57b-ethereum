# Web3 Connect Specification

## Purpose

Conexión de wallet Ethereum (MetaMask) desde la web-app y exposición del provider/signer a través de React Context.

## Requirements

### Requirement: Wallet Connection

The system MUST allow users to connect their MetaMask wallet to the application.

#### Scenario: Connect wallet successfully

- GIVEN the user has MetaMask installed
- WHEN they click "Connect Wallet"
- THEN MetaMask prompts for account selection
- AND the selected address is stored in context
- AND the UI updates to show the connected address

#### Scenario: No MetaMask installed

- GIVEN the user does NOT have MetaMask installed
- WHEN the application loads
- THEN a message prompts them to install MetaMask
- AND reads fall back to mock data

### Requirement: Provider Availability

The system MUST provide the Ethereum provider and signer to all child components via context.

#### Scenario: Components access provider

- GIVEN a wallet is connected
- WHEN any component uses `useWeb3()`
- THEN it receives the provider, signer, account address, and chain ID
