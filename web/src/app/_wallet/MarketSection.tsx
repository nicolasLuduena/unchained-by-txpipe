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

  if (!snapshot) return <Notice status="pending">Leyendo tu cuenta en {networkLabel}.</Notice>;

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
        <span className="t-field-label">Saldo disponible</span>
        <Amount value={formatUsdc(snapshot.usdc)} currency="USDC" size="l" />
      </section>

      <section className="wallet-stack">
        <h2 className="t-title">Tus activos</h2>
        <AssetRow name={snapshot.tokenName} meta={`${tokensLabel(snapshot.tokens)} · Precio de referencia`} price={formatUsdc(snapshot.reference)} />
      </section>

      {filled && (
        <section className="wallet-stack">
          <OrderCoupon view={filled} label="Compra" tokenName={snapshot.tokenName} torn />
          <FillProof view={filled} userOpHash={lastFill?.userOpHash} />
        </section>
      )}

      <section className="wallet-stack">
        <h2 className="t-title">Mejor oferta</h2>
        {ask ? (
          <OrderCoupon
            view={ask}
            label="Orden de venta"
            tokenName={snapshot.tokenName}
            reference={snapshot.reference}
            note={ownAsk ? "Esta oferta es tuya." : "Pagás y recibís los tokens en una sola transacción."}
          />
        ) : (
          <p className="caveat">Todavía no hay ofertas abiertas. Precio de referencia: USDC {formatUsdc(snapshot.reference)}.</p>
        )}

        {precheck === "blocked" && actor !== "metamask" && <Notice status="blocked">Verificá tu identidad en la billetera para operar.</Notice>}

        {ask && !ownAsk && precheck === "passed" && (
          <>
            <Button variant="primary" size="lg" busy={buying.busy} disabled={total > snapshot.usdc} onClick={() => buy(ask)}>
              {`Comprar ${tokensLabel(BigInt(ask.order.amount))}`}
            </Button>
            {total > snapshot.usdc && <p className="caveat">Tu saldo no alcanza para esta oferta.</p>}
            <p className="caveat">{SPONSOR_LABEL}</p>
          </>
        )}
        {buying.error && (
          <Notice status="blocked" word="Rechazado">
            {buying.error}
          </Notice>
        )}
      </section>

      {ask && precheck === "blocked" && actor !== "metamask" && (
        <section className="wallet-demo-control">
          <span className="t-field-label">Control de demostración</span>
          <p className="caveat">Saltea la billetera y llama al contrato desde esta cuenta, pagando su propio gas.</p>
          <Button variant="secondary" busy={direct.busy} onClick={() => attemptDirect(ask)}>
            Intentar compra directa
          </Button>
          {direct.error && (
            <Notice status="blocked" word="Sin enviar">
              {direct.error}
            </Notice>
          )}
          {attempt && (
            <div className="wallet-stack">
              <Notice status={attempt.reverted ? "reverted" : "sold"} word={attempt.reverted ? "Rechazada" : undefined}>
                {attempt.reverted ? `El contrato rechazó la compra: ${attempt.reason}` : "La transacción no se revirtió."}
              </Notice>
              <HashText value={attempt.hash} href={explorerUrl("tx", attempt.hash)} />
            </div>
          )}
        </section>
      )}
    </>
  );
}
