// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {HandoffToken} from "./HandoffToken.sol";
import {IAttestationStore} from "./interfaces/IAttestationStore.sol";
import {IHandoffRegistry} from "./interfaces/IHandoffRegistry.sol";

contract HandoffRegistry is IHandoffRegistry {
    uint256 public constant override MAX_VENUES = 5;
    uint16 private constant BPS = 10_000;

    uint32 private constant TIER_PERSON_MIN = 2;
    uint32 private constant TIER_BUSINESS = 4;
    uint32 private constant TIER_AGENT = 5;

    address public immutable override owner;
    address public immutable override issuerAttester;
    address public override settlement;

    address[] private _tokenList;
    mapping(address token => TokenInfo) private _info;
    mapping(address token => Band) private _bands;
    mapping(address token => address[]) private _venues;
    mapping(address token => mapping(address venue => address orderKey)) private _venueKeys;
    mapping(address token => address[]) private _attesters;
    mapping(address token => mapping(address attester => bool)) private _trusted;
    mapping(address token => mapping(address holder => bool)) private _blocked;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyIssuer(address token) {
        _requireKnown(token);
        if (msg.sender != _info[token].issuer) revert NotIssuer(msg.sender);
        _;
    }

    modifier onlyVenue(address token) {
        _requireKnown(token);
        if (_venueKeys[token][msg.sender] == address(0)) revert NotVenue(msg.sender);
        _;
    }

    modifier onlyIssuerOrVenue(address token) {
        _requireKnown(token);
        if (msg.sender != _info[token].issuer && _venueKeys[token][msg.sender] == address(0)) {
            revert NotIssuerOrVenue(msg.sender);
        }
        _;
    }

    constructor(address owner_, address issuerAttester_) {
        if (owner_ == address(0) || issuerAttester_ == address(0)) revert ZeroAddress();
        owner = owner_;
        issuerAttester = issuerAttester_;
    }

    function setSettlement(address settlement_) external onlyOwner {
        if (settlement_ == address(0)) revert ZeroAddress();
        settlement = settlement_;
        emit SettlementSet(settlement_);
    }

    function registerToken(RegisterParams calldata p) external returns (address token) {
        if (bytes(p.cnvAuthRef).length == 0) revert MissingAuthorizationRef();
        (bool verified, uint32 tier,,) = IAttestationStore(issuerAttester).verify(msg.sender);
        if (!verified || tier != TIER_BUSINESS) revert IssuerNotBusiness(msg.sender);

        token = address(new HandoffToken(p.name, p.symbol));
        _tokenList.push(token);
        _info[token] = TokenInfo({
            issuer: msg.sender,
            depositRef: p.depositRef,
            cnvAuthRef: p.cnvAuthRef,
            issuanceDocHash: p.issuanceDocHash,
            authorizedSupply: p.authorizedSupply,
            flags: p.flags,
            tradingEnabled: true,
            paused: false,
            floor: 0
        });
        emit TokenRegistered(token, msg.sender, p.name, p.symbol, p.cnvAuthRef, p.issuanceDocHash);

        for (uint256 i; i < p.attesters.length; ++i) {
            _setAttester(token, p.attesters[i], true);
        }
    }

    // Issuer

    function addVenue(address token, address venue, address orderKey) external onlyIssuer(token) {
        if (venue == address(0) || orderKey == address(0)) revert ZeroAddress();
        if (_venueKeys[token][venue] != address(0)) revert VenueAlreadyListed(venue);
        if (_venues[token].length == MAX_VENUES) revert VenueCapReached();
        _venues[token].push(venue);
        _venueKeys[token][venue] = orderKey;
        emit VenueAdded(token, venue, orderKey);
    }

    function removeVenue(address token, address venue) external onlyIssuer(token) {
        address[] storage list = _venues[token];
        list[_venueIndex(token, venue)] = list[list.length - 1];
        list.pop();
        delete _venueKeys[token][venue];
        emit VenueRemoved(token, venue);
    }

    function setAttester(address token, address attester, bool trusted) external onlyIssuer(token) {
        _setAttester(token, attester, trusted);
    }

    function setFloor(address token, uint256 floor) external onlyIssuer(token) {
        _info[token].floor = floor;
        emit FloorSet(token, floor);
    }

    function setTradingEnabled(address token, bool enabled) external onlyIssuer(token) {
        _info[token].tradingEnabled = enabled;
        emit TradingSet(token, enabled);
    }

    function mint(address token, address to, uint256 amount) external onlyIssuer(token) {
        if (!isAttested(token, to)) revert ReceiverNotAttested(to);
        uint256 requested = HandoffToken(token).totalSupply() + amount;
        uint256 authorized = _info[token].authorizedSupply;
        if (requested > authorized) revert SupplyExceeded(requested, authorized);
        HandoffToken(token).mint(to, amount);
        emit Minted(token, to, amount);
    }

    // Issuer or venue

    function setBand(address token, uint256 price, uint16 widthBps, uint64 maxAge) external onlyIssuerOrVenue(token) {
        if (widthBps > BPS) revert InvalidBandWidth(widthBps);
        _bands[token] = Band({price: price, timestamp: uint64(block.timestamp), widthBps: widthBps, maxAge: maxAge});
        emit BandSet(token, price, widthBps, maxAge);
    }

    function setPaused(address token, bool paused) external onlyIssuerOrVenue(token) {
        _info[token].paused = paused;
        emit PausedSet(token, paused, msg.sender);
    }

    // Registry owner, issuer, or the old venue itself

    function repointVenue(address token, address oldVenue, address newVenue, address newOrderKey) external {
        _requireKnown(token);
        if (msg.sender != owner && msg.sender != _info[token].issuer && msg.sender != oldVenue) {
            revert NotAuthorized(msg.sender);
        }
        if (newVenue == address(0) || newOrderKey == address(0)) revert ZeroAddress();
        uint256 index = _venueIndex(token, oldVenue);
        // newVenue == oldVenue is a key rotation.
        if (newVenue != oldVenue && _venueKeys[token][newVenue] != address(0)) revert VenueAlreadyListed(newVenue);
        _venues[token][index] = newVenue;
        delete _venueKeys[token][oldVenue];
        _venueKeys[token][newVenue] = newOrderKey;
        emit VenueRepointed(token, oldVenue, newVenue, newOrderKey);
    }

    // Venue only

    function setBlocked(address token, address holder, bool blocked) external onlyVenue(token) {
        _blocked[token][holder] = blocked;
        emit HolderBlocked(token, holder, blocked, msg.sender);
    }

    function revertToPaper(address token, address holder, uint256 amount, string calldata certificateRef, bytes32 docHash)
        external
        onlyVenue(token)
    {
        HandoffToken(token).burn(holder, amount);
        emit Reversion(token, holder, amount, certificateRef, docHash, msg.sender);
    }

    // Reads

    function tokenCount() external view returns (uint256) {
        return _tokenList.length;
    }

    function tokenAt(uint256 index) external view returns (address) {
        return _tokenList[index];
    }

    function isRegistered(address token) public view returns (bool) {
        return _info[token].issuer != address(0);
    }

    function tokenInfo(address token) external view returns (TokenInfo memory) {
        return _info[token];
    }

    function band(address token) external view returns (Band memory) {
        return _bands[token];
    }

    function venues(address token) external view returns (address[] memory) {
        return _venues[token];
    }

    function venueKey(address token, address venue) external view returns (address) {
        return _venueKeys[token][venue];
    }

    function attesters(address token) external view returns (address[] memory) {
        return _attesters[token];
    }

    function isBlocked(address token, address holder) external view returns (bool) {
        return _blocked[token][holder];
    }

    function isAttested(address token, address account) public view returns (bool) {
        address[] storage list = _attesters[token];
        for (uint256 i; i < list.length; ++i) {
            (bool verified, uint32 tier,,) = IAttestationStore(list[i]).verify(account);
            if (verified && tier >= TIER_PERSON_MIN && tier <= TIER_AGENT) return true;
        }
        return false;
    }

    // Internals

    function _requireKnown(address token) private view {
        if (!isRegistered(token)) revert UnknownToken(token);
    }

    function _venueIndex(address token, address venue) private view returns (uint256) {
        address[] storage list = _venues[token];
        for (uint256 i; i < list.length; ++i) {
            if (list[i] == venue) return i;
        }
        revert VenueNotListed(venue);
    }

    function _setAttester(address token, address attester, bool trusted) private {
        if (attester == address(0)) revert ZeroAddress();
        if (_trusted[token][attester] == trusted) return;
        _trusted[token][attester] = trusted;
        address[] storage list = _attesters[token];
        if (trusted) {
            list.push(attester);
        } else {
            for (uint256 i; i < list.length; ++i) {
                if (list[i] == attester) {
                    list[i] = list[list.length - 1];
                    list.pop();
                    break;
                }
            }
        }
        emit AttesterSet(token, attester, trusted);
    }
}
