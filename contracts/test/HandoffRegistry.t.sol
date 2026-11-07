// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {HandoffRegistry} from "../src/HandoffRegistry.sol";
import {HandoffToken} from "../src/HandoffToken.sol";
import {IHandoffRegistry} from "../src/interfaces/IHandoffRegistry.sol";
import {StubAttestationStore} from "../src/stubs/StubAttestationStore.sol";
import {HandoffBase} from "./HandoffBase.t.sol";

contract HandoffRegistryTest is HandoffBase {
    // Registration

    function test_registerStoresTheIssuance() public view holdsNothing {
        assertEq(registry.tokenCount(), 1);
        assertEq(registry.tokenAt(0), address(token));
        assertTrue(registry.isRegistered(address(token)));

        IHandoffRegistry.TokenInfo memory info = registry.tokenInfo(address(token));
        assertEq(info.issuer, issuer);
        assertEq(info.cnvAuthRef, "CNV-DEMO-1");
        assertEq(info.depositRef, "DEP-DEMO-1");
        assertEq(info.authorizedSupply, AUTHORIZED);
        assertTrue(info.tradingEnabled);
        assertFalse(info.paused);

        assertEq(token.name(), "Fideicomiso Torre Demo");
        assertEq(token.symbol(), "TDEMO");
        assertEq(token.decimals(), 0);
        assertEq(token.registry(), address(registry));
        assertEq(registry.attesters(address(token)).length, 1);
    }

    function test_registerEmitsTokenRegistered() public holdsNothing {
        IHandoffRegistry.RegisterParams memory p = _params("Second", "SEC");
        vm.expectEmit(false, true, false, true, address(registry));
        emit IHandoffRegistry.TokenRegistered(address(0), issuer, "Second", "SEC", p.cnvAuthRef, p.issuanceDocHash);
        vm.prank(issuer);
        registry.registerToken(p);
    }

    function test_registerWithoutAuthorizationRefReverts() public holdsNothing {
        IHandoffRegistry.RegisterParams memory p = _params("X", "X");
        p.cnvAuthRef = "";
        vm.expectRevert(IHandoffRegistry.MissingAuthorizationRef.selector);
        vm.prank(issuer);
        registry.registerToken(p);
    }

    function test_registerWithoutAttestationReverts() public holdsNothing {
        _expectRegisterRefused(stranger);
    }

    function test_registerFromPersonReverts() public holdsNothing {
        _attest(stranger, 2);
        _expectRegisterRefused(stranger);
    }

    function test_registerFromTierFiveAgentReverts() public holdsNothing {
        _attest(stranger, 5);
        _expectRegisterRefused(stranger);
    }

    function test_registerAfterBusinessAttestationExpiredReverts() public holdsNothing {
        vm.warp(block.timestamp + 366 days);
        _expectRegisterRefused(issuer);
    }

    function _expectRegisterRefused(address who) internal {
        IHandoffRegistry.RegisterParams memory p = _params("X", "X");
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.IssuerNotBusiness.selector, who));
        vm.prank(who);
        registry.registerToken(p);
    }

    // Venues

    function _fillVenues() internal {
        vm.startPrank(issuer);
        for (uint256 i = 1; i < registry.MAX_VENUES(); ++i) {
            registry.addVenue(address(token), address(uint160(0x1000 + i)), address(uint160(0x2000 + i)));
        }
        vm.stopPrank();
    }

    function test_sixthVenueReverts() public holdsNothing {
        _fillVenues();
        assertEq(registry.venues(address(token)).length, 5);
        vm.expectRevert(IHandoffRegistry.VenueCapReached.selector);
        vm.prank(issuer);
        registry.addVenue(address(token), address(0x9999), address(0x9998));
    }

    function test_removeThenAddStaysWithinTheCap() public holdsNothing {
        _fillVenues();
        vm.startPrank(issuer);
        registry.removeVenue(address(token), venue);
        registry.addVenue(address(token), address(0x9999), address(0x9998));
        vm.stopPrank();
        assertEq(registry.venues(address(token)).length, 5);
        assertEq(registry.venueKey(address(token), venue), address(0));
        assertEq(registry.venueKey(address(token), address(0x9999)), address(0x9998));
    }

    function test_addVenueRefusals() public holdsNothing {
        vm.startPrank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.VenueAlreadyListed.selector, venue));
        registry.addVenue(address(token), venue, orderKey);
        vm.expectRevert(IHandoffRegistry.ZeroAddress.selector);
        registry.addVenue(address(token), address(0), orderKey);
        vm.expectRevert(IHandoffRegistry.ZeroAddress.selector);
        registry.addVenue(address(token), stranger, address(0));
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.VenueNotListed.selector, stranger));
        registry.removeVenue(address(token), stranger);
        vm.stopPrank();
    }

    function test_repointByOwnerIssuerOrOldVenue() public holdsNothing {
        address venue2 = makeAddr("venue2");
        address venue3 = makeAddr("venue3");
        address venue4 = makeAddr("venue4");

        vm.expectEmit(true, true, true, true, address(registry));
        emit IHandoffRegistry.VenueRepointed(address(token), venue, venue2, address(0xA2));
        vm.prank(owner);
        registry.repointVenue(address(token), venue, venue2, address(0xA2));
        assertEq(registry.venueKey(address(token), venue), address(0));
        assertEq(registry.venueKey(address(token), venue2), address(0xA2));

        vm.prank(issuer);
        registry.repointVenue(address(token), venue2, venue3, address(0xA3));
        vm.prank(venue3);
        registry.repointVenue(address(token), venue3, venue4, address(0xA4));

        address[] memory list = registry.venues(address(token));
        assertEq(list.length, 1);
        assertEq(list[0], venue4);
    }

    function test_repointSameVenueRotatesTheKey() public holdsNothing {
        vm.prank(venue);
        registry.repointVenue(address(token), venue, venue, address(0xA2));
        assertEq(registry.venueKey(address(token), venue), address(0xA2));
        assertEq(registry.venues(address(token)).length, 1);
    }

    function test_repointRefusals() public holdsNothing {
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.NotAuthorized.selector, stranger));
        vm.prank(stranger);
        registry.repointVenue(address(token), venue, stranger, stranger);

        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.VenueNotListed.selector, stranger));
        vm.prank(owner);
        registry.repointVenue(address(token), stranger, stranger, stranger);

        address venue2 = makeAddr("venue2");
        vm.prank(issuer);
        registry.addVenue(address(token), venue2, address(0xA2));
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.VenueAlreadyListed.selector, venue2));
        vm.prank(owner);
        registry.repointVenue(address(token), venue, venue2, address(0xA3));
    }

    // Mint and supply

    function test_mintToAttestedAddress() public holdsNothing {
        vm.expectEmit(true, true, false, true, address(registry));
        emit IHandoffRegistry.Minted(address(token), buyer, 5);
        vm.prank(issuer);
        registry.mint(address(token), buyer, 5);
        assertEq(token.balanceOf(buyer), 5);
    }

    function test_mintToUnattestedAddressReverts() public holdsNothing {
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.ReceiverNotAttested.selector, stranger));
        vm.prank(issuer);
        registry.mint(address(token), stranger, 5);
        assertEq(token.balanceOf(stranger), 0);
    }

    function test_mintStaysWithinAuthorizedSupply() public holdsNothing {
        vm.startPrank(issuer);
        registry.mint(address(token), buyer, AUTHORIZED - SELLER_UNITS);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.SupplyExceeded.selector, AUTHORIZED + 1, AUTHORIZED));
        registry.mint(address(token), buyer, 1);
        vm.stopPrank();
        assertEq(token.totalSupply(), AUTHORIZED);
    }

    function test_reMintAfterBurnStaysWithinAuthorizedSupply() public holdsNothing {
        vm.prank(issuer);
        registry.mint(address(token), buyer, AUTHORIZED - SELLER_UNITS);

        vm.prank(venue);
        registry.revertToPaper(address(token), seller, 40, "CERT-1", keccak256("cert"));

        vm.startPrank(issuer);
        registry.mint(address(token), seller, 40);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.SupplyExceeded.selector, AUTHORIZED + 1, AUTHORIZED));
        registry.mint(address(token), seller, 1);
        vm.stopPrank();
        assertEq(token.totalSupply(), AUTHORIZED);
    }

    // Attester set

    function test_holderEligibilityIsTierTwoToFive() public holdsNothing {
        address[6] memory subjects;
        uint32[6] memory tiers = [uint32(1), 2, 3, 4, 5, 6];
        bool[6] memory expected = [false, true, true, true, true, false];
        for (uint256 i; i < 6; ++i) {
            subjects[i] = address(uint160(0x3000 + i));
            _attest(subjects[i], tiers[i]);
            assertEq(registry.isAttested(address(token), subjects[i]), expected[i]);
        }
    }

    function test_anyStoreInTheSetCounts() public holdsNothing {
        StubAttestationStore other = new StubAttestationStore();
        other.attest(stranger, 2, uint64(block.timestamp + 1 days));
        assertFalse(registry.isAttested(address(token), stranger));

        vm.expectEmit(true, true, false, true, address(registry));
        emit IHandoffRegistry.AttesterSet(address(token), address(other), true);
        vm.prank(issuer);
        registry.setAttester(address(token), address(other), true);
        assertTrue(registry.isAttested(address(token), stranger));
        assertEq(registry.attesters(address(token)).length, 2);

        vm.prank(issuer);
        registry.setAttester(address(token), address(other), false);
        assertFalse(registry.isAttested(address(token), stranger));
        assertEq(registry.attesters(address(token)).length, 1);
    }

    function test_setAttesterTwiceKeepsOneEntry() public holdsNothing {
        vm.prank(issuer);
        registry.setAttester(address(token), address(store), true);
        assertEq(registry.attesters(address(token)).length, 1);
    }

    // Access control

    function test_setSettlementIsOwnerOnly() public holdsNothing {
        vm.expectRevert(IHandoffRegistry.NotOwner.selector);
        registry.setSettlement(stranger);
        vm.expectRevert(IHandoffRegistry.ZeroAddress.selector);
        vm.prank(owner);
        registry.setSettlement(address(0));
    }

    function test_constructorRefusesZeroAddresses() public holdsNothing {
        vm.expectRevert(IHandoffRegistry.ZeroAddress.selector);
        new HandoffRegistry(address(0), address(store));
        vm.expectRevert(IHandoffRegistry.ZeroAddress.selector);
        new HandoffRegistry(owner, address(0));
    }

    function test_issuerActionsAreIssuerOnly() public holdsNothing {
        address t = address(token);
        bytes memory notIssuer = abi.encodeWithSelector(IHandoffRegistry.NotIssuer.selector, stranger);
        vm.startPrank(stranger);
        vm.expectRevert(notIssuer);
        registry.addVenue(t, stranger, stranger);
        vm.expectRevert(notIssuer);
        registry.removeVenue(t, venue);
        vm.expectRevert(notIssuer);
        registry.setAttester(t, stranger, true);
        vm.expectRevert(notIssuer);
        registry.setFloor(t, 1);
        vm.expectRevert(notIssuer);
        registry.setTradingEnabled(t, false);
        vm.expectRevert(notIssuer);
        registry.mint(t, buyer, 1);
        vm.stopPrank();
    }

    function test_venueCannotMint() public holdsNothing {
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.NotIssuer.selector, venue));
        vm.prank(venue);
        registry.mint(address(token), buyer, 1);
    }

    function test_issuerOrVenueActions() public holdsNothing {
        address t = address(token);
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.NotIssuerOrVenue.selector, stranger));
        registry.setBand(t, PRICE, WIDTH_BPS, 0);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.NotIssuerOrVenue.selector, stranger));
        registry.setPaused(t, true);
        vm.stopPrank();

        vm.expectEmit(true, false, false, true, address(registry));
        emit IHandoffRegistry.BandSet(t, 3_000000, 500, 60);
        vm.prank(venue);
        registry.setBand(t, 3_000000, 500, 60);

        IHandoffRegistry.Band memory b = registry.band(t);
        assertEq(b.price, 3_000000);
        assertEq(b.widthBps, 500);
        assertEq(b.maxAge, 60);
        assertEq(b.timestamp, block.timestamp);

        vm.expectEmit(true, true, true, true, address(registry));
        emit IHandoffRegistry.PausedSet(t, true, issuer);
        vm.prank(issuer);
        registry.setPaused(t, true);
        assertTrue(registry.tokenInfo(t).paused);
    }

    function test_bandWidthAboveOneHundredPercentReverts() public holdsNothing {
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.InvalidBandWidth.selector, 10_001));
        vm.prank(issuer);
        registry.setBand(address(token), PRICE, 10_001, 0);
    }

    function test_venueActionsAreVenueOnly() public holdsNothing {
        address t = address(token);
        vm.startPrank(issuer);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.NotVenue.selector, issuer));
        registry.setBlocked(t, seller, true);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.NotVenue.selector, issuer));
        registry.revertToPaper(t, seller, 1, "CERT", bytes32(0));
        vm.stopPrank();
    }

    function test_unknownTokenReverts() public holdsNothing {
        address t = makeAddr("notAToken");
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.UnknownToken.selector, t));
        registry.addVenue(t, venue, orderKey);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.UnknownToken.selector, t));
        registry.setBand(t, PRICE, WIDTH_BPS, 0);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.UnknownToken.selector, t));
        registry.setBlocked(t, seller, true);
        vm.expectRevert(abi.encodeWithSelector(IHandoffRegistry.UnknownToken.selector, t));
        registry.repointVenue(t, venue, venue, orderKey);
        assertFalse(registry.isRegistered(t));
    }
}
