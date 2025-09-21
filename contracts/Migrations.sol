
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Migrations
 * @dev Contract for tracking deployment migrations
 */
contract Migrations {
    address public owner = msg.sender;
    uint256 public lastCompletedMigration;

    modifier restricted() {
        require(msg.sender == owner, "Migrations: Caller is not the owner");
        _;
    }

    function setCompleted(uint256 completed) public restricted {
        lastCompletedMigration = completed;
    }
}
