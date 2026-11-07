// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {StubAttestationStore} from "../src/stubs/StubAttestationStore.sol";
import {StubUSDC} from "../src/stubs/StubUSDC.sol";

contract StubsTest is Test {
    function test_attestationExpiresAndRevokes() public {
        StubAttestationStore store = new StubAttestationStore();
        address holder = makeAddr("holder");
        store.attest(holder, 2, uint64(block.timestamp + 1 days));
        (bool ok, uint32 tier,,) = store.verify(holder);
        assertTrue(ok);
        assertEq(tier, 2);
        vm.warp(block.timestamp + 2 days);
        (ok,,,) = store.verify(holder);
        assertFalse(ok);
    }

    function test_usdcHasSixDecimals() public {
        StubUSDC usdc = new StubUSDC();
        usdc.mint(address(this), 1e6);
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.balanceOf(address(this)), 1e6);
    }
}
