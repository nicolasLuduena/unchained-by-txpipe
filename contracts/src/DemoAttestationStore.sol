// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAttestationStore} from "./interfaces/IAttestationStore.sol";

/// @notice Team-run demo attester on Fuji. It is not KUMPLY's store and performs no identity verification.
/// It exposes the read surface the KUMPLY SDK uses, so the SDK reads it by passing this address as contractAddress.
/// The attester set is a registry parameter: a PSAV's or KUMPLY's own store replaces this one with no contract change.
contract DemoAttestationStore is IAttestationStore {
    struct Attestation {
        bool verified;
        uint32 tier;
        uint64 timestamp;
        uint64 expiry;
        address verifier;
    }

    error NotVerifier(address caller);
    error InvalidTier(uint32 tier);

    event Attested(address indexed subject, uint32 tier, uint64 expiry);
    event Revoked(address indexed subject);

    address public immutable verifier;
    uint256 public totalAttestations;
    mapping(address => Attestation) public attestations;

    modifier onlyVerifier() {
        if (msg.sender != verifier) revert NotVerifier(msg.sender);
        _;
    }

    constructor(address verifier_) {
        verifier = verifier_;
    }

    function attest(address subject, uint32 tier, uint64 expiry) external onlyVerifier {
        if (tier == 0 || tier > 5) revert InvalidTier(tier);
        if (!attestations[subject].verified) totalAttestations++;
        attestations[subject] = Attestation(true, tier, uint64(block.timestamp), expiry, msg.sender);
        emit Attested(subject, tier, expiry);
    }

    function revoke(address subject) external onlyVerifier {
        if (attestations[subject].verified) totalAttestations--;
        delete attestations[subject];
        emit Revoked(subject);
    }

    function isVerifier(address account) external view returns (bool) {
        return account == verifier;
    }

    function verify(address subject) external view returns (bool, uint32, uint64, uint64) {
        Attestation memory a = attestations[subject];
        if (!a.verified || a.expiry <= block.timestamp) return (false, 0, 0, 0);
        return (true, a.tier, a.timestamp, a.expiry);
    }
}
