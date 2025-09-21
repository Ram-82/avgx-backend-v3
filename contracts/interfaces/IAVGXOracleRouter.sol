
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAVGXOracleRouter
 * @dev Interface for the AVGX oracle router contract
 */
interface IAVGXOracleRouter {
    struct FeedConfig {
        address aggregator;
        bool invert;
        uint8 decimals;
        uint256 maxAge;
    }

    event FeedSet(bytes32 indexed assetId, address aggregator, bool invert, uint8 decimals);
    event MaxAgeUpdated(uint256 newMaxAge);

    error StalePrice(bytes32 assetId);
    error InvalidPrice(bytes32 assetId);
    error FeedNotFound(bytes32 assetId);

    /**
     * @dev Sets price feed configuration for an asset
     * @param assetId Unique identifier for the asset
     * @param aggregator Chainlink aggregator address
     * @param invert Whether to invert the price (1/price)
     * @param decimals Number of decimals in the price feed
     */
    function setFeed(bytes32 assetId, address aggregator, bool invert, uint8 decimals) external;

    /**
     * @dev Gets latest price for an asset in 1e18 format
     * @param assetId Asset identifier
     * @return price Latest price in 1e18 format
     * @return updatedAt Timestamp of last update
     */
    function latestPriceE18(bytes32 assetId) external view returns (uint256 price, uint256 updatedAt);

    /**
     * @dev Sets global maximum age for price feeds
     * @param maxAge Maximum age in seconds
     */
    function setMaxAge(uint256 maxAge) external;

    /**
     * @dev Gets feed configuration for an asset
     * @param assetId Asset identifier
     * @return config Feed configuration
     */
    function getFeedConfig(bytes32 assetId) external view returns (FeedConfig memory config);
}
