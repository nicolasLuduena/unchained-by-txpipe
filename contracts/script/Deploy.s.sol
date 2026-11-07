// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {HandoffRegistry} from "../src/HandoffRegistry.sol";
import {HandoffSettlement} from "../src/HandoffSettlement.sol";

/// @notice Fuji deployment of the registry and settlement against the real store and USDC. Run from contracts/:
///   DEPLOYER_PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify
/// ATTESTATION_STORE and USDC override the Fuji defaults. The deployer becomes the registry owner.
contract Deploy is Script {
    uint256 internal constant FUJI_CHAIN_ID = 43113;
    address internal constant KUMPLY_STORE = 0xa3Bc5564A18e107807aF41fF2a5215Db050b22dD;
    address internal constant FUJI_USDC = 0x5425890298aed601595a70AB815c96711a31Bc65;

    string internal constant OUT_FILE = "../deployments/fuji.json";

    function run() external {
        require(block.chainid == FUJI_CHAIN_ID, "not Fuji");

        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address store = vm.envOr("ATTESTATION_STORE", KUMPLY_STORE);
        address usdc = vm.envOr("USDC", FUJI_USDC);
        address owner = vm.addr(deployerPk);

        vm.startBroadcast(deployerPk);
        HandoffRegistry registry = new HandoffRegistry(owner, store);
        HandoffSettlement settlement = new HandoffSettlement(address(registry), usdc);
        registry.setSettlement(address(settlement));
        vm.stopBroadcast();

        vm.serializeAddress("contracts", "HandoffRegistry", address(registry));
        vm.serializeAddress("contracts", "HandoffSettlement", address(settlement));
        vm.serializeAddress("contracts", "USDC", usdc);
        string memory contracts = vm.serializeAddress("contracts", "AttestationStore", store);

        string memory actors = vm.serializeAddress("actors", "owner", owner);

        vm.serializeUint("deployment", "chainId", block.chainid);
        vm.serializeString("deployment", "contracts", contracts);
        string memory out = vm.serializeString("deployment", "actors", actors);

        vm.writeJson(out, OUT_FILE);
        console2.log("Wrote", OUT_FILE);
    }
}
