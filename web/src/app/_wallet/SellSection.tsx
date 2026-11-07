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
  if (precheck === "checking") return <Notice status="pending">Checking your verification.</Notice>;
  if (precheck === "blocked") return actor === "metamask" ? null : <Notice status="blocked">Verify your identity in the wallet to trade.</Notice>;
  if (precheck === "unavailable" || !snapshot) {
    return <Notice status="pending">We could not check your verification. Try again in a moment.</Notice>;
  }
  if (snapshot.blocked) return <Notice status="blocked">The PSAV blocked this account. Contact your wallet.</Notice>;
  if (snapshot.paused) return <Notice status="blocked">Trading in this token is paused.</Notice>;

  const shownPrice = priceText ?? formatUsdc(snapshot.reference);
  const amount = parseTokens(amountText);
  const price = parseUsdc(shownPrice);

  const amountError = amount === null || amount === 0n ? "Enter a whole number." : amount > snapshot.tokens ? `You have ${tokensLabel(snapshot.tokens)}.` : undefined;
  const priceError =
    price === null ? "Enter a price." : price < snapshot.low || price > snapshot.high ? `Outside the price band: USDC ${formatUsdc(snapshot.low)} to ${formatUsdc(snapshot.high)}.` : undefined;
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
        <h2 className="t-title">Sell {snapshot.tokenName}</h2>
        <TextField
          label="Amount"
          inputMode="numeric"
          value={amountText}
          help={`You have ${tokensLabel(snapshot.tokens)}.`}
          error={amountError}
          onChange={(e) => setAmountText(e.target.value)}
        />
        <TextField label="Price per token, in USDC" inputMode="decimal" value={shownPrice} error={priceError} onChange={(e) => setPriceText(e.target.value)} />
      </section>

      <section className="wallet-stack">
        <span className="t-field-label">Price band</span>
        <p className="caveat">The contract refuses any price outside this band, in USDC per token.</p>
        <PriceBand min={usdcToNumber(snapshot.low)} max={usdcToNumber(snapshot.high)} value={usdcToNumber(price ?? snapshot.reference)} />
      </section>

      <Coupon
        label="Sell order"
        title={snapshot.tokenName}
        fields={[
          { label: "Amount", value: amount === null ? "-" : tokensLabel(amount) },
          { label: "Price", value: price === null ? "-" : `USDC ${formatUsdc(price)}` },
        ]}
        note="Your tokens stay in your wallet until someone accepts."
        stubLabel="Order total"
        total={formatUsdc((amount ?? 0n) * (price ?? 0n))}
      />

      <section className="wallet-stack">
        <Button variant="primary" size="lg" busy={posting.busy} disabled={!ready} onClick={post}>
          {ready ? `Sell ${tokensLabel(amount)}` : "Sell"}
        </Button>
        <p className="caveat">{SPONSOR_LABEL}</p>
        {posting.error && (
          <Notice status="blocked" word="Refused">
            {posting.error}
          </Notice>
        )}
        {posted && (
          <div className="wallet-stack">
            <Notice status="verified" word="Posted">
              You signed your order. The PSAV, a licensed virtual asset provider, posted it to the order book, where any verified buyer can accept it.
            </Notice>
            <HashText value={posted.announceTx} href={explorerUrl("tx", posted.announceTx)} />
          </div>
        )}
      </section>
    </>
  );
}
