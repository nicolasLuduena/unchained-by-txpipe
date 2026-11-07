// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @notice Throwaway verifier for the spike. Same domain and Order type as IHandoffSettlement.
contract SigProbe is EIP712("Handoff Settlement", "1") {
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(uint256 chainId,address token,address venue,address seller,uint256 amount,uint256 price,uint256 expiry,uint256 nonce)"
    );

    struct Order {
        uint256 chainId;
        address token;
        address venue;
        address seller;
        uint256 amount;
        uint256 price;
        uint256 expiry;
        uint256 nonce;
    }

    function hashOrder(Order calldata o) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(ORDER_TYPEHASH, o.chainId, o.token, o.venue, o.seller, o.amount, o.price, o.expiry, o.nonce)
            )
        );
    }

    event FillShape(address indexed account, uint256 allowance);

    /// @notice Stand-in for settlement.fill: proves approve and fill land in one executeBatch.
    function fillShape(address usdc) external {
        (bool ok, bytes memory ret) =
            usdc.staticcall(abi.encodeWithSignature("allowance(address,address)", msg.sender, address(this)));
        require(ok, "allowance");
        emit FillShape(msg.sender, abi.decode(ret, (uint256)));
    }

    /// @return direct isValidSignatureNow(signer, digest, sig)
    /// @return wrapped isValidSignatureNow(signer, toEthSignedMessageHash(digest), sig)
    function check(address signer, bytes32 digest, bytes calldata sig) external view returns (bool direct, bool wrapped) {
        direct = SignatureChecker.isValidSignatureNow(signer, digest, sig);
        wrapped = SignatureChecker.isValidSignatureNow(signer, MessageHashUtils.toEthSignedMessageHash(digest), sig);
    }
}
