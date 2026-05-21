// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MockPriceFeed
 * @notice Minimal Chainlink AggregatorV3Interface mock for Hardhat testing (8 decimals).
 * Default price: 2000 USD/ETH (2000 * 1e8). Matches MockERC20 pattern:
 * MIT license, no imports, self-contained, open access.
 */
contract MockPriceFeed {
    uint8 private _decimals = 8;
    string private _description = "ETH / USD";
    uint256 private _version = 1;
    int256 private _answer = 2000 * 1e8; // $2000/ETH default
    uint256 private _updatedAt;
    uint80 private _roundId = 1;

    event PriceUpdated(int256 newAnswer, uint256 timestamp);

    /**
     * @notice Set the current ETH/USD price
     * @param newAnswer New price in 8 decimals (e.g. 2000 * 1e8 for $2000/ETH)
     */
    function setPrice(int256 newAnswer) external {
        _answer = newAnswer;
        _roundId++;
        _updatedAt = block.timestamp;
        emit PriceUpdated(newAnswer, block.timestamp);
    }

    /// @return Number of decimals in the price (8 to match Chainlink ETH/USD)
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    /// @return Human-readable description
    function description() external view returns (string memory) {
        return _description;
    }

    /// @return Version number
    function version() external view returns (uint256) {
        return _version;
    }

    /**
     * @notice Get the latest round data
     * @return roundId Round ID (auto-incremented on setPrice)
     * @return answer Current price in 8 decimals
     * @return startedAt Always 0 in mock
     * @return updatedAt Timestamp of last update
     * @return answeredInRound Same as roundId
     */
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_roundId, _answer, 0, _updatedAt, _roundId);
    }

    /**
     * @notice Get round data for a specific round (same as latest in mock)
     */
    function getRoundData(uint80)
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_roundId, _answer, 0, _updatedAt, _roundId);
    }
}
