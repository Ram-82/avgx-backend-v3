
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title AVGXTimelock
 * @dev Timelock controller for AVGX protocol governance
 * @notice Enforces delays on critical protocol changes
 */
contract AVGXTimelock is TimelockController {
    /**
     * @dev Constructor initializes the timelock
     * @param minDelay Minimum delay for operations
     * @param proposers Array of addresses that can propose operations
     * @param executors Array of addresses that can execute operations
     * @param admin Admin address (can be zero to renounce admin rights)
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
        // TimelockController handles all initialization
    }
}
