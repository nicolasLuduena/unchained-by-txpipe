// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {AttestationStore} from "../src/vendor/kumply/AttestationStore.sol";

/// @notice Deploys KUMPLY's unmodified AttestationStore on Fuji with the team as admin and verifier, then issues the
/// demo attestations. Run before Deploy.s.sol and pass the printed address as ATTESTATION_STORE.
/// These are demo attestations with no identity check, on the team's own instance, not KUMPLY's official store.
contract DeployKumplyStore is Script {
    function run() external {
        require(block.chainid == 43113, "not Fuji");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(pk);
        uint64 expiry = uint64(block.timestamp + 365 days);

        vm.startBroadcast(pk);
        AttestationStore store = new AttestationStore(admin, address(0));
        store.addVerifier(admin);
        store.issueAttestation(vm.envAddress("SELLER"), 2, expiry);
        store.issueAttestation(vm.envAddress("BUYER"), 2, expiry);
        store.issueAttestation(vm.envAddress("ISSUER"), 4, expiry);
        vm.stopBroadcast();

        console2.log("AttestationStore", address(store));
    }
}
