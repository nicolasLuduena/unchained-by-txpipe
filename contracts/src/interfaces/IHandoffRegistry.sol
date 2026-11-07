// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Issuer registry. One entry per wrapper token. The PSAV (a venue address) and the issuer operate it.
/// All administrative actions live here so the console talks to one contract and the feed reads one event source.
interface IHandoffRegistry {
    struct RegisterParams {
        string name;
        string symbol;
        string depositRef; // art. 5 b: reference of the immobilized deposit
        string cnvAuthRef; // art. 5 g: CNV authorization reference, required
        bytes32 issuanceDocHash; // art. 12
        uint256 authorizedSupply; // arts. 10 and 17: mint and re-mint stay within this, whole units
        address[] attesters; // attestation stores this token trusts
        uint8 flags; // eligibility flags, stored and not enforced
    }

    struct Band {
        uint256 price; // reference price, USDC base units (6 decimals) per whole token unit
        uint64 timestamp; // when the reference was set
        uint16 widthBps; // band half-width in basis points
        uint64 maxAge; // seconds; 0 disables the staleness check
    }

    struct TokenInfo {
        address issuer;
        string depositRef;
        string cnvAuthRef;
        bytes32 issuanceDocHash;
        uint256 authorizedSupply;
        uint8 flags;
        bool tradingEnabled; // issuer opt-in; opt-out disables trading entirely
        bool paused; // art. 36
        uint256 floor; // optional floor, USDC base units; 0 means none
    }

    // Eligibility flags
    // FLAG_QUALIFIED_ONLY = 1, FLAG_CROWDFUNDING_CAPPED = 2

    event TokenRegistered(address indexed token, address indexed issuer, string name, string symbol, string cnvAuthRef, bytes32 issuanceDocHash);
    event SettlementSet(address indexed settlement);
    event VenueAdded(address indexed token, address indexed venue, address orderKey);
    event VenueRemoved(address indexed token, address indexed venue);
    event VenueRepointed(address indexed token, address indexed oldVenue, address indexed newVenue, address newOrderKey);
    event AttesterSet(address indexed token, address indexed attester, bool trusted);
    event BandSet(address indexed token, uint256 price, uint16 widthBps, uint64 maxAge);
    event FloorSet(address indexed token, uint256 floor);
    event TradingSet(address indexed token, bool enabled);
    event PausedSet(address indexed token, bool paused, address indexed by);
    event Minted(address indexed token, address indexed to, uint256 amount);
    event HolderBlocked(address indexed token, address indexed holder, bool blocked, address indexed by);
    /// @notice Art. 16: units burned against a paper certificate.
    event Reversion(address indexed token, address indexed holder, uint256 amount, string certificateRef, bytes32 docHash, address indexed venue);

    error NotOwner();
    error MissingAuthorizationRef();
    error IssuerNotBusiness(address issuer);
    error UnknownToken(address token);
    error NotIssuer(address caller);
    error NotVenue(address caller);
    error NotIssuerOrVenue(address caller);
    error NotAuthorized(address caller);
    error VenueCapReached();
    error VenueAlreadyListed(address venue);
    error VenueNotListed(address venue);
    error ZeroAddress();
    error SupplyExceeded(uint256 requested, uint256 authorized);
    error ReceiverNotAttested(address receiver);
    error InvalidBandWidth(uint16 widthBps);

    function MAX_VENUES() external view returns (uint256);
    function owner() external view returns (address);
    function issuerAttester() external view returns (address);
    function settlement() external view returns (address);

    /// @notice Owner sets the settlement contract, the only route through which units move between holders.
    function setSettlement(address settlement_) external;

    /// @notice Requires a non-empty cnvAuthRef and a business attestation on msg.sender in issuerAttester.
    /// Deploys the wrapper token. Trading starts enabled once a band is set.
    function registerToken(RegisterParams calldata p) external returns (address token);

    // Issuer
    function addVenue(address token, address venue, address orderKey) external;
    function removeVenue(address token, address venue) external;
    function setAttester(address token, address attester, bool trusted) external;
    function setFloor(address token, uint256 floor) external;
    function setTradingEnabled(address token, bool enabled) external;
    function mint(address token, address to, uint256 amount) external;

    // Issuer or venue
    function setBand(address token, uint256 price, uint16 widthBps, uint64 maxAge) external;
    function setPaused(address token, bool paused) external;

    // Registry owner, issuer, or the old venue itself (art. 30 b)
    function repointVenue(address token, address oldVenue, address newVenue, address newOrderKey) external;

    // Venue only (PSAV)
    function setBlocked(address token, address holder, bool blocked) external; // arts. 16 and 19
    function revertToPaper(address token, address holder, uint256 amount, string calldata certificateRef, bytes32 docHash) external; // art. 16

    // Reads
    function tokenCount() external view returns (uint256);
    function tokenAt(uint256 index) external view returns (address);
    function isRegistered(address token) external view returns (bool);
    function tokenInfo(address token) external view returns (TokenInfo memory);
    function band(address token) external view returns (Band memory);
    function venues(address token) external view returns (address[] memory);
    /// @notice The order-service key of a venue; address(0) when the venue is not allowlisted for this token.
    function venueKey(address token, address venue) external view returns (address);
    function attesters(address token) external view returns (address[] memory);
    function isBlocked(address token, address holder) external view returns (bool);
    /// @notice True when any attester in the token's set verifies the account as person, business or agent (tier 2 to 5).
    function isAttested(address token, address account) external view returns (bool);
}
