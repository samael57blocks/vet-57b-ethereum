# Exploration: mock-oracle-eth-payment

## Current State

`VetRegistry.sol` manages pet records and appointments. Appointments have an `appointmentValue` in dollar cents (e.g., 5000 = $50.00). Only ERC20 payments exist via `payAppointmentToken(id, token)`. Direct ETH transfers are rejected via `receive() { revert("ETH not supported"); }`.

The `_centsToTokenUnits(cents, decimals)` helper converts cents to token units using the formula `cents * 10^(d-2)`. The existing pattern uses Chainlink-inspired mock contracts (`MockERC20`) with minimal imports and MIT license.

## Affected Areas

| File | Action |
|------|--------|
| `contracts/test/MockPriceFeed.sol` | **Create** — New mock implementing AggregatorV3Interface |
| `contracts/VetRegistry.sol` | **Modify** — Add `payAppointmentEth(id, priceFeed)`, new event `AppointmentPaidEth`, update `receive()` |
| `scripts/deploy.ts` | **Modify** — Add MockPriceFeed deployment + env var |
| `test/VetRegistry.test.ts` | **Modify** — Add ETH payment test suite |
| `dev.sh` | **Modify** — Add `VITE_PRICE_FEED_ADDRESS` to env |
| `AGENTS.md` | **Note** — Stale (prescribes ethers.js v6, actual code uses wagmi/viem; out of scope here) |

## Chainlink AggregatorV3Interface Detail

From the official `@chainlink/contracts` v2.0.0 (Solidity ^0.8.0):

```solidity
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80 _roundId)
        external view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function latestRoundData()
        external view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
```

- **`decimals()`**: For ETH/USD price feeds, returns **8** (answer is in 8 decimal fixed-point).
- **`latestRoundData()`**: Returns `answer` as `int256` with 8 decimals. So ETH at $2000 → `answer = 2000 * 10^8 = 200_000_000_000`.
- **`description()`**: Returns `"ETH / USD"` or similar string.
- **`version()`**: Returns the aggregator version (e.g. `4`).

## MockPriceFeed Design

Follow the **MockERC20 pattern**: MIT license, no imports, self-contained, `^0.8.28`, constructor sets defaults, events for transparency.

### Storage

```solidity
uint8 private _decimals;        // 8 (matches real Chainlink)
string private _description;    // "ETH / USD"
uint256 private _version;       // 1
int256 private _answer;         // current price
uint256 private _updatedAt;     // timestamp
uint80  private _roundId;       // auto-increment
```

### Constructor

```solidity
constructor() {
    _decimals = 8;
    _description = "ETH / USD";
    _version = 1;
    _answer = 2000 * 1e8;       // default $2000/ETH
    _updatedAt = block.timestamp;
    _roundId = 1;
}
```

### Methods

- **`setPrice(int256 newAnswer)`** — Admin function to update the simulated price. Emits `PriceUpdated(newAnswer, block.timestamp)`.
- All `AggregatorV3Interface` methods delegate to storage (no external calls).

### Rationale for no `onlyOwner`

MockERC20 has **no** access control — it's a test contract. MockPriceFeed should follow the same simplicity. Anyone can call `setPrice()` in tests. If we want to, we can add an `owner` check, but it's unnecessary for test mocks.

## VetRegistry Changes

### 1. New Event

```solidity
event AppointmentPaidEth(
    uint256 indexed appointmentId,
    address indexed payer,
    uint256 ethAmount,
    uint256 usdCents
);
```

Consistent with `AppointmentPaidToken` naming and indexed params pattern.

### 2. New Function: `payAppointmentEth`

```solidity
function payAppointmentEth(uint256 id, address priceFeed) external payable {
    require(id > 0 && id <= _appointmentCount, "Appointment does not exist");
    require(_appointments[id].paidValue == 0, "Already paid");

    AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
    (, int256 price,,,) = feed.latestRoundData();
    require(price > 0, "Invalid price");

    uint256 cents = _appointments[id].appointmentValue;
    uint256 expectedEth = _centsToEth(cents, uint256(price));

    require(msg.value >= expectedEth, "Insufficient ETH");

    // CEI: update state BEFORE external effects (none here, but consistent pattern)
    _appointments[id].paidValue = cents;

    // Refund excess ETH
    if (msg.value > expectedEth) {
        (bool sent, ) = payable(msg.sender).call{value: msg.value - expectedEth}("");
        require(sent, "Refund failed");
    }

    emit AppointmentPaidEth(id, msg.sender, expectedEth, cents);
}
```

