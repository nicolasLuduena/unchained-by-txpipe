// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IHandoffRegistry} from "./interfaces/IHandoffRegistry.sol";
import {IHandoffSettlement} from "./interfaces/IHandoffSettlement.sol";

contract HandoffSettlement is IHandoffSettlement, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(uint256 chainId,address token,address venue,address seller,uint256 amount,uint256 price,uint256 expiry,uint256 nonce)"
    );
    bytes32 private constant VENUE_FILL_TYPEHASH = keccak256("VenueFill(bytes32 orderHash,address buyer)");
    uint256 private constant BPS = 10_000;

    address public immutable override registry;
    address public immutable override usdc;

    mapping(address seller => mapping(uint256 nonce => bool)) public override cancelled;
    mapping(address seller => mapping(uint256 nonce => bool)) public override filled;

    constructor(address registry_, address usdc_) EIP712("Handoff Settlement", "1") {
        registry = registry_;
        usdc = usdc_;
    }

    function hashOrder(Order calldata order) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ORDER_TYPEHASH, order)));
    }

    function hashVenueFill(bytes32 orderHash, address buyer) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(VENUE_FILL_TYPEHASH, orderHash, buyer)));
    }

    function announceOrder(Order calldata order, bytes calldata sellerSig) external {
        if (msg.sender != _orderKey(order)) revert NotOrderKey(msg.sender);
        bytes32 orderHash = hashOrder(order);
        if (!_isSellerSignature(order.seller, orderHash, sellerSig)) revert InvalidSellerSignature(order.seller);
        emit OrderAnnounced(
            orderHash, order.token, order.venue, order.seller, order.amount, order.price, order.expiry, order.nonce
        );
    }

    function fill(Order calldata order, bytes calldata sellerSig, bytes calldata venueSig) external {
        if (order.amount == 0) revert ZeroAmount();
        if (order.chainId != block.chainid) revert WrongChain(order.chainId);
        if (block.timestamp > order.expiry) revert OrderExpired(order.expiry);
        if (cancelled[order.seller][order.nonce]) revert OrderCancelledError(order.seller, order.nonce);
        if (filled[order.seller][order.nonce]) revert OrderAlreadyFilled(order.seller, order.nonce);

        address orderKey = _orderKey(order);
        bytes32 orderHash = hashOrder(order);
        if (!_isSellerSignature(order.seller, orderHash, sellerSig)) revert InvalidSellerSignature(order.seller);
        (address venueSigner,,) = ECDSA.tryRecover(hashVenueFill(orderHash, msg.sender), venueSig);
        if (venueSigner != orderKey) revert InvalidVenueSignature(order.venue);

        _checkBand(order.token, order.price);

        filled[order.seller][order.nonce] = true;
        IERC20(order.token).safeTransferFrom(order.seller, msg.sender, order.amount);
        IERC20(usdc).safeTransferFrom(msg.sender, order.seller, order.amount * order.price);
        emit OrderFilled(
            orderHash, order.token, order.venue, order.seller, msg.sender, order.amount, order.price, order.nonce
        );
    }

    function cancel(uint256 nonce) external {
        cancelled[msg.sender][nonce] = true;
        emit OrderCancelled(msg.sender, nonce);
    }

    /// @dev The one place that decides what a seller signature is. The smart-account SDK signs through
    /// signMessage(digest), so both the raw digest and its EIP-191 wrapping are accepted.
    function _isSellerSignature(address seller, bytes32 digest, bytes calldata sig) internal view returns (bool) {
        return SignatureChecker.isValidSignatureNow(seller, digest, sig)
            || SignatureChecker.isValidSignatureNow(seller, MessageHashUtils.toEthSignedMessageHash(digest), sig);
    }

    function _orderKey(Order calldata order) private view returns (address orderKey) {
        orderKey = IHandoffRegistry(registry).venueKey(order.token, order.venue);
        if (orderKey == address(0)) revert VenueNotAllowed(order.token, order.venue);
    }

    function _checkBand(address token, uint256 price) private view {
        IHandoffRegistry r = IHandoffRegistry(registry);
        IHandoffRegistry.TokenInfo memory info = r.tokenInfo(token);
        if (!info.tradingEnabled) revert TradingDisabled(token);

        IHandoffRegistry.Band memory b = r.band(token);
        if (b.price == 0) revert BandNotSet(token);
        if (b.maxAge != 0 && block.timestamp > uint256(b.timestamp) + b.maxAge) revert PriceStale(b.timestamp, b.maxAge);

        uint256 low = b.price * (BPS - b.widthBps) / BPS;
        uint256 high = b.price * (BPS + b.widthBps) / BPS;
        if (low < info.floor) low = info.floor;
        if (price < low || price > high) revert PriceOutOfBand(price, low, high);
    }
}
