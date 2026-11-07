> **Demo attestations.** Every attestation on Fuji is a demo attestation with no real identity verification. The KUMPLY mainnet store holds zero attestations.
>
> The Fuji store in this demo is the team's own instance of KUMPLY's unmodified open-source AttestationStore. It is not KUMPLY's official store, and KUMPLY issued none of these attestations.

# Handoff

A white-label trading layer for Argentina's tokenized securities, built for the HackaTwin Blockchain track on Avalanche Fuji. A holder signs a sell order for free inside a wallet they already use. A verified buyer fills it in one tap with no gas. One atomic transaction moves tokens and USDC, the contract enforces a price band, and the token refuses any transfer to an unverified receiver or outside the venue path.

Handoff is software, built to the structure of Título XXII of the CNV Normas and operated by a PSAV. It holds no assets, holds no fiat and takes nothing from trades. The spec is [issue #1](https://github.com/nicolasLuduena/unchained-by-txpipe/issues/1), written under an earlier working name. The pitch script and Q&A are in [docs/pitch.md](docs/pitch.md), and the design in [docs/architecture.md](docs/architecture.md).

**TODO: demo video link.** Not recorded yet.

**TODO: wallet screen screenshot.** Not captured yet.

## Deliverables checklist

- [x] [Verified contract addresses with Snowtrace links](#deployed-contracts): the three Handoff contracts plus the demo attestation store
- [x] [End-user interface](#install): wallet screen at `/`, issuer and PSAV console at `/console`
- [x] [Why Avalanche](#why-avalanche): five-validator L1 mapping, finality of about one second, ICM
- [x] [Built today versus libraries used](#built-today-versus-libraries)
- [x] [Bonus section: 0xGasless components and sponsored user operation links](#bonus-0xgasless)
- [x] [Bonus section: KUMPLY on-chain hook, SDK calls, pass and block transactions](#bonus-kumply)
- [x] [Demo-attestation disclaimer on the first screen](#handoff)
- [ ] Demo video link (TODO, see above)
- [ ] Wallet screen screenshot (TODO, see above)
- [x] [Known gaps](#known-gaps)
- [x] [Business model: problem, customer, revenue, competitive advantage](#business-model)
- [x] [Installation](#install), [deployment](#deploy-to-fuji) and [architecture](#architecture)

## Deployed contracts

Avalanche Fuji C-Chain, chain ID 43113. All four are verified through Routescan, which serves testnet.snowtrace.io. Source of the addresses: [`deployments/fuji.json`](deployments/fuji.json).

| Contract | Address | What it is |
|---|---|---|
| HandoffRegistry | [`0x38309B99e1c948485D84af640740796DF8D43e61`](https://testnet.snowtrace.io/address/0x38309B99e1c948485D84af640740796DF8D43e61) | Tokens, venues, attesters, price band, pause, reversion |
| HandoffSettlement | [`0xe8Fb478743079C72DAB6EE81cdAfc62AC4bc7201`](https://testnet.snowtrace.io/address/0xe8Fb478743079C72DAB6EE81cdAfc62AC4bc7201) | Stateless atomic fill. No escrow, no balances, no fee |
| HandoffToken (TDEMO) | [`0x4b5e259f9bA7fB2b88A2911aC1778963eC9953dE`](https://testnet.snowtrace.io/address/0x4b5e259f9bA7fB2b88A2911aC1778963eC9953dE) | Wrapper token of the fictional demo trust, "Fideicomiso Torre Demo" |
| AttestationStore | [`0x94b711809FDb5dcFdD2eD488EE10790DaFdC1c10`](https://testnet.snowtrace.io/address/0x94b711809FDb5dcFdD2eD488EE10790DaFdC1c10) | The team's demo instance of KUMPLY's store, see [Bonus: KUMPLY](#bonus-kumply) |

Payment leg: Circle's Fuji USDC, [`0x5425890298aed601595a70AB815c96711a31Bc65`](https://testnet.snowtrace.io/address/0x5425890298aed601595a70AB815c96711a31Bc65), which the team did not deploy.

## What ran on Fuji

Each row is a real transaction, read from [`spike/evidence/`](spike/evidence). **These were sent by the scripts in `spike/scripts/`, not by clicking through the wallet screen.**

| Scene | Result | Transaction |
|---|---|---|
| Seller smart account deployed, sponsored | Success | [`0x1c90...0599`](https://testnet.snowtrace.io/tx/0x1c900e863cef505bfe1c8d4f350823adac6ec30719cabdf1e24e852d4be00599) |
| Buyer smart account deployed, sponsored | Success | [`0xf204...e446`](https://testnet.snowtrace.io/tx/0xf2046c0bd65330e25245c7272653c9f6ff8899e4351190b147ff5230ecf5e446) |
| Order announced by the venue's order key | Success | [`0x55e7...f0c2`](https://testnet.snowtrace.io/tx/0x55e7c57cbba5c134291e34af9ed79095d322d7e53fdcac9ccee0da437de5f0c2) |
| Live fill: 2 units at USDC 2.50, approve and fill in one sponsored user operation | Success | [`0xb5a2...ed2a`](https://testnet.snowtrace.io/tx/0xb5a2b229170c48f68b399327b594a4a7e979ea81fce3981eeef898e12c18ed2a) |
| Unverified EOA calls `fill` with a valid venue co-signature | Reverted, `ReceiverNotAttested` | [`0x57dc...364f`](https://testnet.snowtrace.io/tx/0x57dcd1147d18153b4c601bcb1dd693278bb44b2611f96a52854bb0225793364f) |
| Attested holder transfers directly to the unverified EOA | Reverted, `ReceiverNotAttested` | [`0xd72b...64a2`](https://testnet.snowtrace.io/tx/0xd72bbc87e3389a8281f48a6d0057287d538ed579dd63ab767c5999a68c3e64a2) |
| Attested holder transfers directly to an attested holder, outside the venue path | Reverted, `NotRoutedThroughVenue` | [`0x4554...5f3b`](https://testnet.snowtrace.io/tx/0x4554b2f23dc30c2db6bffd89c64a19d4ece8c93d2350d4d919f5aeeaf0ef5f3b) |
| Reversion to paper: the PSAV burns 1 unit against `DEMO-CERT-0001` | Success | [`0x2c8e...3460`](https://testnet.snowtrace.io/tx/0x2c8e4a20b1d894e22526273c646cc53ad3d69f0e0bec8518fa0452b007163460) |

After the fill the seller held 98 units and USDC 5, the buyer 22 units and USDC 15, and the settlement contract zero of both. The reversion then took the buyer to 21.

Three things to read correctly:

- **The two direct-transfer refusals used the issuer EOA as the attested holder, not the seller smart account.** The issuer (tier 4) was minted 1 unit for this scene and signed the transfers itself. The spec describes the attested seller attempting it; that is not what ran.
- **The refused fill carried a co-signature the venue would normally withhold.** It was issued on purpose so the refusal comes from the token hook instead of `InvalidVenueSignature`. The wallet route does this only with `VENUE_DEMO_COSIGN=1`, and logs it.
- **The reason names are checkable.** The explorer shows the revert. Replaying each call against the block before it returns the same custom error.

## Why Avalanche

The regime describes a closed group of at most five operators who must keep one real-time record. That is the shape of a permissioned Avalanche L1. Fuji C-Chain is what runs today; the L1 is the roadmap.

| Título XXII | Requirement | Avalanche fit |
|---|---|---|
| Art. 5 e | At most five PSAVs per issuance, with "sincronización en tiempo real" between them | **Five-validator L1**, one validator per PSAV. Shared state is the synchronization, so venues have nothing to reconcile. `MAX_VENUES = 5` is already enforced in the registry |
| Art. 5 f | No transfer outside the designated PSAVs or into decentralized protocols | A permissioned L1 adds control at the validator level, under the token hook that enforces this today |
| Arts. 15 and 21 | The underlying stays immobilized and the PSAVs keep the holding register, so trades can settle at any hour | **Finality of about one second** for the atomic fill: the buyer pays and receives in one transaction and sees it settled while still on the screen |
| Art. 10 | The record must sit on a DLT with immutability, verifiability and traceability | Contracts verified and readable on a public explorer |
| Liquidity and payment | The L1 is closed, while USDC and the wider market live on the C-Chain | **ICM** between the C-Chain and the L1 is how a closed venue stays connected |

Not shown in this demo: the L1, a validator set or an ICM message. The one-second figure is Avalanche's finality, not a benchmark we ran. ICM was stretch ticket [#23](https://github.com/nicolasLuduena/unchained-by-txpipe/issues/23) and was not built.

## Architecture

```
 Host wallet (fictional "Billetera Sur")         PSAV desk
 ┌──────────────────────────────────┐   ┌──────────────────────────┐
 │ Wallet screen  /                 │   │ Console  /console        │
 │ market, sell, orders, history,   │   │ venues, band, feed,      │
 │ paper. SDK: isPersonAtLeast      │   │ pause, block, burn.      │
 └───────────────┬──────────────────┘   │ SDK: isBusiness          │
                 │                      └────────────┬─────────────┘
 ┌───────────────▼────────────────────────────┐      │
 │ Next.js routes, labelled as the PSAV's:    │      │
 │ order book, venue co-signature, sponsor    │      │
 └───────┬──────────────────────┬─────────────┘      │
         │ bundler, paymaster   │ order key          │ issuer, PSAV keys
 ┌───────▼──────────┐           │                    │
 │ 0xGasless, 4337  │           │                    │
 └───────┬──────────┘           │                    │
 ┌───────▼──────────────────────▼────────────────────▼─────────────┐
 │ Fuji C-Chain                                                    │
 │ HandoffSettlement ──▶ HandoffToken hook ──▶ HandoffRegistry     │
 │ signatures, band      attested? venue?      AttestationStore    │
 └─────────────────────────────────────────────────────────────────┘
```

- **HandoffRegistry** holds, per token, the deposit and CNV authorization references, the issuance document hash, up to five venues with one order key each, the attester set, the price band, floor and pause. Registration needs a non-empty authorization reference and a business attestation for the issuer. Only the registry mints and burns.
- **HandoffToken** is an ERC-20 with zero decimals and a hook in `_update`. Between holders, a transfer needs the token unpaused, the sender unblocked, both parties attested, and the settlement contract as the caller. Otherwise it reverts with a named error.
- **HandoffSettlement** holds nothing. It verifies the seller's signature through ERC-1271, the venue's co-signature over `(orderHash, buyer)` and the band, then moves tokens and USDC in one transaction.
- **Order flow.** The seller's account signs the EIP-712 digest with `signMessage`, because the smart-account SDK has no typed-data signing. The venue's order key announces the order so it reaches the feed, and pays that gas; the holder pays nothing.

Signature findings are in [`spike/README.md`](spike/README.md). Its status table predates working sponsorship and is out of date, so use `spike/evidence/` for what happened. Full design and trust boundaries: [docs/architecture.md](docs/architecture.md).

## Install

Needs [Foundry](https://getfoundry.sh), Node and pnpm.

```bash
git clone --recurse-submodules https://github.com/nicolasLuduena/unchained-by-txpipe
cd unchained-by-txpipe/contracts && forge test
```

The web app needs Node and pnpm, not Foundry. It serves the wallet screen at `/` and the issuer console at `/console`, both with Spanish copy.

```bash
cd web
pnpm install
cp .env.example .env.local   # NEXT_PUBLIC_CHAIN=local or fuji
pnpm dev                     # http://localhost:3000
pnpm build
```

`pnpm dev` and `pnpm build` copy the design system into the app first. The app reads `deployments/<chain>.json` at startup, so restart `pnpm dev` after a redeploy; without the file it still runs, with no deployment loaded. After changing a contract interface, run `pnpm gen:abi` and commit `web/src/lib/abi/`.

To run on a local chain, with a stub store, stub USDC and fake sponsorship:

```bash
anvil
cd contracts && forge script script/DeployLocal.s.sol --rpc-url local --broadcast --slow
```

To run the app against the existing Fuji deployment, set `NEXT_PUBLIC_CHAIN=fuji` and the server-only variables in [`web/.env.example`](web/.env.example): `MNEMONIC_PATH`, `ZEROXGASLESS_KEY_PATH`, `VENUE_ORDER_KEY`, `VENUE_DEMO_COSIGN=1` and the four `AA_*` addresses. The public RPC throttles, so a private `NEXT_PUBLIC_RPC_URL` helps.

## Deploy to Fuji

Keys come from one mnemonic. Indexes: 0 deployer, 1 issuer, 2 unverified, 3 seller owner, 4 buyer owner, 5 venue PSAV, 6 venue order key. Secrets stay in files outside the repo and are read by path.

**1. Prepare.** From `spike/`: `npm install`, `forge build`, copy `.env.example` to `.env`, and run `npm run addresses` to print every role, including the smart-account addresses before they exist. Send faucet AVAX to the deployer, issuer, unverified EOA, venue and order key.

**2. Fund the gas tank.** In the 0xGasless dashboard, fund the project's gas tank with test AVAX. **If the tank is empty the bundler returns AA33** and no sponsored operation goes through.

**3. Deploy the store and issue the demo attestations.** From `contracts/`. `SELLER` and `BUYER` are the smart-account addresses, not the owner EOAs; both can be attested before they are deployed. The unverified EOA is left out on purpose.

```bash
DEPLOYER_PRIVATE_KEY=0x... SELLER=0x... BUYER=0x... ISSUER=0x... \
  forge script script/DeployKumplyStore.s.sol --rpc-url fuji --broadcast --verify
```

**4. Deploy the registry and settlement.** Pass the printed store. Without `ATTESTATION_STORE` the script defaults to KUMPLY's official store, where the demo accounts hold no attestation.

```bash
DEPLOYER_PRIVATE_KEY=0x... ATTESTATION_STORE=0x... \
  forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify
```

This rewrites `deployments/fuji.json` with only the contracts and the owner. The later steps need the rest, so add back the `actors` (seller, buyer, issuer, unverified, venue, orderKey), and after step 5 `contracts.DemoToken` and `startBlock`.

**5. Register the demo token.** The issuer registers it, names the venue, sets the band at USDC 2.50 plus or minus 10 percent, and mints 100 units to the seller and 20 to the buyer.

```bash
ISSUER_PRIVATE_KEY=0x... REGISTRY=0x... STORE=0x... VENUE=0x... ORDER_KEY=0x... SELLER=0x... BUYER=0x... \
  forge script script/SeedFuji.s.sol --rpc-url fuji --broadcast --verify
```

The token is created inside `registerToken`. If the script does not verify it, use `forge verify-contract` with the `fuji` entry in `contracts/foundry.toml` and constructor arguments `("Fideicomiso Torre Demo", "TDEMO")`.

**6. Deploy the smart accounts.** From `spike/`. The first sponsored operation deploys each account and writes `evidence/fuji-accounts.json`.

```bash
npm run deploy-accounts -- --dry   # asks the paymaster, sends nothing
npm run deploy-accounts
```

**7. Run the scenes.** Send Fuji USDC to the buyer account first ([Circle faucet](https://faucet.circle.com), 20 per address every two hours). These two scripts have no npm alias.

```bash
npx tsx scripts/live-fill.ts       # AMOUNT and PRICE override 2 units at USDC 2.50
npx tsx scripts/live-refusals.ts   # the three refusals and the reversion
```

Each writes to `spike/evidence/`, replacing the previous run.

## Bonus: 0xGasless

**Components:** ERC-4337 smart accounts from `@0xgasless/smart-account` 0.0.13, the 0xGasless bundler and its paymaster.

**Why.** The holder is a retail investor who should never meet AVAX. Sponsorship is the main flow, not an add-on: both demo accounts were deployed with sponsored operations, and the buyer's approve and fill go out as one `executeBatch`, so a fill is one tap and one transaction.

**How it is sponsored.** Through the team's own paymaster on 0xGasless: the team's project and key, with a gas tank funded with test AVAX, sponsoring human accounts. On-chain, the paymaster in each `UserOperationEvent` is the 0xGasless verifying paymaster contract on Fuji, [`0xC68dAd686fcAe526dB286d84E1Fc8aDdc7b2FE98`](https://testnet.snowtrace.io/address/0xC68dAd686fcAe526dB286d84E1Fc8aDdc7b2FE98), through EntryPoint v0.6.

**The paymaster does not check attestations.** Attestation is enforced in the token hook, where a failed check reverts. The app's sponsor route separately limits itself to the two demo accounts and the wallet's own calls, which protects the credit and is not an identity check. The rule sheet's example of a paymaster that only sponsors attested accounts is not what this does: that lane covers KYA tier 5 only, and these humans are tier 2.

| Sponsored operation | userOpHash | Transaction |
|---|---|---|
| Seller account deployment | `0x0ff9a997a6792953f02999da0682ce50db3dfa453b986534992417ba15b67c60` | [Snowtrace](https://testnet.snowtrace.io/tx/0x1c900e863cef505bfe1c8d4f350823adac6ec30719cabdf1e24e852d4be00599) |
| Buyer account deployment | `0x5ac8b721c0242a03a695cc34f51f18e418dc0e61429194057056cf0df2a97924` | [Snowtrace](https://testnet.snowtrace.io/tx/0xf2046c0bd65330e25245c7272653c9f6ff8899e4351190b147ff5230ecf5e446) |
| Live fill, approve and fill batched | `0x7037fe20011daea782453a578db824bdc988ef4916d291aa892791f95f37e6a4` | [Snowtrace](https://testnet.snowtrace.io/tx/0xb5a2b229170c48f68b399327b594a4a7e979ea81fce3981eeef898e12c18ed2a) |

Not sponsored: the PSAV's and issuer's own transactions (announce, reversion, mint), which pay AVAX from EOAs, and the unverified EOA, which pays its own gas to reach the refusal. x402 is not used.

Code: [`web/src/lib/sponsor/fuji-server.ts`](web/src/lib/sponsor/fuji-server.ts), [`spike/scripts/live-fill.ts`](spike/scripts/live-fill.ts).

## Bonus: KUMPLY

**Whose store this is.** [`0x94b7...1c10`](https://testnet.snowtrace.io/address/0x94b711809FDb5dcFdD2eD488EE10790DaFdC1c10) is the team's own Fuji instance of KUMPLY's unmodified open-source AttestationStore, vendored at [`contracts/src/vendor/kumply/`](contracts/src/vendor/kumply) under Apache-2.0, with the team as admin and verifier. **It is not KUMPLY's official store** (`0xa3Bc5564A18e107807aF41fF2a5215Db050b22dD`), **and KUMPLY did not issue these attestations.** The team issued them with no identity check, and the demo accounts hold no attestation on the official store.

**Moving to the official store.** The registry fixes its issuer attester at deployment (`issuerAttester` is immutable), so swapping to the official store means redeploying the registry, and with it the settlement and token, which are bound to that registry. An issuer can repoint the holder checks of an existing token with `setAttester`, but the business check on registration stays on the store the registry was deployed with.

**On-chain hook.** [`HandoffToken._update`](contracts/src/HandoffToken.sol) asks [`HandoffRegistry.isAttested`](contracts/src/HandoffRegistry.sol), which calls `verify(address)` on each store in the token's attester set. `registerToken` requires tier 4 on the issuer attester. Attestations are keyed by the smart account, not the owner key.

**SDK calls in the app.** Each `KumplyClient` is built with `network: "fuji"` and `contractAddress` set to the deployment's store, so it reads the team's instance and not the SDK's default. `hasTier()` is not used.

| Call | Where | Purpose |
|---|---|---|
| `isPersonAtLeast(account, TIER.STANDARD)` | [`web/src/lib/wallet/precheck.ts`](web/src/lib/wallet/precheck.ts) | Pre-check and the "verify first" state on the wallet screen |
| `isBusiness(address)` | [`web/src/lib/console/kumply.ts`](web/src/lib/console/kumply.ts) | The read behind every issuer action in the console |
| `verify(holder)` | [`web/src/lib/console/kumply.ts`](web/src/lib/console/kumply.ts) | Person, business or agent label in the holders table |

| Address | Attestation in the team's store | Result |
|---|---|---|
| Buyer [`0xEf58...1D90`](https://testnet.snowtrace.io/address/0xEf587ADb45895c0535DCc8bD424d67c7CA9C1D90) | Tier 2 | **Pass:** [live fill](https://testnet.snowtrace.io/tx/0xb5a2b229170c48f68b399327b594a4a7e979ea81fce3981eeef898e12c18ed2a) |
| Unverified EOA [`0x2b54...82f9`](https://testnet.snowtrace.io/address/0x2b54F241C9281cEf9cBC6BC4164dd6e91A8682f9) | None | **Block:** [`ReceiverNotAttested`](https://testnet.snowtrace.io/tx/0x57dcd1147d18153b4c601bcb1dd693278bb44b2611f96a52854bb0225793364f) |

Seller [`0x5140...3AE3`](https://testnet.snowtrace.io/address/0x5140444Eb26DB0e8b059e834c88Aa2b0586d3AE3) is tier 2 and issuer [`0x1928...5D66`](https://testnet.snowtrace.io/address/0x19287BA707706A279B17e0f9DC69ea3028Be5D66) is tier 4. No KYA agent exists in this build.

## Business model

**Problem.** Argentine retail investors can buy tokenized securities inside wallets and have few ways to sell them. Three issues are authorized so far, about US$13.9M face value combined by our sum, which is not tokens outstanding ([research, part 4](docs/research/tokenization-markets.md#part-4-argentina-comparison)). One PSAV, Volsmart, built a venue by hand for two of them, per the spec. There is no shared, cross-PSAV layer on a public chain. Tokenized stocks are tied to exchange hours, about a fifth of the week, 37.5 of 168 hours. Issuers lose first sales because they cannot promise resale.

**Customer.** The licensed PSAV wallet pays. It embeds the screen under its own brand and owns KYC, the venue and the reporting duty. The issuer or trustee is the supplier.

| Role | Who | What they get, what they pay |
|---|---|---|
| End user | Wallet holder | A market tab under the wallet's brand. Pays the wallet's trading fee |
| Customer | Licensed PSAV wallet | Embedded screen, shared liquidity, compliance feed, revert tooling. Pays a monthly licence and keeps its trading fee |
| Supplier | Issuer or trustee | Mint and list, resale promise at the point of sale. Pays per issuance |
| Handoff | Technology provider | Contracts, screen, feed. Holds nothing, takes nothing from trades, executes nothing |
| Registry | BYMA Token Registry or any PSAV ledger | Optional reporting target. Not a customer, not a competitor today |

**Revenue.** Two lines, both invoiced off-chain: a fee per issuance and a monthly licence per PSAV. No protocol fee. A cut of every fill would read as performing an art. 4 bis activity as a business, against the art. 14 carve-out for pure technology providers. That is a judgment, not a ruling, and counsel may see it differently. Prices are not set.

**Competitive advantage.** Issuers want several wallets, and art. 5 e then requires real-time synchronization. One wallet will not run another's order flow, so a shared engine from a third party is the arrangement both can accept. The contracts are open and verifiable. The law caps venues at five and does not require five, so this is a distribution argument, not an obligation.

**Market.** Measured today: US$39.36B of distributed tokenized real-world assets, stablecoins counted separately ([rwa.xyz, 2026-11-07](https://app.rwa.xyz/)). Projected, never measured: about US$2T by 2030 ([McKinsey via Cointelegraph, 2024-06-24](https://cointelegraph.com/news/asset-tokenization-rwa-2-trillion-2030-mckinsey)). Abroad, markets grew once the rules let people buy and resell, and a venue alone did not make liquidity:

- Brazil's crowdfunding offers, tokens and non-tokens together, went from under R$200M in 2023 to R$3.9B in 2025 ([Uai citing CVM, 2026-08-24](https://www.uai.com.br/?p=169476)).
- Japan issued 82 public security tokens worth ¥333.3B, and 8 traded on START in March 2026 ([Pacific Meta on BOOSTRY, 2026-04-04](https://pacific-meta.co.jp/magazine/news/145874/)).
- Switzerland's SDX Trading closed on 30 May 2025 and returned its licence; SIX's CEO said customers faced a very large effort to adapt ([cash.ch, 2025-11-27](https://www.cash.ch/news/top-news/six-hat-borsenlizenz-fur-digitalborse-sdx-zuruckgegeben-885862)).
- Dubai added 24-hour resale in February 2026, inside one app ([Gulf News, 2026-02-10](https://gulfnews.com/business/property/prypco-rolls-out-dubai-marketplace-after-nod-for-property-stakes-trading-1.500438076)).

Our reading: put resale inside the wallets investors already use. Sources and caveats are in [the research dossier](docs/research/tokenization-markets.md).

**Risks.** BYMA Digital Assets could add a retail trading screen. Tokenized volumes start near zero. A native-token law would make the wrapper layer optional. The sandbox runs to 31 December 2027 and may not be renewed. Someone reputable must carry the art. 22 liability.

**Early validation.** None to report: no customers, signed wallets, interviews, users or traded volume.

## Built today versus libraries

This repository's whole history is from the event, 7 November 2026. There is no prior project.

| Built during the event | Not ours |
|---|---|
| `HandoffRegistry`, `HandoffToken`, `HandoffSettlement`, their interfaces and Foundry tests | KUMPLY `AttestationStore`, vendored unmodified, Apache-2.0, upstream commit `a9de24f` |
| Deploy and seed scripts in `contracts/script/` | OpenZeppelin Contracts, forge-std |
| Wallet screen, console, venue routes and sponsor adapters in `web/` | Next.js, React, viem |
| Fuji scripts and evidence in `spike/` | `@0xgasless/smart-account`, with `merkletreejs` and `tslib` |
| Design system in `design/`, research in `docs/research/` | `@kumply/sdk` |

The 0xGasless bundler, paymaster, EntryPoint and smart-account contracts are third-party deployments, used as they are.

## Known gaps

**In the demo:**

- **Attestations are demo attestations** in the team's own store, with no identity check, as stated at the top.
- **The order book is sell-only.** There are no buy orders, so the spec's "best bid" is shown as the lowest ask, under the label "Mejor oferta". There is no matching engine: it is a bulletin board.
- **The registry acknowledgment is a labelled mock.** It reads "Acuse de demostración, sin llamada real". No call to BYMA or anyone else happens.
- **The console has no auth and is run locally.** Its route signs as issuer or PSAV for whoever can reach it, so it must not be exposed.
- **On Fuji the app server holds the demo owner keys** and signs for the demo accounts. The wallet screen switches between them with a demo selector. There is no real wallet connection or login.
- **The linked transactions came from scripts,** see [What ran on Fuji](#what-ran-on-fuji).
- **The direct-transfer refusals used the issuer EOA,** and the refused fill used a deliberately issued co-signature.
- **The order book is one in-memory instance,** labelled as the PSAV's. Restarting it loses open orders. One venue is listed on Fuji, so synchronization between PSAVs is not exercised; the five-venue cap lives in the contract and its tests.
- **Sponsorship policy.** The spec asks for a contract allowlist and a per-user rate limit on the paymaster key. Neither is confirmed in place; only the app route limits what it sends.
- **One asset.** The second asset, a tokenized CEDEAR, was not built. The demo trust, its CNV and deposit references and "Billetera Sur" are fictional.

**From the spec, out of scope:**

- Production KYC, suitability enforcement and depository settlement. Eligibility flags are stored, not enforced, including the crowdfunding caps.
- The permissioned L1, which is roadmap only.
- Fiat on- and off-ramps, tax withholding and reporting, which are the PSAV's job.
- Mainnet deployment, audits and upgradeability. The registry owner is a single EOA.
- Who the DLT entity of record would be for a real issuance, arts. 5 d and 22. Handoff does not claim to be that entity and never issues certificates.
- A lawyer should read the full title before anything touches mainnet.

**Stretch tickets, not done:**

- [ ] [#22](https://github.com/nicolasLuduena/unchained-by-txpipe/issues/22) KYA market-maker agent on the KUMPLY lane. Not built.
- [ ] [#23](https://github.com/nicolasLuduena/unchained-by-txpipe/issues/23) ICM message from Fuji C-Chain to the Dispatch L1. Not built.
