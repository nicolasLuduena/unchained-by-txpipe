"use client";

import type { ReactNode } from "react";
import type { Hash } from "viem";
import { Coupon, Hash as HashText, Stamp, type CouponState } from "@/design";
import { explorerUrl } from "@/lib/chain";
import { fromWireOrder, type OrderStatus, type OrderView } from "@/lib/orders/types";
import { formatUsdc, tokensLabel } from "@/lib/wallet/format";

const COUPON_STATE: Record<OrderStatus, CouponState> = { open: "open", filled: "sold", cancelled: "cancelled", expired: "cancelled" };

const REASON: Partial<Record<OrderStatus, string>> = {
  cancelled: "Cancelada por quien vendía, sin gas.",
  expired: "Venció sin comprador.",
};

type Props = {
  view: OrderView;
  label: string;
  tokenName: string;
  reference?: bigint;
  note?: string;
  torn?: boolean;
  children?: ReactNode;
};

/** An order, in whatever state it reached. It never disappears; it changes state. */
export function OrderCoupon({ view, label, tokenName, reference, note, torn, children }: Props) {
  const order = fromWireOrder(view.order);
  const fields = [
    { label: "Cantidad", value: tokensLabel(order.amount) },
    { label: "Precio", value: `USDC ${formatUsdc(order.price)}` },
  ];
  if (reference !== undefined) fields.push({ label: "Precio de referencia", value: `USDC ${formatUsdc(reference)}` });

  return (
    <Coupon
      label={label}
      number={`N.º ${(order.nonce % 10_000n).toString().padStart(4, "0")}`}
      title={tokenName}
      fields={fields}
      note={note}
      total={formatUsdc(order.amount * order.price)}
      state={COUPON_STATE[view.status]}
      torn={torn}
      hash={view.closeTx}
      hashHref={view.closeTx && explorerUrl("tx", view.closeTx)}
      reason={REASON[view.status]}
    >
      {children}
    </Coupon>
  );
}

/** What a fill leaves behind: the explorer link and the registry report, which is a labelled mock. */
export function FillProof({ view, userOpHash }: { view: OrderView; userOpHash?: Hash }) {
  const href = view.closeTx && explorerUrl("tx", view.closeTx);
  return (
    <div className="wallet-stack">
      {href ? (
        <a className="wallet-link" href={href} target="_blank" rel="noreferrer">
          Ver en el explorador
        </a>
      ) : (
        <p className="caveat">Red local: esta transacción no tiene explorador.</p>
      )}
      {userOpHash && (
        <div className="wallet-doc">
          <span className="t-field-label">Operación patrocinada</span>
          <HashText value={userOpHash} />
        </div>
      )}
      {view.report?.status === "acknowledged" ? (
        <p className="caveat">
          {view.report.label}. {view.report.id}
        </p>
      ) : (
        <Stamp status="pending">Reporte pendiente</Stamp>
      )}
    </div>
  );
}
