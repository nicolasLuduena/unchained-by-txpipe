"use client";

import { useState } from "react";
import { Button, Hash as HashText, Notice, TextField } from "@/design";
import { chain, explorerUrl } from "@/lib/chain";
import { venue } from "@/lib/orders/client";
import { getSponsor, type Actor } from "@/lib/sponsor";
import type { WalletConfig } from "@/lib/wallet/deployment";
import { parseTokens, tokensLabel } from "@/lib/wallet/format";
import { useAction, type Wallet } from "./useWallet";

type Props = { config: WalletConfig; actor: Actor; wallet: Wallet };

export function RevertSection({ config, actor, wallet }: Props) {
  const { address, snapshot, reversions, precheck } = wallet;
  const [amountText, setAmountText] = useState("1");
  const requesting = useAction();

  if (!snapshot) return <Notice status="pending">Leyendo tu cuenta en la cadena.</Notice>;
  if (precheck === "blocked") return <Notice status="blocked">Verificá tu identidad en la billetera para operar.</Notice>;

  const amount = parseTokens(amountText);
  const amountError = amount === null || amount === 0n ? "Ingresá una cantidad entera." : amount > snapshot.tokens ? `Tenés ${tokensLabel(snapshot.tokens)}.` : undefined;
  const pending = reversions.some((r) => r.status === "pending");

  function request() {
    if (amount === null || amountError) return;
    return requesting.run(async () => {
      const requestedAt = BigInt(Math.floor(Date.now() / 1000));
      const sponsor = await getSponsor();
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
    <section className="wallet-stack">
      <h2 className="t-title">Pasar a papel</h2>
      <p className="caveat">Pedís volver a un certificado en papel. El PSAV da de baja tus tokens contra ese certificado.</p>
      <TextField label="Cantidad" inputMode="numeric" value={amountText} help={`Tenés ${tokensLabel(snapshot.tokens)}.`} error={amountError} onChange={(e) => setAmountText(e.target.value)} />
      <Button variant="primary" size="lg" busy={requesting.busy} disabled={!!amountError || pending} onClick={request}>
        Pedir certificado en papel
      </Button>
      {requesting.error && (
        <Notice status="blocked" word="Rechazado">
          {requesting.error}
        </Notice>
      )}
      {reversions.map((r) =>
        r.status === "pending" ? (
          <Notice status="pending" key={r.id}>
            Pediste pasar {tokensLabel(BigInt(r.amount))} a papel. El pedido está con el PSAV.
          </Notice>
        ) : (
          <div className="wallet-stack" key={r.id}>
            <Notice status="reverted">
              El PSAV pasó {tokensLabel(BigInt(r.amount))} a papel. Certificado {r.certificateRef}.
            </Notice>
            {r.txHash && <HashText value={r.txHash} href={explorerUrl("tx", r.txHash)} />}
          </div>
        ),
      )}
    </section>
  );
}
