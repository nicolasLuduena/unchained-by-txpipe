"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import type { Address } from "viem";
import { Notice, OperatedBy, Ribbons, Stamp, Tabs, type StampStatus } from "@/design";
import { chainName, networkLabel } from "@/lib/chain";
import type { Actor } from "@/lib/sponsor";
import { walletConfig, type WalletConfig } from "@/lib/wallet/deployment";
import { HistorySection } from "./HistorySection";
import { MarketSection } from "./MarketSection";
import { MetaMaskConnect, MetaMaskPanel } from "./MetaMaskPanel";
import { ACTORS, SECTIONS, type Section } from "./nav";
import { OrdersSection } from "./OrdersSection";
import { RevertSection } from "./RevertSection";
import { SellSection } from "./SellSection";
import { useMetaMask, type MetaMask } from "./useMetaMask";
import { useWallet, type Precheck } from "./useWallet";

const HOST_STAMP: Record<Precheck, StampStatus> = { checking: "pending", passed: "verified", blocked: "blocked", unavailable: "pending" };

/** The header stamp is one word. This line says what it means for someone who has never seen a verified account. */
const HOST_STATE: Record<Precheck, string> = {
  checking: "Checking whether this account can trade.",
  passed: "This account can buy and sell.",
  blocked: "This account cannot buy or sell yet.",
  unavailable: "We could not check whether this account can trade.",
};

const DEFAULT_BRAND = "Billetera Sur";

function Frame({ brand, stamp, children }: { brand: string; stamp?: StampStatus; children: ReactNode }) {
  return (
    <div className="host">
      <Ribbons className="host__ribbons" />
      <header className="host__bar wallet-head">
        <span className="host__name">{brand}</span>
        {stamp && <Stamp status={stamp} />}
      </header>
      {children}
      <footer className="host__foot wallet-foot">
        <p className="caveat">
          Demo attestations on Fuji, no identity verification.
          {chainName === "fuji" && " They come from a demo instance of the KUMPLY contract, not KUMPLY's official store."}
        </p>
        <OperatedBy />
      </footer>
    </div>
  );
}

type Place = { brand: string; actor: Actor; section: Section };

/** The frame and both tab rows, the same with or without an account to show. */
function Shell({ brand, actor, section, stamp, state, children }: Place & { stamp?: StampStatus; state?: string; children: ReactNode }) {
  const router = useRouter();
  const href = (nextActor: Actor, nextSection: Section) => `/?actor=${nextActor}&tab=${nextSection}`;

  // The design system's Tabs are plain links. This keeps the switch a client transition, so state survives it.
  function navigate(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as HTMLElement).closest("a");
    const target = link?.getAttribute("href");
    if (!target) return;
    event.preventDefault();
    router.push(target, { scroll: false });
  }

  return (
    <Frame brand={brand} stamp={stamp}>
      {state && <p className="wallet-state">{state}</p>}
      <div className="wallet-nav" onClick={navigate}>
        <div className="wallet-nav__col">
          <span className="t-field-label">Sections</span>
          <Tabs ariaLabel="Sections" className="hf-tabs--rail" items={SECTIONS.map((s) => ({ label: s.label, href: href(actor, s.id), current: s.id === section }))} />
        </div>
        <div className="wallet-nav__col">
          <span className="t-field-label">View as</span>
          <Tabs ariaLabel="Demo account" className="hf-tabs--rail" items={ACTORS.map((a) => ({ label: a.label, href: href(a.id, section), current: a.id === actor }))} />
        </div>
      </div>
      {children}
    </Frame>
  );
}

function Wallet({ config, address, metamask, ...place }: Place & { config: WalletConfig; address: Address; metamask?: MetaMask }) {
  const { actor, section } = place;
  const wallet = useWallet(config, address);

  return (
    <Shell {...place} stamp={HOST_STAMP[wallet.precheck]} state={HOST_STATE[wallet.precheck]}>
      <main className="host__main">
        {wallet.offline && <Notice status="pending">We could not read {networkLabel} or the order service. Retrying.</Notice>}
        {metamask && <MetaMaskPanel metamask={metamask} wallet={wallet} />}
        {section === "mercado" && <MarketSection config={config} actor={actor} wallet={wallet} />}
        {section === "vender" && <SellSection config={config} actor={actor} wallet={wallet} />}
        {section === "ordenes" && <OrdersSection config={config} actor={actor} wallet={wallet} />}
        {section === "historial" && <HistorySection config={config} wallet={wallet} />}
        {section === "papel" && <RevertSection config={config} actor={actor} wallet={wallet} />}
      </main>
    </Shell>
  );
}

/** "Mi billetera": the same screens, once MetaMask has given us an owner and the server its smart account. */
function MetaMaskWallet({ config, ...place }: Place & { config: WalletConfig }) {
  const metamask = useMetaMask();
  if (metamask.account) return <Wallet {...place} config={config} address={metamask.account.smartAccount} metamask={metamask} />;
  return (
    <Shell {...place}>
      <main className="host__main">
        <MetaMaskConnect metamask={metamask} />
      </main>
    </Shell>
  );
}

export function WalletApp({ actor, section, brand = DEFAULT_BRAND }: { actor: Actor; section: Section; brand?: string }) {
  const config = walletConfig();
  if (!config) {
    return (
      <Frame brand={brand}>
        <main className="host__main">
          <Notice status="pending">The issuer has not registered the token on this network yet.</Notice>
        </main>
      </Frame>
    );
  }
  if (actor === "metamask") return <MetaMaskWallet config={config} brand={brand} actor={actor} section={section} />;
  return <Wallet config={config} brand={brand} actor={actor} section={section} address={config[actor]} />;
}