### 3. Price Calculation Helper

```solidity
function _centsToEth(uint256 cents, uint256 price) internal pure returns (uint256) {
    // price has 8 decimals (Chainlink standard)
    // Formula: ethAmount = (cents * 10**24) / price
    // Derived: cents / 100 USD * 10**18 wei/ETH / (price * 10**-8 USD/ETH)
    //        = cents * 10**6 * 10**18 / (price * 10**-8 * 10**8) 
    // Wait — full derivation below in formula section.
    // Simplified:
    return (cents * 1e24) / price;
}
```

### 4. Update `receive()`

The `receive()` already reverts. Keep it as-is — `payAppointmentEth` is the explicit payable function. Users should NOT accidentally send raw ETH.

### 5. Withdraw ETH (optional but recommended)

```solidity
function withdrawEth() external onlyOwner {
    uint256 bal = address(this).balance;
    require(bal > 0, "No ETH");
    (bool sent, ) = payable(owner()).call{value: bal}("");
    require(sent, "Withdraw failed");
}
```

Follows the `withdrawToken` pattern exactly but with ETH instead of ERC20.

## Price Calculation Formula with Example

**Given:**
- `cents` = appointment value in dollar cents (e.g., 5000 cents = $50.00)
- `price` = Chainlink ETH/USD answer with 8 decimals (e.g., `2000 * 10^8 = 200_000_000_000`)

**Derivation:**

```
ETH amount (in wei) = USD_amount / (USD_per_ETH)

USD_amount         = cents / 100           (cents → dollars)
USD_per_ETH        = price / 10^8          (Chainlink answer → USD)

ETH_amount (ETH)   = (cents / 100) / (price / 10^8)
                   = cents * 10^8 / (price * 100)
                   = cents * 10^6 / price

ETH_amount (wei)   = cents * 10^6 * 10^18 / price
                   = cents * 10^24 / price
```

**Final formula:**
```
ethWei = (cents * 1e24) / price
```

**Example:** $50 appointment at $2000/ETH:
- `cents = 5000`
- `price = 2000 * 10^8 = 200_000_000_000`
- `ethWei = 5000 * 10^24 / 200_000_000_000`
- `= 5 * 10^27 / 2 * 10^11`
- `= 2.5 * 10^16 wei`
- `= 0.025 ETH` ✓

**Numerical verification:**
```
0.025 ETH * $2000/ETH = $50 ✓
```

### Precision and Overflow Analysis

- `cents * 1e24` for real values (max ~ 10^9 cents = $10M) = `10^9 * 10^24 = 10^33`
- `uint256 max` = `~1.15 * 10^77` → **no overflow risk** for realistic values
- Division truncates toward zero — acceptable for wei precision (18 decimals)
- Edge case: if price is stale/zero, the `require(price > 0)` guard prevents div-by-zero

## Test Strategy

Two test suites following the existing patterns:

### MockPriceFeed tests (`describe("MockPriceFeed")`):
1. **Should return default price and decimals** — verify constructor sets `decimals() = 8`, initial answer = 2000 * 10^8
2. **Should update price via setPrice** — set new price, verify `latestRoundData()` returns updated answer
3. **Should increment roundId** — after each `setPrice`, `roundId` increments
4. **Should update `updatedAt` timestamp** — after `setPrice`, `updatedAt` updates
5. **Should return description** — returns "ETH / USD"

