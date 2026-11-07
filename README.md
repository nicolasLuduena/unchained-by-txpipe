> **Demo attestations.** Every attestation on Fuji is a demo attestation with no real identity verification. The KUMPLY mainnet store holds zero attestations.

# Handoff

A white-label trading layer for Argentina's tokenized securities, built for the HackaTwin Blockchain track on Avalanche Fuji. Built to the structure of Título XXII of the CNV Normas and operated by a PSAV. The spec is issue #1.

## Deliverables checklist

- [ ] Three verified contract addresses with Snowtrace links
- [ ] Why Avalanche: five-validator L1 mapping, finality of about one second, ICM
- [ ] Built today versus libraries used
- [ ] Bonus section: 0xGasless components and sponsored user operation links
- [ ] Bonus section: KUMPLY on-chain hook, SDK calls, pass and block transactions
- [ ] Demo-attestation disclaimer on the first screen
- [ ] Demo video link
- [ ] Known gaps
- [ ] Business model: problem, customer, revenue, competitive advantage
- [ ] Installation, deployment and architecture

## Install

```bash
git clone --recurse-submodules <repo>
cd contracts && forge test
```

The web app needs Node and pnpm, not Foundry. It serves the wallet screen at `/` and the issuer console at `/console`.

```bash
cd web
pnpm install
cp .env.example .env.local   # NEXT_PUBLIC_CHAIN=local or fuji
pnpm dev                     # http://localhost:3000
pnpm build
```

`pnpm dev` and `pnpm build` copy the design system into the app first. The app reads `deployments/<chain>.json` at startup, so restart `pnpm dev` after a redeploy; without the file it still runs, with no deployment loaded. After changing a contract interface, run `pnpm gen:abi` and commit `web/src/lib/abi/`.
