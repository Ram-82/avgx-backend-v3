
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IAVGXOracleRouter.sol";

/**
 * @title MockOracleRouter
 * @dev Mock oracle router for testing
 */
contract MockOracleRouter is IAVGXOracleRouter {
    mapping(bytes32 => uint256) private _prices;
    mapping(bytes32 => uint256) private _timestamps;
    mapping(bytes32 => FeedConfig) private _feeds;

    function setFeed(bytes32 assetId, address aggregator, bool invert, uint8 decimals) external override {
        _feeds[assetId] = FeedConfig({
            aggregator: aggregator,
            invert: invert,
            decimals: decimals,
            maxAge: 3600
        });
        emit FeedSet(assetId, aggregator, invert, decimals);
    }

    function setMaxAge(uint256) external override {
        emit MaxAgeUpdated(3600);
    }

    function pushPrice(bytes32 assetId, uint256 price) external {
        _prices[assetId] = price;
        _timestamps[assetId] = block.timestamp;
    }

    function latestPriceE18(bytes32 assetId) external view override returns (uint256 price, uint256 updatedAt) {
        price = _prices[assetId];
        updatedAt = _timestamps[assetId];
        
        if (price == 0) revert InvalidPrice(assetId);
        if (block.timestamp - updatedAt > 3600) revert StalePrice(assetId);
    }

    function getFeedConfig(bytes32 assetId) external view override returns (FeedConfig memory) {
        return _feeds[assetId];
    }
}
