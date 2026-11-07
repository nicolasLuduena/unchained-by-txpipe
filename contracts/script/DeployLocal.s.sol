// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {HandoffRegistry} from "../src/HandoffRegistry.sol";
import {HandoffSettlement} from "../src/HandoffSettlement.sol";
import {IHandoffRegistry} from "../src/interfaces/IHandoffRegistry.sol";
import {StubAttestationStore} from "../src/stubs/StubAttestationStore.sol";
import {StubUSDC} from "../src/stubs/StubUSDC.sol";

/// @notice Full local demo state on a fresh anvil. Run from contracts/:
///   forge script script/DeployLocal.s.sol --rpc-url local --broadcast --slow
/// Anvil default accounts: 0 owner, 1 seller, 2 buyer, 3 issuer, 4 unverified, 5 venue PSAV, 6 venue order key.
contract DeployLocal is Script {
    string internal constant MNEMONIC = "test test test test test test test test test test test junk";
    string internal constant OUT_DIR = "../deployments";
    string internal constant OUT_FILE = "../deployments/local.json";

    uint256 internal constant SELLER_UNITS = 100;
    uint256 internal constant BUYER_USDC = 100e6;

    uint256 internal ownerPk;
    uint256 internal issuerPk;
    address internal seller;
    address internal buyer;
    address internal issuer;
    address internal unverified;
    address internal venue;
    address internal orderKey;

    StubAttestationStore internal store;
    StubUSDC internal usdc;
    HandoffRegistry internal registry;
    HandoffSettlement internal settlement;
    address internal token;

    function run() external {
        _loadActors();
        _deployCore();
        _registerDemoToken();
        _showRefusal();
        _writeDeployment();
    }

    function _loadActors() internal {
        ownerPk = vm.deriveKey(MNEMONIC, 0);
        issuerPk = vm.deriveKey(MNEMONIC, 3);
        seller = vm.addr(vm.deriveKey(MNEMONIC, 1));
        buyer = vm.addr(vm.deriveKey(MNEMONIC, 2));
        issuer = vm.addr(issuerPk);
        unverified = vm.addr(vm.deriveKey(MNEMONIC, 4));
        venue = vm.addr(vm.deriveKey(MNEMONIC, 5));
        orderKey = vm.addr(vm.deriveKey(MNEMONIC, 6));
    }

    function _deployCore() internal {
        address owner = vm.addr(ownerPk);
        uint64 expiry = uint64(block.timestamp + 365 days);

        vm.startBroadcast(ownerPk);
        store = new StubAttestationStore();
        usdc = new StubUSDC();
        registry = new HandoffRegistry(owner, address(store));
        settlement = new HandoffSettlement(address(registry), address(usdc));
        registry.setSettlement(address(settlement));

        store.attest(seller, 2, expiry);
        store.attest(buyer, 2, expiry);
        store.attest(issuer, 4, expiry);
        usdc.mint(buyer, BUYER_USDC);
        vm.stopBroadcast();
    }

    function _registerDemoToken() internal {
        address[] memory attesters = new address[](1);
        attesters[0] = address(store);

        vm.startBroadcast(issuerPk);
        token = registry.registerToken(
            IHandoffRegistry.RegisterParams({
                name: "Fideicomiso Torre Demo",
                symbol: "TDEMO",
                depositRef: "DEMO-DEPOSITO-0001 (ficticio)",
                cnvAuthRef: "DEMO-CNV-RESFC-0000 (ficticia, 100% tokenizado)",
                issuanceDocHash: keccak256("Fideicomiso Torre Demo: documento de emision ficticio"),
                authorizedSupply: 1000,
                attesters: attesters,
                flags: 0
            })
        );
        registry.addVenue(token, venue, orderKey);
        registry.setBand(token, 2_500000, 1000, 0);
        registry.mint(token, seller, SELLER_UNITS);
        vm.stopBroadcast();
    }

    /// @dev Simulated with a prank, so the refusal is logged and no failing transaction reaches the chain.
    function _showRefusal() internal {
        vm.prank(issuer);
        try registry.mint(token, unverified, 1) {
            revert("mint to the unverified actor was not refused");
        } catch (bytes memory reason) {
            require(
                keccak256(reason)
                    == keccak256(abi.encodeWithSelector(IHandoffRegistry.ReceiverNotAttested.selector, unverified)),
                "refused for the wrong reason"
            );
            console2.log("Mint refused for the unverified actor (ReceiverNotAttested):", unverified);
        }
    }

    function _writeDeployment() internal {
        vm.serializeAddress("contracts", "HandoffRegistry", address(registry));
        vm.serializeAddress("contracts", "HandoffSettlement", address(settlement));
        vm.serializeAddress("contracts", "USDC", address(usdc));
        vm.serializeAddress("contracts", "AttestationStore", address(store));
        string memory contracts = vm.serializeAddress("contracts", "DemoToken", token);

        vm.serializeAddress("actors", "owner", vm.addr(ownerPk));
        vm.serializeAddress("actors", "seller", seller);
        vm.serializeAddress("actors", "buyer", buyer);
        vm.serializeAddress("actors", "issuer", issuer);
        vm.serializeAddress("actors", "unverified", unverified);
        vm.serializeAddress("actors", "venue", venue);
        string memory actors = vm.serializeAddress("actors", "orderKey", orderKey);

        vm.serializeUint("deployment", "chainId", block.chainid);
        vm.serializeString("deployment", "contracts", contracts);
        string memory out = vm.serializeString("deployment", "actors", actors);

        vm.createDir(OUT_DIR, true);
        vm.writeJson(out, OUT_FILE);
        console2.log("Wrote", OUT_FILE);
    }
}
