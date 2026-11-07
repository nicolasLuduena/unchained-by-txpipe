// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {DemoAttestationStore} from "../src/DemoAttestationStore.sol";

/// @notice Deploys the team's demo attester on Fuji and issues the demo attestations. Run before Deploy.s.sol and
/// pass the printed address as ATTESTATION_STORE. SELLER, BUYER and ISSUER are the addresses to attest.
contract DeployDemoAttester is Script {
    function run() external {
        require(block.chainid == 43113, "not Fuji");
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint64 expiry = uint64(block.timestamp + 365 days);

        vm.startBroadcast(pk);
        DemoAttestationStore store = new DemoAttestationStore(vm.addr(pk));
        store.attest(vm.envAddress("SELLER"), 2, expiry);
        store.attest(vm.envAddress("BUYER"), 2, expiry);
        store.attest(vm.envAddress("ISSUER"), 4, expiry);
        vm.stopBroadcast();

        console2.log("DemoAttestationStore", address(store));
    }
}
