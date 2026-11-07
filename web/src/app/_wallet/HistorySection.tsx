"use client";

import { FeedRow, Hash as HashText, Notice } from "@/design";
import { explorerUrl, networkLabel } from "@/lib/chain";
import type { WalletConfig } from "@/lib/wallet/deployment";
import type { Wallet } from "./useWallet";

export function HistorySection({ config, wallet }: { config: WalletConfig; wallet: Wallet }) {
  const { snapshot, history, historyPartial } = wallet;
  if (!snapshot) return <Notice status="pending">Reading {networkLabel}.</Notice>;

  return (
    <>
      <section className="wallet-stack">
        <h2 className="t-title">History</h2>
        {historyPartial && <p className="caveat">Still reading {networkLabel}: some activity may not show yet.</p>}
        {history.length === 0 && !historyPartial && <p className="caveat">No activity on this account yet.</p>}
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
        <h2 className="t-title">Issuance document</h2>
        <p className="caveat">What backs this token and where you can check it.</p>
        <div className="wallet-doc">
          <span className="t-field-label">CNV authorization</span>
          <p>{snapshot.cnvAuthRef}</p>
        </div>
        <div className="wallet-doc">
          <span className="t-field-label">Deposit</span>
          <p>{snapshot.depositRef}</p>
        </div>
        <div className="wallet-doc">
          <span className="t-field-label">Document hash, recorded on {networkLabel}</span>
          <HashText value={snapshot.issuanceDocHash} href={explorerUrl("address", config.registry)} />
        </div>
      </section>
    </>
  );
}
