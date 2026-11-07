// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IHandoffRegistry} from "../src/interfaces/IHandoffRegistry.sol";

/// @notice Registers the fictional demo trust certificate on Fuji as the issuer, names the venue, sets the band and
/// mints to the attested accounts. Needs ISSUER_PRIVATE_KEY, REGISTRY, STORE, VENUE, ORDER_KEY, SELLER and BUYER.
contract SeedFuji is Script {
    function run() external {
        require(block.chainid == 43113, "not Fuji");
        IHandoffRegistry registry = IHandoffRegistry(vm.envAddress("REGISTRY"));
        address[] memory attesters = new address[](1);
        attesters[0] = vm.envAddress("STORE");

        vm.startBroadcast(vm.envUint("ISSUER_PRIVATE_KEY"));
        address token = registry.registerToken(
            IHandoffRegistry.RegisterParams({
                name: "Fideicomiso Torre Demo",
                symbol: "TDEMO",
                depositRef: "DEMO-CVSA-0001",
                cnvAuthRef: "DEMO-CNV-AUT-0001",
                issuanceDocHash: keccak256("Prospecto de demostracion, Fideicomiso Torre Demo"),
                authorizedSupply: 1000,
                attesters: attesters,
                flags: 0
            })
        );
        registry.addVenue(token, vm.envAddress("VENUE"), vm.envAddress("ORDER_KEY"));
        registry.setBand(token, 2_500000, 1000, 0);
        registry.mint(token, vm.envAddress("SELLER"), 100);
        registry.mint(token, vm.envAddress("BUYER"), 20);
        vm.stopBroadcast();

        console2.log("DemoToken", token);
    }
}
