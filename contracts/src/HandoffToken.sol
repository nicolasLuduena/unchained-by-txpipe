// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IHandoffRegistry} from "./interfaces/IHandoffRegistry.sol";
import {IHandoffToken} from "./interfaces/IHandoffToken.sol";

/// @notice Wrapper token of one issuance, deployed by the registry. Mint and burn come only from the registry;
/// between holders every move goes through the hook in `_update`.
contract HandoffToken is ERC20, IHandoffToken {
    address public immutable override registry;

    modifier onlyRegistry() {
        if (msg.sender != registry) revert OnlyRegistry();
        _;
    }

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        registry = msg.sender;
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function mint(address to, uint256 amount) external onlyRegistry {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRegistry {
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) _checkHolderTransfer(from, to);
        super._update(from, to, value);
    }

    function _checkHolderTransfer(address from, address to) private view {
        IHandoffRegistry r = IHandoffRegistry(registry);
        if (r.tokenInfo(address(this)).paused) revert TokenPaused();
        if (r.isBlocked(address(this), from)) revert SenderBlocked(from);
        if (!r.isAttested(address(this), from)) revert SenderNotAttested(from);
        if (!r.isAttested(address(this), to)) revert ReceiverNotAttested(to);
        if (msg.sender != r.settlement()) revert NotRoutedThroughVenue(msg.sender);
    }

    /// @dev Allowances grant nothing here: the settlement is a trusted operator that needs none, and any other
    /// caller of transferFrom falls through to the hook and gets its named error.
    function _spendAllowance(address, address, uint256) internal pure override {}
}
