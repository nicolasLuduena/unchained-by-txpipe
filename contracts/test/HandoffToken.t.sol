// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IHandoffRegistry} from "../src/interfaces/IHandoffRegistry.sol";
import {IHandoffSettlement} from "../src/interfaces/IHandoffSettlement.sol";
import {IHandoffToken} from "../src/interfaces/IHandoffToken.sol";
import {HandoffBase} from "./HandoffBase.t.sol";

contract HandoffTokenTest is HandoffBase {
    function test_directTransferToUnattestedReverts() public holdsNothing {
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.ReceiverNotAttested.selector, stranger));
        vm.prank(seller);
        token.transfer(stranger, 1);
        assertEq(token.balanceOf(seller), SELLER_UNITS);
    }

    function test_directTransferBetweenAttestedHoldersIsNotRouted() public holdsNothing {
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.NotRoutedThroughVenue.selector, seller));
        vm.prank(seller);
        token.transfer(buyer, 1);
        assertEq(token.balanceOf(buyer), 0);
    }

    function test_allowanceDoesNotRouteATransfer() public holdsNothing {
        vm.prank(seller);
        token.approve(stranger, 10);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.NotRoutedThroughVenue.selector, stranger));
        vm.prank(stranger);
        token.transferFrom(seller, buyer, 1);
        assertEq(token.balanceOf(buyer), 0);
    }

    function test_thirdPartyWithoutAllowanceIsNotRouted() public holdsNothing {
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.NotRoutedThroughVenue.selector, stranger));
        vm.prank(stranger);
        token.transferFrom(seller, buyer, 1);
    }

    function test_transferFromRevokedHolderReverts() public holdsNothing {
        store.revoke(seller);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.SenderNotAttested.selector, seller));
        vm.prank(seller);
        token.transfer(buyer, 1);
    }

    function test_transferFromExpiredHolderReverts() public holdsNothing {
        store.attest(seller, 2, uint64(block.timestamp + 1));
        vm.warp(block.timestamp + 2);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.SenderNotAttested.selector, seller));
        vm.prank(seller);
        token.transfer(buyer, 1);
    }

    function test_tierOneAndTierSixAreNotHolders() public holdsNothing {
        _attest(stranger, 1);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.ReceiverNotAttested.selector, stranger));
        vm.prank(seller);
        token.transfer(stranger, 1);

        _attest(stranger, 6);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.ReceiverNotAttested.selector, stranger));
        vm.prank(seller);
        token.transfer(stranger, 1);
    }

    function test_blockedHolderCannotSend() public holdsNothing {
        vm.expectEmit(true, true, true, true, address(registry));
        emit IHandoffRegistry.HolderBlocked(address(token), seller, true, venue);
        vm.prank(venue);
        registry.setBlocked(address(token), seller, true);
        assertTrue(registry.isBlocked(address(token), seller));

        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.SenderBlocked.selector, seller));
        vm.prank(seller);
        token.transfer(buyer, 1);
    }

    function test_pausedTokenCannotBeTransferred() public holdsNothing {
        vm.prank(venue);
        registry.setPaused(address(token), true);
        vm.expectRevert(IHandoffToken.TokenPaused.selector);
        vm.prank(seller);
        token.transfer(buyer, 1);
    }

    function test_hookOrderPausedThenBlockedThenSenderThenReceiverThenRouting() public holdsNothing {
        vm.startPrank(venue);
        registry.setPaused(address(token), true);
        registry.setBlocked(address(token), seller, true);
        vm.stopPrank();
        store.revoke(seller);

        vm.prank(seller);
        vm.expectRevert(IHandoffToken.TokenPaused.selector);
        token.transfer(stranger, 1);

        vm.prank(venue);
        registry.setPaused(address(token), false);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.SenderBlocked.selector, seller));
        token.transfer(stranger, 1);

        vm.prank(venue);
        registry.setBlocked(address(token), seller, false);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.SenderNotAttested.selector, seller));
        token.transfer(stranger, 1);

        _attest(seller, 2);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.ReceiverNotAttested.selector, stranger));
        token.transfer(stranger, 1);

        _attest(stranger, 2);
        vm.prank(seller);
        vm.expectRevert(abi.encodeWithSelector(IHandoffToken.NotRoutedThroughVenue.selector, seller));
        token.transfer(stranger, 1);
    }

    function test_burnEmitsReversionWithCertificateRef() public holdsNothing {
        bytes32 docHash = keccak256("certificate");
        vm.expectEmit(true, true, true, true, address(registry));
        emit IHandoffRegistry.Reversion(address(token), seller, 30, "CERT-2026-001", docHash, venue);
        vm.prank(venue);
        registry.revertToPaper(address(token), seller, 30, "CERT-2026-001", docHash);
        assertEq(token.balanceOf(seller), SELLER_UNITS - 30);
        assertEq(token.totalSupply(), SELLER_UNITS - 30);
    }

    function test_blockThenBurnIsTheRevertFlow() public holdsNothing {
        vm.startPrank(venue);
        registry.setBlocked(address(token), seller, true);
        registry.revertToPaper(address(token), seller, SELLER_UNITS, "CERT", bytes32(0));
        vm.stopPrank();
        assertEq(token.balanceOf(seller), 0);
    }

    function test_pausedDoesNotBlockBurn() public holdsNothing {
        vm.startPrank(venue);
        registry.setPaused(address(token), true);
        registry.revertToPaper(address(token), seller, 1, "CERT", bytes32(0));
        vm.stopPrank();
        assertEq(token.balanceOf(seller), SELLER_UNITS - 1);
    }

    function test_mintAndBurnAreRegistryOnly() public holdsNothing {
        vm.startPrank(issuer);
        vm.expectRevert(IHandoffToken.OnlyRegistry.selector);
        token.mint(seller, 1);
        vm.expectRevert(IHandoffToken.OnlyRegistry.selector);
        token.burn(seller, 1);
        vm.stopPrank();
    }

    function test_onlyTheSettlementMovesUnitsAndNeedsNoAllowance() public holdsNothing {
        assertEq(token.allowance(seller, address(settlement)), 0);
        IHandoffSettlement.Order memory o = _order();
        _fill(o, buyer);
        assertEq(token.balanceOf(buyer), o.amount);
    }
}
