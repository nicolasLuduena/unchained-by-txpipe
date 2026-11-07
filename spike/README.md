# Handoff Fuji spike (ticket #15)

## Status

| Acceptance criterion | State |
|---|---|
| Two accounts deployed on Fuji with sponsored op hashes | **Blocked.** The paymaster returns HTTP 500 on the team key. No op was sent, so there are no hashes yet. |
| Smart-account signature verifies through SignatureChecker | **Proven on a Fuji fork** against the real deployed contracts. Not yet run on live Fuji, because it needs deployed accounts. |
| `verify()` returns the expected tier for accounts and issuer | **Blocked on KUMPLY.** All three read `verified=false` today. |
| Faucet USDC in buyer accounts, faucet AVAX in the unverified EOA | **Not done.** Every address holds 0 AVAX and 0 USDC. |
| README records allocation and tier-5-only lane | Tier 5 only is confirmed from the 0xGasless docs. The allocation is still unknown. |

## Signature scheme

`account.signMessage(digest)` signs **EIP-191 over the 32 raw digest bytes**, then wraps the result as `abi.encode(bytes sig65, address ecdsaModule)`: 192 bytes in total.

| The 65-byte signature recovers the owner from | Result |
|---|---|
| Raw digest | false |
| EIP-191 over the 32 bytes | **true** |
| EIP-191 over the hex string | false |

On-chain, `SmartAccount.isValidSignature` decodes `(moduleSignature, module)`, reverts unless the module is enabled, and forwards the call. The module then accepts a recovery of the owner from `toEthSignedMessageHash(dataHash)` **or** from `dataHash` itself. Verified source: Routescan. Behaviour: the fork run below.

Module wrapping is required, and the SDK does it. A bare 65-byte signature fails.

### Settlement

`isValidSignatureNow(seller, digest, sig)` works with no change. Results from `check()` in `contracts/SigProbe.sol`, OZ 5.1:

| Signature | `digest` | `toEthSignedMessageHash(digest)` |
|---|---|---|
| SDK `signMessage` | true | true |
| Owner `signTypedData`, wrapped by hand | true | false |
| ERC-6492 blob | false | false |
| Stranger key, bare 65 bytes, unknown module, wrong digest | false | false |

- The `toEthSignedMessageHash` fallback is not needed for smart accounts. Keep it only if EOA sellers sign with `personal_sign`.
- Owner `signTypedData` also verifies once wrapped, so a wallet can show readable order fields instead of a blind hash.
- The module does not bind a signature to one account: the owner's other accounts would accept it too. `Order.seller` in the digest closes that, so it must stay in the type string.

### Requirements for the order flow

- **The seller account must be deployed before `announceOrder` or `fill`.** Undeployed, the SDK returns an ERC-6492 blob (608 bytes), and SignatureChecker does not support ERC-6492, so it fails. A stripped signature also fails while there is no code.
- **Do not reuse a client across deployment.** The SDK caches `NOT_DEPLOYED`, so a client that saw the account undeployed keeps returning ERC-6492 after deployment. Create a new client after the first op, or unwrap the blob: the inner signature verifies once deployed, including one signed before deployment.
- **Pass the digest as `0x`-prefixed hex or a `Uint8Array`.** Without `0x` the SDK signs the text, and verification fails.
- **Pass `defaultValidationModule` and `activeValidationModule`.** Without them nothing throws, but the client computes a different address (seen on the fork: `0xfe5B...` instead of `0x5353...`). An attestation issued to that address would be useless.

Signer kinds: viem local account, viem WalletClient and ethers 5 Wallet produce identical bytes.

Reproduce: `anvil --fork-url $FUJI_RPC_URL --chain-id 43113 --port 8599`, then `forge build && npm run fork:sig`. Output: `evidence/fork-signature-proof.json`. The same run deploys a second account through `EntryPoint.handleOps` with an SDK-signed `executeBatch` of approve plus a fill stand-in. It was prefunded, not sponsored, and its signature verifies too.

