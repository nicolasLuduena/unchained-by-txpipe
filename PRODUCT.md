# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Handoff has one audience that decides now and three that the product serves.

- **Hackathon jury (first priority when audiences conflict).** HackaTwin Blockchain track judges see a pitch of up to 3 minutes and a working demo, live or recorded. They score impact (25), use of Avalanche (25), technical feasibility (20), business model and scalability (20), and presentation and clarity (10), plus up to +10 each for 0xGasless and KUMPLY. They need to understand the mechanism from a projected screen, in seconds.
- **Holder (end user).** An Argentine retail investor who bought a tokenized security inside a wallet app and wants to sell it, often on a phone, possibly at night or on a weekend. The pitch persona is a nurse who bought a slice and cannot sell it.
- **Licensed wallet (PSAV, the paying customer).** Embeds the trading screen under its own brand and owns KYC, the venue, order operation and the compliance duty. Its compliance officer reads the feed of orders, cancels and fills.
- **Issuer or trustee (supplier).** Registers a token, names up to five venues and the attesters it trusts, and sets the price band.

## Product Purpose

Handoff is a white-label trading layer for Argentina's tokenized securities, embedded by licensed wallets. It closes the resale gap: holders can buy tokenized securities inside wallets but cannot sell them, and tokenized stocks trade only about 18 percent of the week.

A verified holder signs a sell order off-chain for free. A verified buyer fills it in one tap with no gas. One atomic transaction moves tokens and USDC, the contract enforces a price band, and the token rejects any transfer to an unverified receiver or outside an allowlisted venue.

Success now means the jury sees it working on Avalanche Fuji and understands why it matters. Success later means wallets license it and issuers can promise resale at the point of sale.

## Positioning

The shared, cross-PSAV trading layer that CNV's Título XXII describes, published as open contracts on a public chain. One PSAV has built a venue by hand for one issue; nobody has built the shared layer.

Handoff holds no assets, holds no fiat and takes nothing from trades. It is software. The PSAV is the venue under art. 39.

## Operating Context

- **Wallet screen.** One screen at phone width inside a host wallet: market, sell ticket, orders, history, revert request. The host wallet's brand surrounds it.
- **Issuer and PSAV console.** One small desktop console: venues, price band, compliance feed, block and burn, pause.
- **Pitch.** A 2:30 sequence: the problem, what the CNV defined, the live demo with a Snowtrace link and an on-chain revert from an unverified wallet, why Avalanche, the business, then the team and what was built today.
- **Explorer.** Snowtrace is part of the experience. Users and judges verify hashes there.
- **Trading hours.** At any hour, including nights and weekends, because the deposited securities stay immobilized at the depository.

## Capabilities and Constraints

**Core flows:** see holdings and best bid, post a signed sell order for free, cancel without gas, fill in one tap, see the hash and explorer link, request reversion to a paper certificate, see the allowed price range before posting, read trade history and the issuance document.

**Console flows:** register a token, cap venues at five, name attesters, set a band and floor, opt out of trading, pause, read the compliance feed, block and burn against a certificate reference.

**States a user must be able to read:** verified, blocked or unverified, pending, gas-sponsored, reverted, registry report pending, and agent quote (stretch), which must stay distinguishable from human orders.

**Wording constraints (from the spec, legal in origin):**

- Never say "compliant". Say "built to the structure of Título XXII and operated by a PSAV".
- Never claim wash trading is impossible. The band is one control; the feed and reporting are the obligation.
- Never claim "nobody built resale". The claim is "no shared, cross-PSAV layer on a public chain".
- Handoff does not claim to be the DLT entity and never issues certificates.
- Trading fees belong to the wallet. Handoff has no protocol fee; revenue is a per-issuance fee and a monthly PSAV licence, invoiced off-chain.
- Every Fuji attestation is a demo attestation with no real identity verification, and that must be stated. The registry acknowledgment is a labelled mock, not a live call.

**Terminology:** PSAV, venue, issuer, attester, attestation, wrapper token, order, fill, price band, registry report, sandbox (the CNV regulatory one, not a test environment).

**Language:** English on every screen, a change from the spec so that judges can follow it. Seed references on Fuji, such as the demo CNV and deposit references, stay in Spanish because they are stored on-chain.

**Chain:** Avalanche Fuji C-Chain for the demo. A permissioned L1 with one validator per PSAV is roadmap, not built.

**Undecided:**

- The application stack. No app exists yet; the repository holds only `design/`, whose components are React with plain CSS.
- How far a host wallet can restyle the embedded screen, and which tokens it may override.
- The host wallet shown in the demo. Its name must be fictional unless a real wallet agrees.
- Spec issue #1 still says "Cuota"; the confirmed name is Handoff.

## Brand Commitments

The name is **Handoff**, confirmed over "Cuota". Screens are light: a warm plaster ground with indigo, madder and saffron ribbons, chosen by the owner after the first dark version. Nothing else in the current brand is binding: logo, palette, type, voice rules and the component API may all be replaced. Inside a host wallet the wallet's brand comes first and Handoff stays secondary, because the product is white-label.

## Evidence on Hand

- The spec with its article-by-article mapping to Título XXII: GitHub issue #1.
- The track rules and jury criteria: `../HackaTwin — Blockchain Track Rules and Requirements (EN).docx.pdf`.
- Sourced market facts in the spec: one authorized tokenized issue so far, exchange open about 18 percent of the week, the sandbox runs to 31 December 2027, the Volsmart and Lemon precedents, the Belo gap.
- Demo data is fictional by design: a real-estate trust certificate with a fictional name and authorization reference, and optionally a tokenized CEDEAR.

**Absent, must not be fabricated:** customers, signed wallets, testimonials, user counts, traded volume, interview results, deployed contract addresses and real transaction hashes (until they exist; illustrative ones must read as examples).

## Product Principles

1. **Show the mechanism, not the promise.** The strongest proof is a hash, a band and a revert anyone can check.
2. **Say exactly what is true.** Legal precision is the product: what is mocked says so, and what is a demo says so.
3. **The wallet's brand comes first.** Handoff earns recognition by how the trade feels, not by how loudly it signs.
4. **Plain words for regulated acts.** A nurse selling a position reads what happens to their money, in their language, with no jargon from the chain.
5. **Clear in seconds.** When a choice trades depth for instant comprehension on a projected screen, comprehension wins for now.

## Accessibility & Inclusion

No formal standard was specified. Carried over as product requirements because the states are regulated: a status is never conveyed by color alone, and every state stays legible at phone width. Retail holders include people with no crypto background.
