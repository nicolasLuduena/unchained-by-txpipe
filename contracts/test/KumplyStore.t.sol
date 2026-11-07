// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AttestationStore} from "../src/vendor/kumply/AttestationStore.sol";
import {IAttestationStore} from "../src/interfaces/IAttestationStore.sol";

/// @notice The vendored KUMPLY store satisfies the interface the registry reads.
contract KumplyStoreTest is Test {
    function test_verifyMatchesTheRegistrySeam() public {
        AttestationStore store = new AttestationStore(address(this), address(0));
        store.addVerifier(address(this));
        address holder = makeAddr("holder");
        store.issueAttestation(holder, 2, uint64(block.timestamp + 1 days));
        (bool ok, uint32 tier,,) = IAttestationStore(address(store)).verify(holder);
        assertTrue(ok);
        assertEq(tier, 2);
        vm.warp(block.timestamp + 2 days);
        (ok,,,) = IAttestationStore(address(store)).verify(holder);
        assertFalse(ok);
    }
}
