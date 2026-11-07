// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {HandoffToken} from "../src/HandoffToken.sol";
import {IHandoffSettlement} from "../src/interfaces/IHandoffSettlement.sol";
import {IHandoffToken} from "../src/interfaces/IHandoffToken.sol";
import {HandoffBase} from "./HandoffBase.t.sol";
import {MockERC1271Account} from "./mocks/MockERC1271Account.sol";

contract HandoffSettlementTest is HandoffBase {
    uint256 internal constant OTHER_PK = 0xBEEF;

    function _expectFillRefused(IHandoffSettlement.Order memory o, bytes memory err) internal {
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(err);
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        _assertNothingMoved();
    }

    function _expectBandRefused(uint256 price, uint256 low, uint256 high) internal {
        IHandoffSettlement.Order memory o = _order();
        o.price = price;
        _expectFillRefused(o, abi.encodeWithSelector(IHandoffSettlement.PriceOutOfBand.selector, price, low, high));
    }

    // Happy path

    function test_fillMovesTokensAndUsdcAtomically() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        uint256 total = o.amount * o.price;

        vm.expectEmit(true, true, true, true, address(settlement));
        emit IHandoffSettlement.OrderFilled(
            settlement.hashOrder(o), o.token, o.venue, seller, buyer, o.amount, o.price, o.nonce
        );
        _fill(o, buyer);

        assertEq(token.balanceOf(seller), SELLER_UNITS - o.amount);
        assertEq(token.balanceOf(buyer), o.amount);
        assertEq(usdc.balanceOf(seller), total);
        assertEq(usdc.balanceOf(buyer), BUYER_USDC - total);
        assertTrue(settlement.filled(seller, o.nonce));
    }

    function test_digestsMatchTheDocumentedTypeStrings() public view {
        IHandoffSettlement.Order memory o = _order();
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Handoff Settlement"),
                keccak256("1"),
                block.chainid,
                address(settlement)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Order(uint256 chainId,address token,address venue,address seller,uint256 amount,uint256 price,uint256 expiry,uint256 nonce)"
                ),
                o.chainId,
                o.token,
                o.venue,
                o.seller,
                o.amount,
                o.price,
                o.expiry,
                o.nonce
            )
        );
        bytes32 orderHash = MessageHashUtils.toTypedDataHash(domain, structHash);
        assertEq(settlement.hashOrder(o), orderHash);

        bytes32 fillStruct = keccak256(abi.encode(keccak256("VenueFill(bytes32 orderHash,address buyer)"), orderHash, buyer));
        assertEq(settlement.hashVenueFill(orderHash, buyer), MessageHashUtils.toTypedDataHash(domain, fillStruct));
    }

    function test_replayedFillReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        _fill(o, buyer);
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.OrderAlreadyFilled.selector, seller, o.nonce));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        assertEq(token.balanceOf(buyer), o.amount);
    }

    function test_zeroAmountReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        o.amount = 0;
        _expectFillRefused(o, abi.encodeWithSelector(IHandoffSettlement.ZeroAmount.selector));
    }

    function test_buyerWithoutUsdcRollsBackTheTokenLeg() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        vm.prank(buyer);
        usdc.approve(address(settlement), 1);
        _expectFillRefused(
            o,
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(settlement), 1, o.amount * o.price
            )
        );
        assertFalse(settlement.filled(seller, o.nonce));
    }

    function test_sellerWithoutUnitsReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        o.amount = SELLER_UNITS + 1;
        o.price = PRICE;
        _expectFillRefused(
            o, abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, seller, SELLER_UNITS, o.amount)
        );
    }

    // Attestation, through the token hook

    function test_unattestedBuyerRevertsInTheHook() public holdsNothing {
        usdc.mint(stranger, BUYER_USDC);
        vm.prank(stranger);
        usdc.approve(address(settlement), type(uint256).max);

        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _venueSig(o, stranger);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.ReceiverNotAttested.selector, stranger));
        vm.prank(stranger);
        settlement.fill(o, sellerSig, venueSig);

        assertEq(token.balanceOf(stranger), 0);
        assertEq(usdc.balanceOf(stranger), BUYER_USDC);
        assertEq(token.balanceOf(seller), SELLER_UNITS);
    }

    function test_unattestedBuyerWithoutApprovalStillGetsTheHookError() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _venueSig(o, stranger);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.ReceiverNotAttested.selector, stranger));
        vm.prank(stranger);
        settlement.fill(o, sellerSig, venueSig);
    }

    function test_sellerWhoLostAttestationReverts() public holdsNothing {
        store.revoke(seller);
        _expectFillRefused(_order(), abi.encodeWithSelector(IHandoffToken.SenderNotAttested.selector, seller));
    }

    function test_pausedTokenCannotBeTraded() public holdsNothing {
        vm.prank(issuer);
        registry.setPaused(address(token), true);
        _expectFillRefused(_order(), abi.encodeWithSelector(IHandoffToken.TokenPaused.selector));
    }

    function test_blockedHolderCannotSell() public holdsNothing {
        vm.prank(venue);
        registry.setBlocked(address(token), seller, true);
        _expectFillRefused(_order(), abi.encodeWithSelector(IHandoffToken.SenderBlocked.selector, seller));
    }

    // Venue co-signature

    function test_fillWithoutVenueSignatureReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidVenueSignature.selector, venue));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, "");
        _assertNothingMoved();
    }

    function test_venueSignatureFromWrongKeyReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _sign(OTHER_PK, settlement.hashVenueFill(settlement.hashOrder(o), buyer));
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidVenueSignature.selector, venue));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        _assertNothingMoved();
    }

    function test_venueSignatureForAnotherBuyerReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _venueSig(o, stranger);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidVenueSignature.selector, venue));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        _assertNothingMoved();
    }

    function test_fillThroughNonAllowlistedVenueReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        o.venue = stranger;
        _expectFillRefused(
            o, abi.encodeWithSelector(IHandoffSettlement.VenueNotAllowed.selector, address(token), stranger)
        );
    }

    function test_fillThroughRemovedVenueReverts() public holdsNothing {
        vm.prank(issuer);
        registry.removeVenue(address(token), venue);
        _expectFillRefused(
            _order(), abi.encodeWithSelector(IHandoffSettlement.VenueNotAllowed.selector, address(token), venue)
        );
    }

    function test_rotatedVenueKeyInvalidatesTheOldKey() public holdsNothing {
        vm.prank(venue);
        registry.repointVenue(address(token), venue, venue, vm.addr(OTHER_PK));
        _expectFillRefused(_order(), abi.encodeWithSelector(IHandoffSettlement.InvalidVenueSignature.selector, venue));
    }

    function test_unregisteredTokenReverts() public {
        IHandoffSettlement.Order memory o = _order();
        o.token = stranger;
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.VenueNotAllowed.selector, stranger, venue));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
    }

    // Price band

    function test_fillAtBandEdgesSucceeds() public holdsNothing {
        IHandoffSettlement.Order memory low = _order();
        low.price = 2_250000;
        _fill(low, buyer);

        IHandoffSettlement.Order memory high = _order();
        high.price = 2_750000;
        high.nonce = 2;
        _fill(high, buyer);

        assertEq(token.balanceOf(buyer), 20);
    }

    function test_fillAboveBandReverts() public holdsNothing {
        _expectBandRefused(2_750001, 2_250000, 2_750000);
    }

    function test_fillBelowBandReverts() public holdsNothing {
        _expectBandRefused(2_249999, 2_250000, 2_750000);
    }

    function test_floorRaisesTheLowBound() public holdsNothing {
        vm.prank(issuer);
        registry.setFloor(address(token), 2_400000);
        _expectBandRefused(2_300000, 2_400000, 2_750000);
    }

    function test_floorBelowTheBandDoesNotLowerIt() public holdsNothing {
        vm.prank(issuer);
        registry.setFloor(address(token), 1_000000);
        _expectBandRefused(2_000000, 2_250000, 2_750000);
    }

    function test_stalePriceRevertsWhenStalenessIsEnabled() public holdsNothing {
        vm.prank(issuer);
        registry.setBand(address(token), PRICE, WIDTH_BPS, 1 hours);
        uint64 setAt = uint64(block.timestamp);

        vm.warp(block.timestamp + 1 hours + 1);
        IHandoffSettlement.Order memory o = _order();
        _expectFillRefused(o, abi.encodeWithSelector(IHandoffSettlement.PriceStale.selector, setAt, uint64(1 hours)));
    }

    function test_priceAtMaxAgeStillFills() public holdsNothing {
        vm.prank(issuer);
        registry.setBand(address(token), PRICE, WIDTH_BPS, 1 hours);
        vm.warp(block.timestamp + 1 hours);
        _fill(_order(), buyer);
        assertEq(token.balanceOf(buyer), 10);
    }

    function test_oldPriceFillsWhenStalenessIsDisabled() public holdsNothing {
        vm.warp(block.timestamp + 300 days);
        _fill(_order(), buyer);
        assertEq(token.balanceOf(buyer), 10);
    }

    function test_noBandReverts() public holdsNothing {
        vm.prank(issuer);
        registry.setBand(address(token), 0, WIDTH_BPS, 0);
        _expectFillRefused(_order(), abi.encodeWithSelector(IHandoffSettlement.BandNotSet.selector, address(token)));
    }

    function test_optedOutTokenReverts() public holdsNothing {
        vm.prank(issuer);
        registry.setTradingEnabled(address(token), false);
        _expectFillRefused(_order(), abi.encodeWithSelector(IHandoffSettlement.TradingDisabled.selector, address(token)));
    }

    // Lifecycle

    function test_cancelledOrderCannotBeFilled() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        vm.expectEmit(true, true, false, true, address(settlement));
        emit IHandoffSettlement.OrderCancelled(seller, o.nonce);
        vm.prank(seller);
        settlement.cancel(o.nonce);
        assertTrue(settlement.cancelled(seller, o.nonce));
        _expectFillRefused(o, abi.encodeWithSelector(IHandoffSettlement.OrderCancelledError.selector, seller, o.nonce));
    }

    function test_cancelOnlyTouchesTheCallersNonce() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        vm.prank(stranger);
        settlement.cancel(o.nonce);
        _fill(o, buyer);
        assertEq(token.balanceOf(buyer), o.amount);
    }

    function test_expiredOrderCannotBeFilled() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        vm.warp(o.expiry + 1);
        _expectFillRefused(o, abi.encodeWithSelector(IHandoffSettlement.OrderExpired.selector, o.expiry));
    }

    // Binding of the seller signature

    function test_orderForAnotherChainIdReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        o.chainId = block.chainid + 1;
        _expectFillRefused(o, abi.encodeWithSelector(IHandoffSettlement.WrongChain.selector, o.chainId));
    }

    function test_orderSignedForAnotherChainIdCannotBeRewritten() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        o.chainId = block.chainid + 1;
        bytes memory sellerSig = _sellerSig(o);
        o.chainId = block.chainid;
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidSellerSignature.selector, seller));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        _assertNothingMoved();
    }

    function test_orderReplayedOnAnotherChainReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        bytes memory venueSig = _venueSig(o, buyer);
        uint256 home = block.chainid;
        vm.chainId(home + 1);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.WrongChain.selector, home));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        vm.chainId(home);
    }

    function test_orderSignedForAnotherTokenReverts() public holdsNothing {
        HandoffToken other = _registerToken("Otro", "OTRO");
        vm.startPrank(issuer);
        registry.addVenue(address(other), venue, orderKey);
        registry.setBand(address(other), PRICE, WIDTH_BPS, 0);
        registry.mint(address(other), seller, SELLER_UNITS);
        vm.stopPrank();

        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        o.token = address(other);
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidSellerSignature.selector, seller));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        assertEq(other.balanceOf(buyer), 0);
    }

    function test_orderSignedForAnotherVenueReverts() public holdsNothing {
        address venue2 = makeAddr("venue2");
        vm.prank(issuer);
        registry.addVenue(address(token), venue2, orderKey);

        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        o.venue = venue2;
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidSellerSignature.selector, seller));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        _assertNothingMoved();
    }

    function test_tamperedPriceReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        o.price = 2_250000;
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidSellerSignature.selector, seller));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        _assertNothingMoved();
    }

    // Signature schemes

    function test_eoaSignatureFromAnotherSignerReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory forged = _sign(OTHER_PK, settlement.hashOrder(o));
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidSellerSignature.selector, seller));
        vm.prank(buyer);
        settlement.fill(o, forged, venueSig);
        _assertNothingMoved();
    }

    function test_eoaSignatureOverEthSignedDigestFills() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sign(sellerPk, MessageHashUtils.toEthSignedMessageHash(settlement.hashOrder(o)));
        bytes memory venueSig = _venueSig(o, buyer);
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        assertEq(token.balanceOf(buyer), o.amount);
    }

    function _smartAccountSeller() internal returns (MockERC1271Account account) {
        account = new MockERC1271Account(seller);
        _attest(address(account), 2);
        vm.prank(issuer);
        registry.mint(address(token), address(account), 50);
    }

    function _assertSmartAccountFill(MockERC1271Account account, bytes32 signedDigest) internal {
        IHandoffSettlement.Order memory o = _orderFrom(address(account));
        // signedDigest == 0 selects the raw order digest.
        bytes32 digest = signedDigest == bytes32(0) ? settlement.hashOrder(o) : signedDigest;
        bytes memory sellerSig = _sign(sellerPk, digest);
        bytes memory venueSig = _venueSig(o, buyer);
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
        assertEq(token.balanceOf(address(account)), 40);
        assertEq(token.balanceOf(buyer), 10);
        assertEq(usdc.balanceOf(address(account)), o.amount * o.price);
    }

    function test_erc1271SignatureOverRawDigestFills() public holdsNothing {
        _assertSmartAccountFill(_smartAccountSeller(), bytes32(0));
    }

    function test_erc1271SignatureOverEthSignedDigestFills() public holdsNothing {
        MockERC1271Account account = _smartAccountSeller();
        bytes32 digest = settlement.hashOrder(_orderFrom(address(account)));
        _assertSmartAccountFill(account, MessageHashUtils.toEthSignedMessageHash(digest));
    }

    function test_erc1271SignatureFromAnotherKeyReverts() public holdsNothing {
        MockERC1271Account account = _smartAccountSeller();
        IHandoffSettlement.Order memory o = _orderFrom(address(account));
        bytes memory forged = _sign(OTHER_PK, settlement.hashOrder(o));
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidSellerSignature.selector, address(account)));
        vm.prank(buyer);
        settlement.fill(o, forged, venueSig);
        assertEq(token.balanceOf(address(account)), 50);
    }

    function test_ownerKeySignatureDoesNotPassForTheAccountsSiblingAccount() public holdsNothing {
        // An EOA seller cannot be impersonated by a smart account owned by another key.
        MockERC1271Account account = new MockERC1271Account(vm.addr(OTHER_PK));
        IHandoffSettlement.Order memory o = _orderFrom(address(account));
        bytes memory sellerSig = _sign(sellerPk, settlement.hashOrder(o));
        bytes memory venueSig = _venueSig(o, buyer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidSellerSignature.selector, address(account)));
        vm.prank(buyer);
        settlement.fill(o, sellerSig, venueSig);
    }

    // Announce

    function test_announceEmitsOrderAnnounced() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        vm.expectEmit(true, true, true, true, address(settlement));
        emit IHandoffSettlement.OrderAnnounced(
            settlement.hashOrder(o), o.token, o.venue, seller, o.amount, o.price, o.expiry, o.nonce
        );
        vm.prank(orderKey);
        settlement.announceOrder(o, sellerSig);
        _assertNothingMoved();
    }

    function test_announceAcceptsAnErc1271Seller() public holdsNothing {
        MockERC1271Account account = _smartAccountSeller();
        IHandoffSettlement.Order memory o = _orderFrom(address(account));
        bytes memory sellerSig = _sign(sellerPk, MessageHashUtils.toEthSignedMessageHash(settlement.hashOrder(o)));
        vm.prank(orderKey);
        settlement.announceOrder(o, sellerSig);
    }

    function test_announceFromAnotherCallerReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory sellerSig = _sellerSig(o);
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.NotOrderKey.selector, venue));
        vm.prank(venue);
        settlement.announceOrder(o, sellerSig);
    }

    function test_announceWithBadSellerSignatureReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        bytes memory forged = _sign(OTHER_PK, settlement.hashOrder(o));
        vm.expectRevert(abi.encodeWithSelector(IHandoffSettlement.InvalidSellerSignature.selector, seller));
        vm.prank(orderKey);
        settlement.announceOrder(o, forged);
    }

    function test_announceThroughNonAllowlistedVenueReverts() public holdsNothing {
        IHandoffSettlement.Order memory o = _order();
        o.venue = stranger;
        bytes memory sellerSig = _sellerSig(o);
        vm.expectRevert(
            abi.encodeWithSelector(IHandoffSettlement.VenueNotAllowed.selector, address(token), stranger)
        );
        vm.prank(orderKey);
        settlement.announceOrder(o, sellerSig);
    }
}
