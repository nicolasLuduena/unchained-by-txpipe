// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Stateless settlement: no escrow, no balances, no fee.
/// EIP-712 domain: name "Handoff Settlement", version "1", chainId, verifyingContract = this.
/// Order type string:
///   Order(uint256 chainId,address token,address venue,address seller,uint256 amount,uint256 price,uint256 expiry,uint256 nonce)
/// Venue co-signature type string (signed by the venue's orderKey):
///   VenueFill(bytes32 orderHash,address buyer)
/// orderHash is the full EIP-712 digest returned by hashOrder.
interface IHandoffSettlement {
    struct Order {
        uint256 chainId;
        address token;
        address venue;
        address seller;
        uint256 amount; // whole token units, all-or-nothing
        uint256 price; // USDC base units per whole token unit
        uint256 expiry; // unix seconds
        uint256 nonce;
    }

    event OrderAnnounced(bytes32 indexed orderHash, address indexed token, address indexed venue, address seller, uint256 amount, uint256 price, uint256 expiry, uint256 nonce);
    event OrderCancelled(address indexed seller, uint256 indexed nonce);
    event OrderFilled(bytes32 indexed orderHash, address indexed token, address indexed venue, address seller, address buyer, uint256 amount, uint256 price, uint256 nonce);

    error WrongChain(uint256 chainId);
    error OrderExpired(uint256 expiry);
    error OrderCancelledError(address seller, uint256 nonce);
    error OrderAlreadyFilled(address seller, uint256 nonce);
    error InvalidSellerSignature(address seller);
    error VenueNotAllowed(address token, address venue);
    error InvalidVenueSignature(address venue);
    error NotOrderKey(address caller);
    error TradingDisabled(address token);
    error BandNotSet(address token);
    error PriceStale(uint64 timestamp, uint64 maxAge);
    error PriceOutOfBand(uint256 price, uint256 low, uint256 high);
    error ZeroAmount();

    function registry() external view returns (address);
    function usdc() external view returns (address);

    function hashOrder(Order calldata order) external view returns (bytes32);
    function hashVenueFill(bytes32 orderHash, address buyer) external view returns (bytes32);

    /// @notice Called by the venue's order key when an order is posted, so every order reaches the feed as an event.
    function announceOrder(Order calldata order, bytes calldata sellerSig) external;

    /// @notice msg.sender is the buyer. Pulls tokens from the seller and USDC from the buyer in one transaction.
    function fill(Order calldata order, bytes calldata sellerSig, bytes calldata venueSig) external;

    /// @notice msg.sender is the seller.
    function cancel(uint256 nonce) external;

    function cancelled(address seller, uint256 nonce) external view returns (bool);
    function filled(address seller, uint256 nonce) external view returns (bool);
}
