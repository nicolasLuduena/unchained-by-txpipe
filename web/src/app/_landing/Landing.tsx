"use client";

import Link from "next/link";
import { Coupon, Ribbons, Stamp } from "@/design";
import "./landing.css";

const SALE_TX = "0x34f7000b9fc1177442a70d108921952cbe4e7bf3d212390fcf5bb2f7740b6635";
const REFUSED_TX = "0x69138ad83a862c8dd7e1d60c38fe79dc756bf5fdd7b2f6274f6d0a4d34b0fa66";
const tx = (hash: string) => `https://testnet.snowtrace.io/tx/${hash}`;
const short = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;

const STEPS = [
  { title: "The seller signs", text: "A free signature in the wallet. The token stays with the seller." },
  { title: "The PSAV publishes", text: "The licensed wallet company lists the order for its buyers to see." },
  { title: "The buyer taps once", text: "The PSAV co-signs and the gas is sponsored, so the buyer needs no AVAX." },
  { title: "The contract settles", text: "Token and USDC move in one transaction, or neither moves." },
  { title: "The feed records", text: "The compliance officer reads every order, sale and refusal." },
];

const PLACES = [
  { href: "/demo", title: "Guided demo", text: "Six steps on Fuji, each explained before you run it. Start here." },
  { href: "/?actor=seller&tab=mercado", title: "Wallet", text: "What a holder sees. Connect MetaMask to try it with your own account." },
  { href: "/console", title: "Console", text: "What the issuer and the PSAV use to run the token." },
];

export function Landing() {
  return (
    <div className="land">
      <header className="land-hero">
        <Ribbons className="land-hero__ribbons" />
        <nav className="land-nav" aria-label="Main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/design/logos/handoff-lockup-horizontal.svg" alt="Handoff" height={30} />
          <div className="land-nav__links">
            {PLACES.map((place) => (
              <Link key={place.href} href={place.href}>
                {place.title}
              </Link>
            ))}
          </div>
        </nav>

        <div className="land-hero__body">
          <div className="land-hero__copy">
            <h1>Sell a tokenized security without leaving your wallet</h1>
            <p>
              Handoff is a white-label trading layer for Argentina&apos;s tokenized securities. A verified holder signs for free, a verified
              buyer pays in one tap with no gas, and one transaction on Avalanche moves both sides.
            </p>
            <Link className="land-cta" href="/demo">
              Run the guided demo
            </Link>
            <small>Real transactions on Fuji, about two minutes.</small>
          </div>
          <Coupon
            className="land-hero__coupon"
            label="Sale"
            number="No. 0826"
            title="Fideicomiso Torre Demo"
            fields={[
              { label: "Amount", value: "1 token" },
              { label: "Price", value: "USDC 2.50" },
            ]}
            stubLabel="Total settled"
            total="2.50"
            currency="USDC"
            state="sold"
            torn
            hash={short(SALE_TX)}
            hashHref={tx(SALE_TX)}
          />
        </div>
      </header>

      <main>
        <section className="land-section">
          <h2>One sale, start to finish</h2>
          <ol className="land-rail">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="land-section land-proof">
          <div className="land-proof__copy">
            <h2>The rule lives in the contract</h2>
            <p>
              An account with no attestation can skip the app and call the contract directly. The token refuses it anyway. Both of these
              transactions are public on Fuji.
            </p>
          </div>
          <div className="land-proof__rows">
            <a href={tx(REFUSED_TX)}>
              <Stamp status="blocked">Refused</Stamp>
              <code>ReceiverNotAttested</code>
              <span>An unverified account tried to buy. Nothing moved.</span>
              <code className="land-hash">{short(REFUSED_TX)}</code>
            </a>
            <a href={tx(SALE_TX)}>
              <Stamp status="sold" />
              <code>OrderFilled</code>
              <span>A verified buyer bought 1 token for USDC 2.50, with the gas sponsored.</span>
              <code className="land-hash">{short(SALE_TX)}</code>
            </a>
          </div>
        </section>

        <section className="land-section land-facts">
          <div>
            <h2>Software, not a venue</h2>
            <p>
              Handoff holds no assets, holds no fiat and takes nothing from trades. The PSAV embeds it under its own brand and runs the venue.
              Revenue is a per-issuance fee and a monthly PSAV licence, invoiced off-chain.
            </p>
          </div>
          <div>
            <h2>Why Avalanche</h2>
            <p>
              The regime describes a closed group of at most five operators keeping one real-time record. That is the shape of a permissioned
              Avalanche L1. Fuji is what runs today, with finality in about one second.
            </p>
          </div>
        </section>

        <section className="land-section">
          <h2>See it working</h2>
          <div className="land-places">
            {PLACES.map((place) => (
              <Link key={place.href} href={place.href}>
                <h3>{place.title}</h3>
                <p>{place.text}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="land-foot">
        <p>Demo attestations on Fuji, no identity verification. They come from a demo instance of the KUMPLY contract, not KUMPLY&apos;s official store.</p>
        <p>Built to the structure of Título XXII of the CNV Normas and operated by a PSAV.</p>
      </footer>
    </div>
  );
}
