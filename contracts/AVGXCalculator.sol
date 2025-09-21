
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IAVGXCalculator.sol";
import "./interfaces/IAVGXOracleRouter.sol";
import "./libraries/Roles.sol";
import "./libraries/FixedPointMath.sol";

/**
 * @title AVGXCalculator
 * @dev Calculates the AVGX index from weighted baskets of fiat and crypto assets
 * @notice Implements the formula: AVGX = sqrt(WF * WC) where WF and WC are weighted averages
 */
contract AVGXCalculator is AccessControl, Pausable, IAVGXCalculator {
    using Roles for uint256;
    using FixedPointMath for uint256;

    IAVGXOracleRouter public immutable oracleRouter;
    
    Component[] private _fiatComponents;
    Component[] private _cryptoComponents;
    
    mapping(bytes32 => uint256) private _fiatIndexes;
    mapping(bytes32 => uint256) private _cryptoIndexes;

    /**
     * @dev Constructor initializes the calculator
     * @param accessController Address of the access controller
     * @param oracleRouter_ Address of the oracle router
     */
    constructor(address accessController, address oracleRouter_) {
        accessController.validateAddress();
        oracleRouter_.validateAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, accessController);
        oracleRouter = IAVGXOracleRouter(oracleRouter_);
    }

    /**
     * @dev Calculates current AVGX index value
     * @return priceE18 Index value in 1e18 format
     */
    function currentIndex() external view whenNotPaused returns (uint256 priceE18) {
        uint256 wf = _calculateWeightedAverage(_fiatComponents);
        uint256 wc = _calculateWeightedAverage(_cryptoComponents);
        
        // AVGX = sqrt(WF * WC)
        uint256 product = wf.mul(wc);
        priceE18 = product.sqrt();
    }

    /**
     * @dev Adds a fiat component to the index
     * @param assetId Asset identifier
     * @param weightBps Weight in basis points
     * @param decimals Price feed decimals
     */
    function addFiatComponent(
        bytes32 assetId, 
        uint256 weightBps, 
        uint8 decimals
    ) external onlyRole(Roles.GOVERNOR_ROLE) {
        _addComponent(assetId, weightBps, decimals, true);
        emit FiatComponentAdded(assetId, weightBps);
    }

    /**
     * @dev Adds a crypto component to the index
     * @param assetId Asset identifier
     * @param weightBps Weight in basis points
     * @param decimals Price feed decimals
     */
    function addCryptoComponent(
        bytes32 assetId, 
        uint256 weightBps, 
        uint8 decimals
    ) external onlyRole(Roles.GOVERNOR_ROLE) {
        _addComponent(assetId, weightBps, decimals, false);
        emit CryptoComponentAdded(assetId, weightBps);
    }

    /**
     * @dev Removes a component from the index
     * @param assetId Asset identifier
     * @param isFiat Whether the component is fiat
     */
    function removeComponent(bytes32 assetId, bool isFiat) external onlyRole(Roles.GOVERNOR_ROLE) {
        if (isFiat) {
            uint256 index = _fiatIndexes[assetId];
            if (index == 0) revert ComponentNotFound();
            
            _fiatComponents[index - 1] = _fiatComponents[_fiatComponents.length - 1];
            _fiatIndexes[_fiatComponents[index - 1].assetId] = index;
            _fiatComponents.pop();
            delete _fiatIndexes[assetId];
        } else {
            uint256 index = _cryptoIndexes[assetId];
            if (index == 0) revert ComponentNotFound();
            
            _cryptoComponents[index - 1] = _cryptoComponents[_cryptoComponents.length - 1];
            _cryptoIndexes[_cryptoComponents[index - 1].assetId] = index;
            _cryptoComponents.pop();
            delete _cryptoIndexes[assetId];
        }
        
        emit ComponentRemoved(assetId, isFiat);
    }

    /**
     * @dev Updates component weight
     * @param assetId Asset identifier
     * @param weightBps New weight in basis points
     * @param isFiat Whether the component is fiat
     */
    function updateComponentWeight(
        bytes32 assetId, 
        uint256 weightBps, 
        bool isFiat
    ) external onlyRole(Roles.GOVERNOR_ROLE) {
        weightBps.validateBPS();
        
        if (isFiat) {
            uint256 index = _fiatIndexes[assetId];
            if (index == 0) revert ComponentNotFound();
            _fiatComponents[index - 1].weightBps = weightBps;
        } else {
            uint256 index = _cryptoIndexes[assetId];
            if (index == 0) revert ComponentNotFound();
            _cryptoComponents[index - 1].weightBps = weightBps;
        }
        
        _validateWeights();
        emit ComponentsUpdated(_fiatComponents, _cryptoComponents);
    }

    /**
     * @dev Gets all fiat components
     * @return components Array of fiat components
     */
    function getFiatComponents() external view returns (Component[] memory components) {
        return _fiatComponents;
    }

    /**
     * @dev Gets all crypto components
     * @return components Array of crypto components
     */
    function getCryptoComponents() external view returns (Component[] memory components) {
        return _cryptoComponents;
    }

    /**
     * @dev Gets total weight for fiat components
     * @return totalWeight Total weight in basis points
     */
    function getTotalFiatWeight() external view returns (uint256 totalWeight) {
        for (uint256 i = 0; i < _fiatComponents.length; i++) {
            totalWeight += _fiatComponents[i].weightBps;
        }
    }

    /**
     * @dev Gets total weight for crypto components
     * @return totalWeight Total weight in basis points
     */
    function getTotalCryptoWeight() external view returns (uint256 totalWeight) {
        for (uint256 i = 0; i < _cryptoComponents.length; i++) {
            totalWeight += _cryptoComponents[i].weightBps;
        }
    }

    /**
     * @dev Pauses the calculator
     */
    function pause() external onlyRole(Roles.PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses the calculator
     */
    function unpause() external onlyRole(Roles.PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Internal function to add a component
     */
    function _addComponent(bytes32 assetId, uint256 weightBps, uint8 decimals, bool isFiat) internal {
        weightBps.validateBPS();
        
        if (isFiat) {
            if (_fiatIndexes[assetId] != 0) revert DuplicateComponent();
            _fiatComponents.push(Component({
                assetId: assetId,
                weightBps: weightBps,
                decimals: decimals
            }));
            _fiatIndexes[assetId] = _fiatComponents.length;
        } else {
            if (_cryptoIndexes[assetId] != 0) revert DuplicateComponent();
            _cryptoComponents.push(Component({
                assetId: assetId,
                weightBps: weightBps,
                decimals: decimals
            }));
            _cryptoIndexes[assetId] = _cryptoComponents.length;
        }
        
        _validateWeights();
        emit ComponentsUpdated(_fiatComponents, _cryptoComponents);
    }

    /**
     * @dev Validates that weights sum to 10,000 BPS
     */
    function _validateWeights() internal view {
        uint256 fiatTotal = 0;
        uint256 cryptoTotal = 0;
        
        for (uint256 i = 0; i < _fiatComponents.length; i++) {
            fiatTotal += _fiatComponents[i].weightBps;
        }
        
        for (uint256 i = 0; i < _cryptoComponents.length; i++) {
            cryptoTotal += _cryptoComponents[i].weightBps;
        }
        
        if (fiatTotal != Roles.BPS || cryptoTotal != Roles.BPS) {
            revert InvalidWeights();
        }
    }

    /**
     * @dev Calculates weighted average for a basket of components
     */
    function _calculateWeightedAverage(Component[] memory components) internal view returns (uint256 weightedSum) {
        uint256 totalWeight = 0;
        
        for (uint256 i = 0; i < components.length; i++) {
            (uint256 price,) = oracleRouter.latestPriceE18(components[i].assetId);
            uint256 weightedPrice = price.mul(components[i].weightBps * FixedPointMath.ONE / Roles.BPS);
            weightedSum += weightedPrice;
            totalWeight += components[i].weightBps;
        }
        
        if (totalWeight > 0) {
            weightedSum = weightedSum / (totalWeight / Roles.BPS);
        }
    }
}
