"use client";

import { FeedRow, Hash as HashText, Notice } from "@/design";
import { explorerUrl } from "@/lib/chain";
import type { WalletConfig } from "@/lib/wallet/deployment";
import type { Wallet } from "./useWallet";

export function HistorySection({ config, wallet }: { config: WalletConfig; wallet: Wallet }) {
  const { snapshot, history, historyPartial } = wallet;
  if (!snapshot) return <Notice status="pending">Leyendo la cadena.</Notice>;

  return (
    <>
      <section className="wallet-stack">
        <h2 className="t-title">Historial</h2>
        {historyPartial && <p className="caveat">Seguimos leyendo la cadena: puede haber movimientos que todavía no aparecen.</p>}
        {history.length === 0 && !historyPartial && <p className="caveat">Todavía no hay movimientos en esta cuenta.</p>}
        {history.map((entry) => (
          <div className="wallet-history" key={entry.id}>
            <FeedRow
              time={entry.time}
              event={entry.event}
              status={entry.status}
              asset={entry.detail}
              from={entry.from}
              to={entry.to}
              price={entry.price}
              currency={entry.currency}
            />
            <HashText value={entry.hash} href={explorerUrl("tx", entry.hash)} />
          </div>
        ))}
      </section>

      <section className="wallet-stack">
        <h2 className="t-title">Documento de emisión</h2>
        <div className="wallet-doc">
          <span className="t-field-label">Autorización CNV</span>
          <p>{snapshot.cnvAuthRef}</p>
        </div>
        <div className="wallet-doc">
          <span className="t-field-label">Depósito</span>
          <p>{snapshot.depositRef}</p>
        </div>
        <div className="wallet-doc">
          <span className="t-field-label">Hash del documento, registrado en la cadena</span>
          <HashText value={snapshot.issuanceDocHash} href={explorerUrl("address", config.registry)} />
        </div>
      </section>
    </>
  );
}
