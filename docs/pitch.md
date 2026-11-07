# Pitch, 2:30

The spec's beat order, timed for the track's limit of 3 minutes with 30 seconds spare. Word counts assume about 150 words a minute. Screens carry the demo, so the spoken text stays short.

**Backup clip.** TODO: link the recorded clip here once it exists. It records the same flow with real Snowtrace links. Keep it open in a tab, and if Fuji or the RPC misbehaves, play it during the 0:30 beat and keep talking over it. Whatever plays, the on-chain revert and the revert to paper stay in.

Open before starting: the wallet screen as Vendedora, `/console`, and Snowtrace tabs for the [live fill](https://testnet.snowtrace.io/tx/0xb5a2b229170c48f68b399327b594a4a7e979ea81fce3981eeef898e12c18ed2a), the [refused fill](https://testnet.snowtrace.io/tx/0x57dcd1147d18153b4c601bcb1dd693278bb44b2611f96a52854bb0225793364f) and the [reversion](https://testnet.snowtrace.io/tx/0x2c8e4a20b1d894e22526273c646cc53ad3d69f0e0bec8518fa0452b007163460). If a live action is slow, show those tabs: they are the recorded proof.

## Script

### 0:00 The problem (15 s)

> A nurse buys a slice of a building inside her wallet app. Then she needs the money, and she cannot sell it. Tokenized stocks are not much better: the exchange is open about a fifth of the week.

### 0:15 What the CNV defined (15 s)

> The CNV already defined this market: five wallets, real-time sync, contract-enforced holders, an unrestricted right to revert, a duty to report abuse. Three issues are authorized. One PSAV hand-built a venue for two. There is no shared layer.

### 0:30 Demo (70 s)

Screen: wallet, then Snowtrace, then console.

> One thing first. These are demo attestations, no real identity check, and the mainnet store has zero attestations. They sit in our own Fuji copy of KUMPLY's open-source store, not KUMPLY's official one.
>
> This is Handoff inside a fictional wallet. The seller signs an ask. No gas, and her tokens stay in her account.
>
> The buyer has no AVAX. One tap. Tokens and USDC move in one atomic transaction, co-signed by the PSAV, gas sponsored through 0xGasless. Here it is on Snowtrace.
>
> Now an unverified wallet. The app warns it through the KUMPLY SDK. It tries anyway, and the token itself refuses: ReceiverNotAttested, reverted on-chain.
>
> A holder asks for paper. The PSAV burns the units against a certificate reference. That right is unrestricted.
>
> The console: a cap of five venues, the price band, and every order, cancel and fill for the compliance officer.

### 1:40 Why Avalanche (20 s)

> Why Avalanche? The regulation maps to a five-validator L1: one validator per PSAV, and shared state is the real-time sync. Finality of about one second suits an atomic fill. ICM connects it to the C-Chain. Today this runs on Fuji; the L1 is roadmap.

### 2:00 The business (20 s)

> Wallets embed it under their own brand. Two revenue lines: a fee per issuance and a monthly licence. No cut of trades. Belo is a licensed PSAV with no tokenized product. Volsmart shows the regulator accepts the shape. We hold nothing.

### 2:20 Team, built, mocked (10 s)

> We are [TODO: team names]. Contracts, wallet and console were built here. The registry acknowledgment is a mock. The L1, ICM and the agent are not built.

### Presenter notes

- Say "about one second". Say "built to the structure of Título XXII and operated by a PSAV" if the legal status comes up. The claim is no shared, cross-PSAV layer on a public chain; Volsmart has a venue.
- Say "lowest ask" if pressed: the wallet labels it "Mejor oferta", and there are no buy orders.
- Show the wallet as a fictional host, "Billetera Sur". Do not imply Belo or any real wallet agreed to anything.
- TODO: the spec asks for one sentence each from the Belo, Twin and R3AL people in the room, attributed by role. None is on record, so add them only if they are actually said. Cut nothing from the script for them; swap them into the 2:00 beat.
- Market lines if a beat runs short, from the [pitch sheet](research/tokenization-markets.md#part-1-pitch-sheet): US$39.36B measured today, about US$2T by 2030 projected. Check its "Do not say" list first.

## Q&A

Answers updated for what was built. Where the spec's answer named a plan, this says what exists.

### From the spec

**R3AL Blocks CTO: "Issuers don't want a public price on an illiquid building."** Trading is per token: the issuer can switch it off, or set a floor that keeps the band. The first benefit is at issuance, where a resale promise closes the sale. For an issuer moving into the regime, this is the transfer layer it requires.

**R3AL Blocks infrastructure lead: "Who does the KYC, and what happens on weekends?"** In production the PSAV, as the regulated subject: Handoff reads its attestation on-chain and the PSAV co-signs every fill. In this demo nobody does KYC, and the attestations are ours. Weekends work because the deposited securities are immobilized at the depository and trades change beneficiaries in the PSAVs' register, arts. 15 and 21.

**Team1 Avalanche: "Why would Belo pick you instead of building it?"** Belo alone is one venue with Belo's holders. Issuers want several wallets, and art. 5 e then requires real-time synchronization. Belo will not run Lemon's order flow. A shared engine from a third party is the arrangement both accept. The law caps venues at five and does not require five, so this is a distribution argument.

**Team1 Avalanche: "Is the order book on-chain? What does a fill cost?"** Signed orders sit in the PSAV's order service, and today that is one in-memory instance. Each is announced on-chain from the venue's key so it reaches the feed. The holder pays nothing to post. A fill is one sponsored user operation co-signed by the venue. It is a sell-only bulletin board operated by the PSAVs, not a matching engine.

**Anyone: "Is this legal today?"** The sandbox runs to 31 December 2027. A PSAV registered in all five categories could operate this structure under Título XXII. Handoff is software under art. 14 and would partner with one. We have none signed. A lawyer should read the full title before mainnet.

**Anyone: "Doesn't BYMA already do this?"** BYMA Digital Assets runs a registry of token ownership for institutions, with an API, SDKs and webhooks. It has no trading screen, order set or retail wallet integration; custody and tokenization are listed as coming soon. We can report to it, and today that report is a labelled mock. If it adds a trading layer, we are its feature or its acquisition.

**Anyone: "Isn't this R3AL's or TraderPal's business?"** R3AL's tokens are private-trust positions outside the regime. R3AL is not in the current CNV PSAV registry, has no authorized issue, and its October 2026 TraderPal alliance is a distribution deal with no trustee or structurer named. TraderPal is a US stock app over Alpaca, not a PSAV. Handoff is the on-chain layer any of them would need to enter the regime: a component they license, not a platform they compete with.

**Anyone: "What about the Ley de Competitividad Financiera?"** The bill would have allowed securities issued, held and traded on DLT without mandatory deposit, and created "Otros Ámbitos de Negociación Autorizados" operated by PSAVs. The government withdrew it on November 4, 2026 to rework it after a CEDEAR tax controversy. If it returns, PSAV-operated venues are what it describes and the wrapper layer becomes optional. Both are good for Handoff's customers.

### About what was built

**"Is that KUMPLY's store?"** No. It is our own Fuji instance of their unmodified open-source contract, Apache-2.0, with the team as admin and verifier. KUMPLY issued none of these attestations. The contract, the `verify` read and the SDK calls are theirs; the app passes the SDK our address. Swapping to the official store means redeploying the registry, settlement and token, because the registry fixes its issuer attester at deployment.

**"Does the paymaster check KUMPLY?"** No. The team's paymaster on 0xGasless sponsors humans, and attestation is enforced in the token hook. Attestation-gated sponsorship exists only on the KUMPLY lane, for KYA tier 5 agents, and we did not build the agent.

**"Who paid for the gas?"** A gas tank on the team's 0xGasless project, funded with test AVAX. The holder never pays. The PSAV's own transactions, the announce and the reversion, pay AVAX from its keys.

**"Did the seller try the direct transfer?"** No. The direct-transfer refusals on Snowtrace used the issuer EOA as the attested holder, not the seller smart account. The hook applies the same check to both. The refused fill carried a co-signature we issued deliberately, so the refusal shows the hook rather than the venue check; a live venue would have refused first.

**"Did these transactions come from the screen?"** The linked ones came from our scripts. The wallet screen uses the same contracts and the same sponsorship path, and on Fuji its server holds the demo keys. There is no real wallet connection yet.

**"Have you measured one second?"** No. It is Avalanche's finality, and we did not benchmark it. Nor did we build the L1 or ICM: Fuji C-Chain is what runs.

**"Could a price band stop wash trading?"** Not alone, and we do not claim it. The band is one control. The feed and the PSAV's reporting duty, arts. 26 and 27, are the obligation.

**"How big is this?"** Argentina is tiny today: three issues, about US$13.9M face value by our sum, and that is not tokens outstanding. Globally, US$39.36B is measured and about US$2T by 2030 is a projection. Sources: [the research dossier](research/tokenization-markets.md).

**"Any customers?"** None. No signed wallets, interviews, users or volume.