### ETH Payment tests (`describe("ETH Payment")` inside `VetRegistry`):
1. **Should pay an unpaid appointment with ETH** — deploy MockPriceFeed, call `payAppointmentEth(1, priceFeedAddr, {value: exactEth})`, verify event + paidValue
2. **Should refund excess ETH** — send more than needed, verify refund via balance diff
3. **Should revert when appointment does not exist** — `payAppointmentEth(999, ...)`
4. **Should revert when appointment already paid** — pay twice
5. **Should revert with insufficient ETH** — send less than expected value
6. **Should revert when price feed returns zero** — set price to 0 via `setPrice(0)`
7. **Should revert on direct ETH transfer** — existing test still passes (receive() unchanged)
8. **Should allow owner to withdraw ETH** — pay appointment, then `withdrawEth()`, verify balance

### Setup pattern

```typescript
const priceFeedFactory = new MockPriceFeed__factory(owner);
const priceFeed = await priceFeedFactory.deploy();
const priceFeedAddress = await priceFeed.getAddress();
```

Identical to MockERC20 deployment pattern.

## Deploy Script Changes

Add after VetRegistry deployment and before summary:

```typescript
// 3. Deploy MockPriceFeed
console.log("Deploying MockPriceFeed...");
const priceFeedFactory = await ethers.getContractFactory("MockPriceFeed");
const priceFeed = await priceFeedFactory.deploy();
await priceFeed.waitForDeployment();
const priceFeedAddress = await priceFeed.getAddress();
console.log(`MockPriceFeed deployed to: ${priceFeedAddress}`);
```

Summary output should add:
```
console.log(`VITE_PRICE_FEED_ADDRESS=${priceFeedAddress}`);
```

### `dev.sh` changes

Add to the sed/append block (line ~113-116):
```bash
sed -i '/^VITE_PRICE_FEED_ADDRESS=/Id' "$ENV_FILE"
echo "VITE_PRICE_FEED_ADDRESS=$price_feed_address" >> "$ENV_FILE"
```

And extract the address from deploy output:
```bash
price_feed_address=$(echo "$deploy_output" | grep -oP 'VITE_PRICE_FEED_ADDRESS=\K(0x[a-fA-F0-9]{40})')
```

## Risks and Edge Cases

### 1. Stale Price Data
In production, Chainlink feeds have a heartbeat. Our mock will always return fresh data. The actual contract should check staleness:
```solidity
uint256 private constant MAX_DELAY = 2 hours;
require(block.timestamp - updatedAt <= MAX_DELAY, "Stale price");
```
This is out of scope for the mock but worth noting for a future production audit.

### 2. RoundId Semantics
Real Chainlink aggregators have specific round semantics (phaseId + roundId). Our mock uses a simple counter. Tests should NOT assert Chainlink-specific round behavior.

### 3. Price Feed Address Validation
`payAppointmentEth` takes an arbitrary `address priceFeed` parameter. A malicious price feed could return manipulated prices. In production this should be a contract constant or set by owner. For local dev, it's fine.

### 4. ETH Re-entrancy
Using `call{value: ...}("")` for refunds opens re-entrancy. However, the state is updated **before** the external call (CEI pattern), and the refund recipient is `msg.sender` who already paid. The refund is only for excess, not the principal. Still, follow CEI strictly.

### 5. Division Precision
`cents * 1e24 / price` truncates. For small amounts (e.g., $0.01 = 1 cent), the wei amount rounds to zero. This is acceptable at current ETH prices but could cause issues at very high ETH prices. **Mitigation**: require minimum payment floor, or document that sub-penny rounding is expected.

### 6. Gas Cost of `priceFeed.call()`
To avoid an external call to the price feed on every payment, the price could be cached/stored and updated periodically. This is a future optimization, not needed for local dev.

### 7. Gas Refund Calculation
The refund `call{value: ...}("")` costs additional gas. With the current formula, excess is exactly `msg.value - expectedEth`. No issues expected.

### 8. No `@chainlink/contracts` dependency
The project doesn't install `@chainlink/contracts`. The mock implements the interface manually (as an interface in `MockPriceFeed.sol` or inline). **We do NOT need to add the Chainlink npm package** — the mock is self-contained.

## Ready for Proposal

**Yes.** The analysis is complete, the formula is verified, all affected files are identified, tests are scoped, and risks are documented. Forward to `sdd-propose`.
