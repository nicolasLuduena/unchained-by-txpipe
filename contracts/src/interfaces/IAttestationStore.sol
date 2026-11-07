// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The read surface of the KUMPLY AttestationStore. `verify` checks expiry; raw `attestations()` does not.
/// Mapping: person is verified && tier in [2,3], business is tier == 4, agent is tier == 5.
interface IAttestationStore {
    function verify(address subject)
        external
        view
        returns (bool verified, uint32 tier, uint64 timestamp, uint64 expiry);
}
