// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title AttestationStore — Core KYC/KYB attestation storage for KUMPLY
/// @notice Stores compliance attestations on-chain with tier-based classification and a
///         fee-based read API for DApps ("Verify Once" model). L1 ComplianceGates with a
///         SaaS subscription are exempt from per-call fees via `subscribedCallers`.
/// @dev Business model:
///      - End users: free (only pay Avalanche gas)
///      - DApps querying new users: API fee off-chain ($2.50 via backend + Sumsub)
///      - DApps querying returning users: `checkCompliance()` read fee on-chain (~$0.50 in AVAX)
///      - L1 SaaS subscribers: exempt from per-call fees, billed off-chain monthly
/// @author KUMPLY Team
contract AttestationStore is AccessControl, Pausable {
    // ──────────────────────────────────────────────────────────────────
    //  Roles
    // ──────────────────────────────────────────────────────────────────

    /// @notice Role identifier for authorized verifiers
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // ──────────────────────────────────────────────────────────────────
    //  Custom Errors
    // ──────────────────────────────────────────────────────────────────

    /// @notice Thrown when a non-verifier attempts a verifier-only action
    error NotVerifier();
    /// @notice Thrown when an invalid tier (outside 1-5 range) is specified
    error InvalidTier();
    /// @notice Thrown when the attestation expiry is not in the future
    error InvalidExpiry();
    /// @notice Thrown when querying an expired attestation
    error ExpiredAttestation();
    /// @notice Thrown when a DApp calls checkCompliance without the required read fee
    error InsufficientFee();
    /// @notice Thrown when withdrawFees is called with no accumulated balance
    error NoFeesToWithdraw();
    /// @notice Thrown when the AVAX transfer in withdrawFees fails
    error TransferFailed();

    // ──────────────────────────────────────────────────────────────────
    //  Data Structures
    // ──────────────────────────────────────────────────────────────────

    /// @notice Represents a single KYC/KYB attestation for a subject address
    struct Attestation {
        bool verified;
        uint32 tier;
        uint64 timestamp;
        uint64 expiry;
        address verifier;
    }

    /// @notice Configuration for each KYC tier level
    struct TierConfig {
        string name;
        string description;
    }

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    /// @notice Mapping of subject address to their attestation data
    mapping(address => Attestation) public attestations;

    /// @notice Mapping of tier ID (1-5) to tier configuration
    mapping(uint32 => TierConfig) public tiers;

    /// @notice Reference to AvaCloud's EncryptedERC contract for encrypted proof minting
    address public eercToken;

    /// @notice Counter of total attestations ever issued
    uint256 public totalAttestations;

    /// @notice Per-call read fee (in wei) that non-subscribed DApps pay via checkCompliance
    /// @dev Represents the "Verify Once" model: ~$0.50 in AVAX. Set by admin. Default: 0.
    uint256 public verificationFee;

    /// @notice Cumulative fees collected from DApp compliance checks
    uint256 public totalFeesCollected;

    /// @notice Addresses exempt from per-call fees (L1 ComplianceGates with SaaS subscriptions)
    /// @dev Admin grants/revokes subscriptions via setSubscription(). Off-chain billing handled separately.
    mapping(address => bool) public subscribedCallers;

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new attestation is issued
    event AttestationIssued(
        address indexed subject,
        uint32 tier,
        uint64 expiry,
        address indexed verifier
    );

    /// @notice Emitted when an attestation is revoked
    event AttestationRevoked(address indexed subject, address indexed verifier);

    /// @notice Emitted when a verifier is added
    event VerifierAdded(address indexed verifier);

    /// @notice Emitted when a verifier is removed
    event VerifierRemoved(address indexed verifier);

    /// @notice Emitted when the contract is paused
    event ContractPaused(address indexed admin);

    /// @notice Emitted when the contract is unpaused
    event ContractUnpaused(address indexed admin);

    /// @notice Emitted when the eERC token reference is updated
    event EercTokenUpdated(address indexed oldToken, address indexed newToken);

    /// @notice Emitted when a DApp pays the read fee via checkCompliance
    event ComplianceChecked(address indexed caller, address indexed subject, uint256 feePaid);

    /// @notice Emitted when the per-call verification fee is updated
    event VerificationFeeUpdated(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when a caller's SaaS subscription status changes
    event SubscriptionUpdated(address indexed caller, bool subscribed);

    /// @notice Emitted when accumulated fees are withdrawn by admin
    event FeesWithdrawn(address indexed admin, uint256 amount);

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    /// @notice Initializes the AttestationStore with admin role and tier definitions
    /// @param _admin The address to receive DEFAULT_ADMIN_ROLE
    /// @param _eercToken The address of AvaCloud's EncryptedERC contract (address(0) for Phase 1)
    constructor(address _admin, address _eercToken) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        eercToken = _eercToken;

        tiers[1] = TierConfig("Basic", "Email + phone verification");
        tiers[2] = TierConfig("Standard", "Government ID + liveness detection");
        tiers[3] = TierConfig("Enhanced", "Proof of address + source of funds");
        tiers[4] = TierConfig("Business", "KYB - Company registration + UBO disclosure");
        tiers[5] = TierConfig("Agent", "KYA - Know Your Agent bot verification");
    }

    // ──────────────────────────────────────────────────────────────────
    //  Verifier Management
    // ──────────────────────────────────────────────────────────────────

    /// @notice Grants the VERIFIER_ROLE to a new address
    /// @param _verifier The address to authorize as a verifier
    function addVerifier(address _verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VERIFIER_ROLE, _verifier);
        emit VerifierAdded(_verifier);
    }

    /// @notice Revokes the VERIFIER_ROLE from an address
    /// @param _verifier The address to deauthorize
    function removeVerifier(address _verifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(VERIFIER_ROLE, _verifier);
        emit VerifierRemoved(_verifier);
    }

    /// @notice Checks if an address has the VERIFIER_ROLE
    /// @param _verifier The address to check
    /// @return True if the address is an authorized verifier
    function isVerifier(address _verifier) external view returns (bool) {
        return hasRole(VERIFIER_ROLE, _verifier);
    }

    /// @notice Pauses attestation issuance — emergency circuit breaker
    /// @dev Read functions (verify, checkCompliance) remain available while paused
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit ContractPaused(msg.sender);
    }

    /// @notice Unpauses attestation issuance
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Attestation Operations
    // ──────────────────────────────────────────────────────────────────

    /// @notice Issues a new attestation for a subject address
    /// @param _subject The address to attest
    /// @param _tier The KYC tier level (1-5)
    /// @param _expiry The UNIX timestamp when the attestation expires
    function issueAttestation(
        address _subject,
        uint32 _tier,
        uint64 _expiry
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused {
        if (_tier < 1 || _tier > 5) revert InvalidTier();
        if (_expiry <= uint64(block.timestamp)) revert InvalidExpiry();

        attestations[_subject] = Attestation({
            verified: true,
            tier: _tier,
            timestamp: uint64(block.timestamp),
            expiry: _expiry,
            verifier: msg.sender
        });

        totalAttestations++;

        emit AttestationIssued(_subject, _tier, _expiry, msg.sender);
    }

    /// @notice Free public read — always available (even paused). Use for auditing and end-user checks.
    /// @param _subject The address to verify
    /// @return verified Whether the subject has a valid (non-expired) attestation
    /// @return tier The KYC tier level (0 if not verified)
    /// @return timestamp When the attestation was issued
    /// @return expiry When the attestation expires
    function verify(address _subject) external view returns (
        bool verified,
        uint32 tier,
        uint64 timestamp,
        uint64 expiry
    ) {
        Attestation memory att = attestations[_subject];
        if (att.verified && att.expiry > uint64(block.timestamp)) {
            return (true, att.tier, att.timestamp, att.expiry);
        }
        return (false, 0, 0, 0);
    }

    /// @notice Revokes an attestation for a given subject
    /// @param _subject The address whose attestation should be revoked
    function revoke(address _subject) external onlyRole(VERIFIER_ROLE) {
        delete attestations[_subject];
        emit AttestationRevoked(_subject, msg.sender);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Fee-Based Compliance API ("Verify Once" model)
    // ──────────────────────────────────────────────────────────────────

    /// @notice Billable compliance check for DApps integrating the "Verify Once" model.
    ///         Collects the per-call read fee when a verified user is found.
    ///         Subscribed callers (L1 ComplianceGates with SaaS plans) are fee-exempt.
    /// @dev Fee is only collected when the subject IS verified — failed checks do not charge.
    ///      If the outer call reverts (e.g. insufficient tier in ComplianceGate), fee is also rolled back.
    /// @param _subject The address to check
    /// @return verified True if subject has a valid, non-expired attestation
    /// @return tier The KYC tier (0 if not verified)
    function checkCompliance(address _subject) external payable returns (bool verified, uint32 tier) {
        Attestation memory att = attestations[_subject];
        bool ok = att.verified && att.expiry > uint64(block.timestamp);

        if (ok && !subscribedCallers[msg.sender] && verificationFee > 0) {
            if (msg.value < verificationFee) revert InsufficientFee();
            unchecked { totalFeesCollected += msg.value; }
            emit ComplianceChecked(msg.sender, _subject, msg.value);
        }

        return (ok, ok ? att.tier : 0);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Fee Administration
    // ──────────────────────────────────────────────────────────────────

    /// @notice Admin sets the per-call read fee in wei for non-subscribed DApps
    /// @dev Set to 0 to disable fees (e.g. during launch / incentive periods)
    /// @param _fee The fee in wei (e.g. 500000000000000 for 0.0005 AVAX at $1000/AVAX ≈ $0.50)
    function setVerificationFee(uint256 _fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 old = verificationFee;
        verificationFee = _fee;
        emit VerificationFeeUpdated(old, _fee);
    }

    /// @notice Admin grants or revokes SaaS subscription status for a ComplianceGate address
    /// @dev Subscribed callers bypass per-call fees — intended for L1s on monthly/annual plans
    /// @param _caller The ComplianceGate (or any contract) address to update
    /// @param _subscribed True to subscribe (fee-exempt), false to revoke
    function setSubscription(address _caller, bool _subscribed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        subscribedCallers[_caller] = _subscribed;
        emit SubscriptionUpdated(_caller, _subscribed);
    }

    /// @notice Admin withdraws all accumulated compliance fees to their wallet
    function withdrawFees() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NoFeesToWithdraw();
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit FeesWithdrawn(msg.sender, amount);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Tier Queries
    // ──────────────────────────────────────────────────────────────────

    /// @notice Retrieves the configuration for a specific tier
    /// @param _tierId The tier ID (1-5)
    /// @return name The tier name
    /// @return description The tier description
    function getTier(uint32 _tierId) external view returns (string memory name, string memory description) {
        if (_tierId < 1 || _tierId > 5) revert InvalidTier();
        TierConfig memory config = tiers[_tierId];
        return (config.name, config.description);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Admin Configuration
    // ──────────────────────────────────────────────────────────────────

    /// @notice Updates the eERC token reference (Phase 2 — encrypted proofs)
    /// @dev Can be set post-deployment once AvaCloud EncryptedERC is available
    /// @param _eercToken The new EncryptedERC contract address
    function setEercToken(address _eercToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        address oldToken = eercToken;
        eercToken = _eercToken;
        emit EercTokenUpdated(oldToken, _eercToken);
    }

    /// @notice Accepts direct AVAX transfers (e.g. manual top-ups or fee overages)
    receive() external payable {}
}
