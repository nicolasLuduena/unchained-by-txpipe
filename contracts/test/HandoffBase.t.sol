// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {HandoffRegistry} from "../src/HandoffRegistry.sol";
import {HandoffSettlement} from "../src/HandoffSettlement.sol";
import {HandoffToken} from "../src/HandoffToken.sol";
import {IHandoffRegistry} from "../src/interfaces/IHandoffRegistry.sol";
import {IHandoffSettlement} from "../src/interfaces/IHandoffSettlement.sol";
import {StubAttestationStore} from "../src/stubs/StubAttestationStore.sol";
import {StubUSDC} from "../src/stubs/StubUSDC.sol";

/// @notice The full system on stubs: one registered token, one venue, a band, an attested seller and buyer.
abstract contract HandoffBase is Test {
    uint256 internal constant PRICE = 2_500000;
    uint16 internal constant WIDTH_BPS = 1000;
    uint256 internal constant SELLER_UNITS = 100;
    uint256 internal constant AUTHORIZED = 1000;
    uint256 internal constant BUYER_USDC = 100e6;

    StubAttestationStore internal store;
    StubUSDC internal usdc;
    HandoffRegistry internal registry;
    HandoffSettlement internal settlement;
    HandoffToken internal token;

    address internal owner = makeAddr("owner");
    address internal issuer = makeAddr("issuer");
    address internal buyer = makeAddr("buyer");
    address internal stranger = makeAddr("stranger");
    address internal venue = makeAddr("venue");

    address internal seller;
    uint256 internal sellerPk;
    address internal orderKey;
    uint256 internal orderKeyPk;

    function setUp() public virtual {
        (seller, sellerPk) = makeAddrAndKey("seller");
        (orderKey, orderKeyPk) = makeAddrAndKey("orderKey");

        store = new StubAttestationStore();
        usdc = new StubUSDC();
        registry = new HandoffRegistry(owner, address(store));
        settlement = new HandoffSettlement(address(registry), address(usdc));
        vm.prank(owner);
        registry.setSettlement(address(settlement));

        _attest(issuer, 4);
        _attest(seller, 2);
        _attest(buyer, 2);

        token = _registerToken("Fideicomiso Torre Demo", "TDEMO");
        vm.startPrank(issuer);
        registry.addVenue(address(token), venue, orderKey);
        registry.setBand(address(token), PRICE, WIDTH_BPS, 0);
        registry.mint(address(token), seller, SELLER_UNITS);
        vm.stopPrank();

        usdc.mint(buyer, BUYER_USDC);
        vm.prank(buyer);
        usdc.approve(address(settlement), type(uint256).max);
    }

    /// @dev Every case ends here: the settlement never keeps a balance.
    modifier holdsNothing() {
        _;
        assertEq(token.balanceOf(address(settlement)), 0, "settlement holds token");
        assertEq(usdc.balanceOf(address(settlement)), 0, "settlement holds USDC");
    }

    function _attest(address who, uint32 tier) internal {
        store.attest(who, tier, uint64(block.timestamp + 365 days));
    }

    function _params(string memory name, string memory symbol)
        internal
        view
        returns (IHandoffRegistry.RegisterParams memory p)
    {
        address[] memory trusted = new address[](1);
        trusted[0] = address(store);
        p = IHandoffRegistry.RegisterParams({
            name: name,
            symbol: symbol,
            depositRef: "DEP-DEMO-1",
            cnvAuthRef: "CNV-DEMO-1",
            issuanceDocHash: keccak256("issuance document"),
            authorizedSupply: AUTHORIZED,
            attesters: trusted,
            flags: 0
        });
    }

    function _registerToken(string memory name, string memory symbol) internal returns (HandoffToken) {
        vm.prank(issuer);
        return HandoffToken(registry.registerToken(_params(name, symbol)));
    }

    function _order() internal view returns (IHandoffSettlement.Order memory) {
        return _orderFrom(seller);
    }

    function _orderFrom(address from) internal view returns (IHandoffSettlement.Order memory) {
        return IHandoffSettlement.Order({
            chainId: block.chainid,
            token: address(token),
            venue: venue,
            seller: from,
            amount: 10,
            price: PRICE,
            expiry: block.timestamp + 1 days,
            nonce: 1
        });
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _sellerSig(IHandoffSettlement.Order memory o) internal view returns (bytes memory) {
        return _sign(sellerPk, settlement.hashOrder(o));
    }

    function _venueSig(IHandoffSettlement.Order memory o, address forBuyer) internal view returns (bytes memory) {
        return _sign(orderKeyPk, settlement.hashVenueFill(settlement.hashOrder(o), forBuyer));
    }

    function _fill(IHandoffSettlement.Order memory o, address by) internal {
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _venueSig(o, by);
        vm.prank(by);
        settlement.fill(o, sellerSig, venueSig);
    }

    function _assertNothingMoved() internal view {
        assertEq(token.balanceOf(seller), SELLER_UNITS);
        assertEq(token.balanceOf(buyer), 0);
        assertEq(usdc.balanceOf(buyer), BUYER_USDC);
        assertEq(usdc.balanceOf(seller), 0);
    }
}
