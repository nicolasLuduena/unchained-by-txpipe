"use client";

import { FeedRow, Fields, Hash as HashText, Notice } from "@/design";
import { explorerUrl } from "@/lib/chain";
import type { WalletConfig } from "@/lib/wallet/deployment";
import type { Wallet } from "./useWallet";

export function HistorySection({ config, wallet }: { config: WalletConfig; wallet: Wallet }) {
  const { snapshot, history } = wallet;
  if (!snapshot) return <Notice status="pending">Leyendo la cadena.</Notice>;

  return (
    <>
      <section className="wallet-stack">
        <h2 className="t-title">Historial</h2>
        {history.length === 0 && <p className="caveat">Todavía no hay movimientos en esta cuenta.</p>}
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
        <Fields
          items={[
            { label: "Autorización CNV", value: snapshot.cnvAuthRef },
            { label: "Depósito", value: snapshot.depositRef },
          ]}
        />
        <span className="t-field-label">Hash del documento, registrado en la cadena</span>
        <HashText value={snapshot.issuanceDocHash} href={explorerUrl("address", config.registry)} />
      </section>
    </>
  );
}
