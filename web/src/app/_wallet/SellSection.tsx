"use client";

import { useState } from "react";
import { Button, Coupon, Hash as HashText, Notice, PriceBand, TextField } from "@/design";
import { chain, explorerUrl } from "@/lib/chain";
import { venue } from "@/lib/orders/client";
import { toWireOrder, type Order, type OrderView } from "@/lib/orders/types";
import { getSponsor, SPONSOR_LABEL, type Actor } from "@/lib/sponsor";
import type { WalletConfig } from "@/lib/wallet/deployment";
import { formatUsdc, parseTokens, parseUsdc, tokensLabel, usdcToNumber } from "@/lib/wallet/format";
import { useAction, type Wallet } from "./useWallet";

const ORDER_LIFETIME_S = 86_400n;

function randomNonce() {
  return crypto.getRandomValues(new BigUint64Array(1))[0];
}

type Props = { config: WalletConfig; actor: Actor; wallet: Wallet };

export function SellSection({ config, actor, wallet }: Props) {
  const { address, snapshot, precheck } = wallet;
  const [amountText, setAmountText] = useState("4");
  const [priceText, setPriceText] = useState<string | null>(null);
  const [posted, setPosted] = useState<OrderView | null>(null);
  const posting = useAction();

  // The SDK pre-check gates the ticket: nothing below renders until it has passed.
  if (precheck === "checking") return <Notice status="pending">Comprobando tu verificación.</Notice>;
  if (precheck === "blocked") return actor === "metamask" ? null : <Notice status="blocked">Verificá tu identidad en la billetera para operar.</Notice>;
  if (precheck === "unavailable" || !snapshot) {
    return <Notice status="pending">No pudimos comprobar tu verificación. Probá de nuevo en un momento.</Notice>;
  }
  if (snapshot.blocked) return <Notice status="blocked">El PSAV bloqueó esta cuenta. Consultá en la billetera.</Notice>;
  if (snapshot.paused) return <Notice status="blocked">La negociación de este token está pausada.</Notice>;

  const shownPrice = priceText ?? formatUsdc(snapshot.reference);
  const amount = parseTokens(amountText);
  const price = parseUsdc(shownPrice);

  const amountError = amount === null || amount === 0n ? "Ingresá una cantidad entera." : amount > snapshot.tokens ? `Tenés ${tokensLabel(snapshot.tokens)}.` : undefined;
  const priceError =
    price === null ? "Ingresá un precio." : price < snapshot.low || price > snapshot.high ? `Fuera del rango permitido: USDC ${formatUsdc(snapshot.low)} a ${formatUsdc(snapshot.high)}.` : undefined;
  const ready = amount !== null && price !== null && !amountError && !priceError;

  function post() {
    if (!ready) return;
    return posting.run(async () => {
      const order: Order = {
        chainId: BigInt(chain.id),
        token: config.token,
        venue: config.venue,
        seller: address,
        amount,
        price,
        expiry: BigInt(Math.floor(Date.now() / 1000)) + ORDER_LIFETIME_S,
        nonce: randomNonce(),
      };
      const sponsor = await getSponsor(actor);
      const signature = await sponsor.signOrder(actor, order);
      setPosted(await venue.postOrder(toWireOrder(order), signature));
      wallet.refresh();
    });
  }

  return (
    <>
      <section className="wallet-stack">
        <h2 className="t-title">Vender {snapshot.tokenName}</h2>
        <TextField
          label="Cantidad"
          inputMode="numeric"
          value={amountText}
          help={`Tenés ${tokensLabel(snapshot.tokens)}.`}
          error={amountError}
          onChange={(e) => setAmountText(e.target.value)}
        />
        <TextField label="Precio por token, en USDC" inputMode="decimal" value={shownPrice} error={priceError} onChange={(e) => setPriceText(e.target.value)} />
      </section>

      <section className="wallet-stack">
        <span className="t-field-label">Rango permitido</span>
        <PriceBand min={usdcToNumber(snapshot.low)} max={usdcToNumber(snapshot.high)} value={usdcToNumber(price ?? snapshot.reference)} />
      </section>

      <Coupon
        label="Orden de venta"
        title={snapshot.tokenName}
        fields={[
          { label: "Cantidad", value: amount === null ? "-" : tokensLabel(amount) },
          { label: "Precio", value: price === null ? "-" : `USDC ${formatUsdc(price)}` },
        ]}
        note="Tus tokens quedan en tu billetera hasta que alguien acepte."
        total={formatUsdc((amount ?? 0n) * (price ?? 0n))}
      />

      <section className="wallet-stack">
        <Button variant="primary" size="lg" busy={posting.busy} disabled={!ready} onClick={post}>
          {ready ? `Vender ${tokensLabel(amount)}` : "Vender"}
        </Button>
        <p className="caveat">{SPONSOR_LABEL}</p>
        {posting.error && (
          <Notice status="blocked" word="Rechazado">
            {posting.error}
          </Notice>
        )}
        {posted && (
          <div className="wallet-stack">
            <Notice status="verified" word="Publicada">
              Firmaste tu orden. El PSAV la publicó en el libro.
            </Notice>
            <HashText value={posted.announceTx} href={explorerUrl("tx", posted.announceTx)} />
          </div>
        )}
      </section>
    </>
  );
}
