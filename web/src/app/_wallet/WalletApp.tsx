"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { Notice, OperatedBy, Stamp, Tabs, type StampStatus } from "@/design";
import { chainName } from "@/lib/chain";
import type { Actor } from "@/lib/sponsor";
import { walletConfig, type WalletConfig } from "@/lib/wallet/deployment";
import { HistorySection } from "./HistorySection";
import { MarketSection } from "./MarketSection";
import { ACTORS, SECTIONS, type Section } from "./nav";
import { OrdersSection } from "./OrdersSection";
import { RevertSection } from "./RevertSection";
import { SellSection } from "./SellSection";
import { useWallet, type Precheck } from "./useWallet";

const HOST_STAMP: Record<Precheck, StampStatus> = { checking: "pending", passed: "verified", blocked: "blocked", unavailable: "pending" };

function Frame({ stamp, children }: { stamp?: StampStatus; children: ReactNode }) {
  return (
    <div className="host">
      <header className="host__bar">
        <span className="host__name">Billetera Sur</span>
        {stamp && <Stamp status={stamp} />}
      </header>
      {children}
      <footer className="host__foot wallet-foot">
        <p className="caveat">Atestaciones de demostración en Fuji, sin verificación de identidad.</p>
        {chainName === "fuji" && <p className="caveat">Las emite una instancia de demostración del contrato de KUMPLY.</p>}
        <p className="caveat">Libro de órdenes y co-firma operados por el PSAV.</p>
        <OperatedBy />
      </footer>
    </div>
  );
}

function Wallet({ config, actor, section }: { config: WalletConfig; actor: Actor; section: Section }) {
  const router = useRouter();
  const wallet = useWallet(config, config[actor]);
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
    <Frame stamp={HOST_STAMP[wallet.precheck]}>
      <div onClick={navigate}>
        <div className="wallet-demo">
          <span className="t-field-label">Demostración: ver la billetera como</span>
          <Tabs ariaLabel="Cuenta de demostración" items={ACTORS.map((a) => ({ label: a.label, href: href(a.id, section), current: a.id === actor }))} />
        </div>
        <Tabs ariaLabel="Secciones" className="wallet-tabs" items={SECTIONS.map((s) => ({ label: s.label, href: href(actor, s.id), current: s.id === section }))} />
      </div>
      <main className="host__main">
        {wallet.offline && <Notice status="pending">No pudimos leer la cadena o el servicio de órdenes. Reintentando.</Notice>}
        {section === "mercado" && <MarketSection config={config} actor={actor} wallet={wallet} />}
        {section === "vender" && <SellSection config={config} actor={actor} wallet={wallet} />}
        {section === "ordenes" && <OrdersSection config={config} actor={actor} wallet={wallet} />}
        {section === "historial" && <HistorySection config={config} wallet={wallet} />}
        {section === "papel" && <RevertSection config={config} actor={actor} wallet={wallet} />}
      </main>
    </Frame>
  );
}

export function WalletApp({ actor, section }: { actor: Actor; section: Section }) {
  const config = walletConfig();
  if (!config) {
    return (
      <Frame>
        <main className="host__main">
          <Notice status="pending">El emisor todavía no registró el token en esta red.</Notice>
        </main>
      </Frame>
    );
  }
  return <Wallet config={config} actor={actor} section={section} />;
}
