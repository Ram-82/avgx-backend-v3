
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./libraries/Roles.sol";

/**
 * @title AVGXAccessController
 * @dev Centralized access control for the AVGX protocol
 * @notice Manages roles and permissions across all AVGX contracts
 */
contract AVGXAccessController is AccessControl {
    using Roles for uint256;

    event RoleGrantedBatch(bytes32 indexed role, address[] accounts);
    event RoleRevokedBatch(bytes32 indexed role, address[] accounts);

    /**
     * @dev Constructor sets up initial admin
     * @param admin Initial admin address
     */
    constructor(address admin) {
        Roles.validateAddress(admin);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Roles.GOVERNOR_ROLE, admin);
    }

    /**
     * @dev Grants a role to multiple accounts
     * @param role Role to grant
     * @param accounts Array of accounts to grant role to
     */
    function grantRoleBatch(bytes32 role, address[] calldata accounts) external onlyRole(getRoleAdmin(role)) {
        for (uint256 i = 0; i < accounts.length; i++) {
            _grantRole(role, accounts[i]);
        }
        emit RoleGrantedBatch(role, accounts);
    }

    /**
     * @dev Revokes a role from multiple accounts
     * @param role Role to revoke
     * @param accounts Array of accounts to revoke role from
     */
    function revokeRoleBatch(bytes32 role, address[] calldata accounts) external onlyRole(getRoleAdmin(role)) {
        for (uint256 i = 0; i < accounts.length; i++) {
            _revokeRole(role, accounts[i]);
        }
        emit RoleRevokedBatch(role, accounts);
    }

    /**
     * @dev Checks if an account has any of the specified roles
     * @param account Account to check
     * @param roles Array of roles to check
     * @return hasAnyRole True if account has any of the roles
     */
    function hasAnyRole(address account, bytes32[] calldata roles) external view returns (bool hasAnyRole) {
        for (uint256 i = 0; i < roles.length; i++) {
            if (hasRole(roles[i], account)) {
                return true;
            }
        }
        return false;
    }
}
