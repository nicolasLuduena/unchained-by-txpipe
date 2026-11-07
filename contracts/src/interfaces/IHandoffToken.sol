// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice ERC-20 wrapper with a transfer hook. decimals() is 0: one unit is one whole certificate fraction.
/// Between holders the hook checks, in this order: paused, blocked sender, sender attested, receiver attested,
/// then routing (msg.sender must be the registry's settlement contract, which needs no allowance).
interface IHandoffToken is IERC20 {
    error TokenPaused();
    error SenderBlocked(address holder);
    error SenderNotAttested(address sender);
    error ReceiverNotAttested(address receiver);
    error NotRoutedThroughVenue(address caller);
    error OnlyRegistry();

    function registry() external view returns (address);
    function mint(address to, uint256 amount) external; // only registry
    function burn(address from, uint256 amount) external; // only registry
}
