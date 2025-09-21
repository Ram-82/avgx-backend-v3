
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/Roles.sol";

/**
 * @title AVGXVault
 * @dev Vault contract for holding base asset reserves
 * @notice Manages protocol liquidity and collects fees
 */
contract AVGXVault is AccessControl {
    using SafeERC20 for IERC20;
    using Roles for address;

    IERC20 public immutable baseAsset;
    address public immutable amm;

    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);

    error OnlyAMM();
    error InsufficientBalance();

    modifier onlyAMM() {
        if (msg.sender != amm) revert OnlyAMM();
        _;
    }

    /**
     * @dev Constructor initializes the vault
     * @param accessController Address of the access controller
     * @param baseAsset_ Address of the base asset
     * @param amm_ Address of the AMM contract
     */
    constructor(address accessController, address baseAsset_, address amm_) {
        accessController.validateAddress();
        baseAsset_.validateAddress();
        amm_.validateAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, accessController);
        baseAsset = IERC20(baseAsset_);
        amm = amm_;
    }

    /**
     * @dev Deposits base asset into the vault
     * @param amount Amount to deposit
     */
    function deposit(uint256 amount) external onlyRole(Roles.GOVERNOR_ROLE) {
        require(amount > 0, "AVGXVault: Invalid amount");
        baseAsset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }

    /**
     * @dev Withdraws base asset from the vault (governor only)
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdraw(address to, uint256 amount) external {
        if (msg.sender != amm && !hasRole(Roles.GOVERNOR_ROLE, msg.sender)) {
            revert OnlyAMM();
        }
        
        to.validateAddress();
        require(amount > 0, "AVGXVault: Invalid amount");
        
        uint256 balance = baseAsset.balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance();
        
        baseAsset.safeTransfer(to, amount);
        emit Withdraw(to, amount);
    }

    /**
     * @dev Gets current vault balance
     * @return balance Current balance of base asset
     */
    function getBalance() external view returns (uint256 balance) {
        return baseAsset.balanceOf(address(this));
    }
}
