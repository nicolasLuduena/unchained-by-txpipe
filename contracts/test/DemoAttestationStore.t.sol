// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {DemoAttestationStore} from "../src/DemoAttestationStore.sol";

contract DemoAttestationStoreTest is Test {
    DemoAttestationStore store;
    address holder = makeAddr("holder");

    function setUp() public {
        store = new DemoAttestationStore(address(this));
    }

    function test_attestVerifyExpireRevoke() public {
        store.attest(holder, 2, uint64(block.timestamp + 1 days));
        (bool ok, uint32 tier,,) = store.verify(holder);
        assertTrue(ok);
        assertEq(tier, 2);
        assertEq(store.totalAttestations(), 1);
        vm.warp(block.timestamp + 2 days);
        (ok,,,) = store.verify(holder);
        assertFalse(ok);
        store.revoke(holder);
        assertEq(store.totalAttestations(), 0);
    }

    function test_onlyVerifierCanAttest() public {
        vm.prank(holder);
        vm.expectRevert(abi.encodeWithSelector(DemoAttestationStore.NotVerifier.selector, holder));
        store.attest(holder, 5, uint64(block.timestamp + 1 days));
    }

    function test_rejectsUnknownTier() public {
        vm.expectRevert(abi.encodeWithSelector(DemoAttestationStore.InvalidTier.selector, uint32(6)));
        store.attest(holder, 6, uint64(block.timestamp + 1 days));
    }
}
