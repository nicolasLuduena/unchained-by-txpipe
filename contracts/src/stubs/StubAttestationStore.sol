// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAttestationStore} from "../interfaces/IAttestationStore.sol";

/// @notice Test double for the KUMPLY store. Same verify semantics: expired or revoked reads as all zeros.
contract StubAttestationStore is IAttestationStore {
    struct Record {
        uint32 tier;
        uint64 timestamp;
        uint64 expiry;
    }

    mapping(address => Record) private records;

    function attest(address subject, uint32 tier, uint64 expiry) external {
        records[subject] = Record(tier, uint64(block.timestamp), expiry);
    }

    function revoke(address subject) external {
        delete records[subject];
    }

    function verify(address subject) external view returns (bool, uint32, uint64, uint64) {
        Record memory r = records[subject];
        if (r.tier == 0 || r.expiry <= block.timestamp) return (false, 0, 0, 0);
        return (true, r.tier, r.timestamp, r.expiry);
    }
}
