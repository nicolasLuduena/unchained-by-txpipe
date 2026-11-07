"use client";

import { Fragment } from "react";
import { encodeFunctionData, isAddressEqual } from "viem";
import { Button, Notice } from "@/design";
import { handoffSettlementAbi } from "@/lib/abi";
import { venue } from "@/lib/orders/client";
import type { OrderView } from "@/lib/orders/types";
import { getSponsor, type Actor } from "@/lib/sponsor";
import type { WalletConfig } from "@/lib/wallet/deployment";
import { FillProof, OrderCoupon } from "./OrderCoupon";
import { useAction, type Wallet } from "./useWallet";

type Props = { config: WalletConfig; actor: Actor; wallet: Wallet };

export function OrdersSection({ config, actor, wallet }: Props) {
  const { address, snapshot, orders } = wallet;
  const cancelling = useAction();

  if (!snapshot) return <Notice status="pending">Leyendo tus órdenes.</Notice>;

  const isSeller = (o: OrderView) => isAddressEqual(o.order.seller, address);
  const mine = orders.filter((o) => isSeller(o) || (o.buyer && isAddressEqual(o.buyer, address)));

  function cancel(view: OrderView) {
    return cancelling.run(async () => {
      const sponsor = await getSponsor(actor);
      const data = encodeFunctionData({ abi: handoffSettlementAbi, functionName: "cancel", args: [BigInt(view.order.nonce)] });
      await sponsor.sendCalls(actor, [{ to: config.settlement, data }]);
      await venue.markCancelled(view.orderHash);
      wallet.refresh();
    });
  }

  return (
    <section className="wallet-stack">
      <h2 className="t-title">Tus órdenes</h2>
      {mine.length === 0 && <p className="caveat">Todavía no tenés órdenes.</p>}
      {cancelling.error && (
        <Notice status="blocked" word="Rechazado">
          {cancelling.error}
        </Notice>
      )}
      {mine.map((view) => (
        <Fragment key={view.orderHash}>
          <OrderCoupon view={view} label={isSeller(view) ? "Orden de venta" : "Compra"} tokenName={snapshot.tokenName} />
          {view.status === "filled" && <FillProof view={view} />}
          {view.status === "open" && isSeller(view) && (
            <Button variant="danger" busy={cancelling.busy} onClick={() => cancel(view)}>
              Cancelar sin gas
            </Button>
          )}
        </Fragment>
      ))}
    </section>
  );
}
