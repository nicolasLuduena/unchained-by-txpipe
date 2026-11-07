// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice A minimal smart account: a signature is valid when the owner key signed exactly the hash it is shown.
contract MockERC1271Account is IERC1271 {
    address public immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (address signer,,) = ECDSA.tryRecover(hash, signature);
        return signer == owner ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}
