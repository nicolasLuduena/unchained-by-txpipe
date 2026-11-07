"use client";

import { useState } from "react";
import { encodeFunctionData, erc20Abi, isAddressEqual, type Hash } from "viem";
import { Amount, AssetRow, Button, Hash as HashText, Notice } from "@/design";
import { handoffSettlementAbi } from "@/lib/abi";
import { explorerUrl, networkLabel } from "@/lib/chain";
import { venue, VenueRefusal } from "@/lib/orders/client";
import { fromWireOrder, type OrderView } from "@/lib/orders/types";
import { getSponsor, SPONSOR_LABEL, type Actor } from "@/lib/sponsor";
import { sendDirect, type DirectResult } from "@/lib/sponsor/direct";
import type { WalletConfig } from "@/lib/wallet/deployment";
import { formatUsdc, tokensLabel } from "@/lib/wallet/format";
import { FillProof, OrderCoupon } from "./OrderCoupon";
import { useAction, type Wallet } from "./useWallet";

function lowestAsk(orders: OrderView[]): OrderView | undefined {
  // Oldest first, so the first order at a price keeps its place.
  const open = orders.filter((o) => o.status === "open").reverse();
  return open.reduce<OrderView | undefined>((best, o) => (!best || BigInt(o.order.price) < BigInt(best.order.price) ? o : best), undefined);
}

function fillData(view: OrderView, venueSig: `0x${string}`) {
  return encodeFunctionData({ abi: handoffSettlementAbi, functionName: "fill", args: [fromWireOrder(view.order), view.sellerSig, venueSig] });
}

type Props = { config: WalletConfig; actor: Actor; wallet: Wallet };

export function MarketSection({ config, actor, wallet }: Props) {
  const { address, snapshot, orders, precheck } = wallet;
  const [lastFill, setLastFill] = useState<{ orderHash: Hash; userOpHash?: Hash } | null>(null);
  const [attempt, setAttempt] = useState<DirectResult | null>(null);
  const buying = useAction();
  const direct = useAction();

  if (!snapshot) return <Notice status="pending">Reading your account on {networkLabel}.</Notice>;

  const ask = lowestAsk(orders);
  const ownAsk = ask && isAddressEqual(ask.order.seller, address);
  const total = ask ? BigInt(ask.order.amount) * BigInt(ask.order.price) : 0n;
  const filled = orders.find((o) => o.orderHash === lastFill?.orderHash && o.status === "filled");

  function buy(view: OrderView) {
    return buying.run(async () => {
      const venueSig = await venue.coSign(view.orderHash, address);
      const sponsor = await getSponsor(actor);
      const amount = BigInt(view.order.amount) * BigInt(view.order.price);
      const { userOpHash } = await sponsor.sendCalls(actor, [
        { to: config.usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [config.settlement, amount] }) },
        { to: config.settlement, data: fillData(view, venueSig) },
      ]);
      setLastFill({ orderHash: view.orderHash, userOpHash });
      wallet.refresh();
    });
  }

  function attemptDirect(view: OrderView) {
    return direct.run(async () => {
      // A venue that refuses outright still leaves a named revert: the fill goes out with no co-signature.
      const venueSig = await venue.coSign(view.orderHash, address, true).catch((error: unknown) => {
        if (error instanceof VenueRefusal) return "0x" as const;
        throw error;
      });
      setAttempt(await sendDirect(actor, { to: config.settlement, data: fillData(view, venueSig) }));
    });
  }

  return (
    <>
      <section className="host__balance">
        <span className="t-field-label">Available balance</span>
        <Amount value={formatUsdc(snapshot.usdc)} currency="USDC" size="l" />
        <p className="caveat">The USDC you have to buy tokens.</p>
      </section>

      <section className="wallet-stack">
        <h2 className="t-title">Your assets</h2>
        <AssetRow name={snapshot.tokenName} meta={`${tokensLabel(snapshot.tokens)} · Reference price`} price={formatUsdc(snapshot.reference)} />
      </section>

      {filled && (
        <section className="wallet-stack">
          <OrderCoupon view={filled} label="Purchase" tokenName={snapshot.tokenName} torn />
          <FillProof view={filled} userOpHash={lastFill?.userOpHash} />
        </section>
      )}

      <section className="wallet-stack">
        <h2 className="t-title">Best offer</h2>
        <p className="caveat">The open sell order with the lowest price.</p>
        {ask ? (
          <OrderCoupon
            view={ask}
            label="Sell order"
            tokenName={snapshot.tokenName}
            reference={snapshot.reference}
            note={ownAsk ? "This offer is yours." : "You pay and receive the tokens in one transaction."}
          />
        ) : (
          <p className="caveat">No open offers yet. Reference price: USDC {formatUsdc(snapshot.reference)}.</p>
        )}

        {precheck === "blocked" && actor !== "metamask" && <Notice status="blocked">Verify your identity in the wallet to trade.</Notice>}

        {ask && !ownAsk && precheck === "passed" && (
          <>
            <Button variant="primary" size="lg" busy={buying.busy} disabled={total > snapshot.usdc} onClick={() => buy(ask)}>
              {`Buy ${tokensLabel(BigInt(ask.order.amount))}`}
            </Button>
            {total > snapshot.usdc && <p className="caveat">Your balance does not cover this offer.</p>}
            <p className="caveat">{SPONSOR_LABEL}</p>
          </>
        )}
        {buying.error && (
          <Notice status="blocked" word="Refused">
            {buying.error}
          </Notice>
        )}
      </section>

      {ask && precheck === "blocked" && actor !== "metamask" && (
        <section className="wallet-demo-control">
          <span className="t-field-label">Demo control</span>
          <p className="caveat">Skips the wallet and calls the contract from this account, which pays its own gas.</p>
          <Button variant="secondary" busy={direct.busy} onClick={() => attemptDirect(ask)}>
            Try a direct purchase
          </Button>
          {direct.error && (
            <Notice status="blocked" word="Not sent">
              {direct.error}
            </Notice>
          )}
          {attempt && (
            <div className="wallet-stack">
              <Notice status={attempt.reverted ? "reverted" : "sold"} word={attempt.reverted ? "Refused" : "Accepted"}>
                {attempt.reverted ? `The contract refused the purchase: ${attempt.reason}` : "The contract accepted the transaction."}
              </Notice>
              <HashText value={attempt.hash} href={explorerUrl("tx", attempt.hash)} />
            </div>
          )}
        </section>
      )}
    </>
  );
}
