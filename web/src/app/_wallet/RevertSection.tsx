"use client";

import { useState } from "react";
import { AssetRow, Button, Hash as HashText, Notice, TextField } from "@/design";
import { chain, explorerUrl, networkLabel } from "@/lib/chain";
import { venue } from "@/lib/orders/client";
import { getSponsor, type Actor } from "@/lib/sponsor";
import type { WalletConfig } from "@/lib/wallet/deployment";
import { formatUsdc, parseTokens, tokensLabel } from "@/lib/wallet/format";
import { useAction, type Wallet } from "./useWallet";

type Props = { config: WalletConfig; actor: Actor; wallet: Wallet };

export function RevertSection({ config, actor, wallet }: Props) {
  const { address, snapshot, reversions, precheck } = wallet;
  const [amountText, setAmountText] = useState("1");
  const requesting = useAction();

  if (!snapshot) return <Notice status="pending">Reading your account on {networkLabel}.</Notice>;
  if (precheck === "blocked") return actor === "metamask" ? null : <Notice status="blocked">Verify your identity in the wallet to trade.</Notice>;

  const amount = parseTokens(amountText);
  const amountError = amount === null || amount === 0n ? "Enter a whole number." : amount > snapshot.tokens ? `You have ${tokensLabel(snapshot.tokens)}.` : undefined;
  const pending = reversions.some((r) => r.status === "pending");

  function request() {
    if (amount === null || amountError) return;
    return requesting.run(async () => {
      const requestedAt = BigInt(Math.floor(Date.now() / 1000));
      const sponsor = await getSponsor(actor);
      const signature = await sponsor.signReversion(actor, { chainId: BigInt(chain.id), token: config.token, holder: address, amount, requestedAt });
      await venue.requestReversion({
        token: config.token,
        holder: address,
        amount: amount.toString(),
        requestedAt: requestedAt.toString(),
        signature,
      });
      wallet.refresh();
    });
  }

  return (
    <div className="wallet-cols">
      <section className="wallet-stack wallet-primary">
        <h2 className="t-title">Convert to paper</h2>
        <p className="caveat">You ask to go back to a paper certificate. The PSAV retires your tokens against that certificate, so you can no longer sell them here.</p>
        <TextField label="Amount" inputMode="numeric" value={amountText} help={`You have ${tokensLabel(snapshot.tokens)}.`} error={amountError} onChange={(e) => setAmountText(e.target.value)} />
        <Button variant="primary" size="lg" busy={requesting.busy} disabled={!!amountError || pending} onClick={request}>
          Request paper certificate
        </Button>
        {requesting.error && (
          <Notice status="blocked" word="Refused">
            {requesting.error}
          </Notice>
        )}
        {reversions.map((r) =>
          r.status === "pending" ? (
            <Notice status="pending" key={r.id}>
              You asked to move {tokensLabel(BigInt(r.amount))} to paper. The request is with the PSAV.
            </Notice>
          ) : (
            <div className="wallet-stack" key={r.id}>
              <Notice status="verified" word="On paper">
                The PSAV moved {tokensLabel(BigInt(r.amount))} to paper. Certificate {r.certificateRef}.
              </Notice>
              {r.txHash && <HashText value={r.txHash} href={explorerUrl("tx", r.txHash)} />}
            </div>
          ),
        )}
      </section>

      {/* The phone already says this under the field; the wider layouts have a column for it. */}
      <section className="wallet-stack wallet-side wallet-side--wide">
        <h2 className="t-title">Your assets</h2>
        <AssetRow name={snapshot.tokenName} meta={`${tokensLabel(snapshot.tokens)} · Reference price`} price={formatUsdc(snapshot.reference)} />
      </section>
    </div>
  );
}