## Browser and Node

**The SDK runs in a Next.js client bundle.** A Next 16.4.5 Turbopack production build ran in headless Chromium: it created the client, read the counterfactual address from live Fuji and signed. A sponsored send from a browser was not tested.

- ethers is not needed at runtime. The dist imports only viem, merkletreejs and tslib.
- Add `merkletreejs` and `tslib` as direct dependencies. A plain install of 0.0.13 did not bring them in.
- Bundler and paymaster both answer CORS preflight with `*`.
- The paymaster URL embeds the key, so keep it out of `NEXT_PUBLIC_*`. Point the client at a same-origin route that forwards to the paymaster. Signing stays client-side.

**Call shape** (`npm run batch-shape`, against a local mock, so this shows the SDK's output and not paymaster acceptance):

```ts
await account.sendTransaction(
  [{ to: USDC, data: approve, value: 0n }, { to: settlement, data: fill, value: 0n }],
  { paymasterServiceData: { mode: PaymasterMode.SPONSORED } },
);
```

This sends one user operation with `executeBatch_y6U` (selector `0x00004680`). Two or more transactions select the batch. Leave `calculateGasLimits` unset: `false` makes the SDK estimate first, which fails with AA21 on an unfunded account and then crashes on 0.0.13.

**`@0xgasless/core` 1.3.0** holds factory, implementation, fallback and module, and applies them automatically, but only inside `OxGasClient` for chain 43113. Calling `createSmartAccountClient` directly still needs the overrides. Two more points:

- `OxGasClient.signMessage` goes to `auth.signMessage`, without the module wrapper, so by reading the code it would need wrapping by hand. Not tested.
- Core uses `@0xgasless/smart-account-sdk` 0.0.15. npm marks `@0xgasless/smart-account` 0.0.13 as superseded. In the dist diff, the account and ECDSA module files are unchanged, so the signature findings carry over, but 0.0.15 itself was not run. The KUMPLY quickstart still pins 0.0.13.

## Fuji addresses

| Contract | Address |
|---|---|
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| Factory | `0xF0b3f5146c2725e36d78F5029bc560eDfc67ADe0` |
| Implementation | `0x8aF33bE7af021A6075aeB19b076fC75Bfbd2c5c3` |
| Fallback handler | `0xdA62055b0730d1d0621aD0A446DcD6057a6d951E` |
| ECDSA module | `0xcfb0BA514aa398085D63eC70cfEa6EC7f1094E8F` |
| Verifying paymaster | `0xC68dAd686fcAe526dB286d84E1Fc8aDdc7b2FE98` |
| KUMPLY AttestationStore | `0xa3Bc5564A18e107807aF41fF2a5215Db050b22dD` |
| KUMPLY verifier (holds `VERIFIER_ROLE`) | `0xD65042534CE80fcb641fd6Eb99a16eBF6C0cd076` |
| USDC | `0x5425890298aed601595a70AB815c96711a31Bc65` |

Bundler: `https://bundler.0xgasless.com/43113`. It answers `eth_chainId` and lists the EntryPoint above.

| Index | Role | Address |
|---|---|---|
| 0 | Deployer | `0x812440cC8Fb6A64FB99C7126DDC55C01E5492AAD` |
| 1 | Issuer | `0x19287BA707706A279B17e0f9DC69ea3028Be5D66` |
| 2 | Unverified EOA | `0x2b54F241C9281cEf9cBC6BC4164dd6e91A8682f9` |
| 3 | Seller owner | `0x772d06a443692F0AE3fcC32CFFcc767799D66260` |
| | **Seller smart account** (SDK index 0) | `0x5140444Eb26DB0e8b059e834c88Aa2b0586d3AE3` |
| 4 | Buyer owner | `0x239D854b0e08563012363A112d86fBE657DA7A20` |
| | **Buyer smart account** (SDK index 0) | `0xEf587ADb45895c0535DCc8bD424d67c7CA9C1D90` |
| 5 | Venue PSAV | `0x775A0CE1ced97d24d5ad719fFc6309E7179f140f` |
| 6 | Venue orderKey | `0x09A4D5ed872F00b067B863ef0593F3E85EF79ae7` |

## Sponsored deployment: blocker

`npm run deploy-accounts -- --dry` fails at `pm_sponsorUserOperation`:

```
HTTP 500 {"code":-32603,"message":"Internal error"}
```

What was ruled out:

- The key file is well formed: one line, 46 characters, no URL or quoting.
- The op is fine: the request matches the documented call, and explicit gas limits fail the same way.
- The service is up: other methods return `Method not found`.

**A placeholder key gets the identical 500**, so the service treats the team key as it treats a key that does not exist. The cause is not visible from here. The likely candidates are that the key is not active for Fuji, or that the project has no sponsorship set up. The attestation is not the likely cause on the team key, since the docs scope that check to the KUMPLY lane key. Hashes go in the table below once this clears.

| Account | userOpHash | Transaction |
|---|---|---|
| Seller | pending | pending |
| Buyer | pending | pending |

## Human runbook

**1. 0xGasless mentor, or https://dashboard.0xgasless.com** (Google sign-in; docs say to create a project and copy the key, and the dashboard's free plan lists Fuji)

- Why does `pm_sponsorUserOperation` on `https://paymaster.0xgasless.com/v1/43113/rpc/<key>` return `-32603 Internal error`, the same as for an invalid key? Is the key active for 43113?
- Does the project need a policy, a contract allowlist or a funded balance before it sponsors?
- What is the hackathon allocation? The rule sheet's 1,500 wallets does not match the public 1,000 MAU, 10,000 transactions and $50 credit.
- Set the contract allowlist and the per-user rate limit.
- Confirm the lane is tier 5 only. The docs already say so: "Any tier other than 5: Refused".

**2. KUMPLY mentor.** There is no self-service route. Only `VERIFIER_ROLE` can issue, and `kumply.xyz/build` says demo attestations are issued directly by KUMPLY's team. `kumply.xyz/verify` is a wallet-connected Sumsub KYC flow, and `POST /api/token` needs an API key. Ask for demo attestations on Fuji store `0xa3Bc5564A18e107807aF41fF2a5215Db050b22dD`:

- Seller smart account `0x5140444Eb26DB0e8b059e834c88Aa2b0586d3AE3`: tier 2
- Buyer smart account `0xEf587ADb45895c0535DCc8bD424d67c7CA9C1D90`: tier 2
- Issuer `0x19287BA707706A279B17e0f9DC69ea3028Be5D66`: tier 4
- Optional: an agent smart account at tier 5, and the lane URL if we use it
- How long does issuance take?

Attest the smart accounts, not the owner EOAs. Both accounts can be attested before they are deployed.

**3. Faucets**

- AVAX: https://core.app/tools/testnet-faucet/?subnet=c to the deployer and the unverified EOA.
- USDC: Circle faucet, https://faucet.circle.com (20 per address every two hours), to both smart accounts. This works before deployment.

**4. Run**, from `spike/` after `npm install`, `forge build` and copying `.env.example` to `.env`:

```sh
npm run deploy-accounts -- --dry   # paymaster check, sends nothing
npm run deploy-accounts            # writes evidence/fuji-accounts.json
npm run verify-1271                # needs AVAX on the deployer
npm run check-attestations         # exits 1 until all tiers match
npm run addresses                  # balances for every role
npm run diag-paymaster             # raw exchange, key redacted
```

`verify-1271` was run end to end on a fork (`npm run fork:seed` with `FUJI_RPC_URL` set to the fork): `direct=true`, `wrapped=true` for both demo accounts. Any Snowtrace link it prints on a fork is not a real transaction.

The KUMPLY Fuji attestations are demonstrations with no identity verification behind them.
