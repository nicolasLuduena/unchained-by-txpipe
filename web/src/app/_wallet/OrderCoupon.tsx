"use client";

import type { ReactNode } from "react";
import type { Hash } from "viem";
import { Coupon, Hash as HashText, Stamp, type CouponState } from "@/design";
import { explorerUrl } from "@/lib/chain";
import { fromWireOrder, type OrderStatus, type OrderView } from "@/lib/orders/types";
import { formatUsdc, tokensLabel } from "@/lib/wallet/format";

const COUPON_STATE: Record<OrderStatus, CouponState> = { open: "open", filled: "sold", cancelled: "cancelled", expired: "cancelled" };

const STUB_LABEL: Record<OrderStatus, string> = { open: "Order total", filled: "Total settled", cancelled: "Total not traded", expired: "Total not traded" };

const REASON: Partial<Record<OrderStatus, string>> = {
  cancelled: "Cancelled by the seller, with no gas.",
  expired: "Expired with no buyer.",
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
    { label: "Amount", value: tokensLabel(order.amount) },
    { label: "Price", value: `USDC ${formatUsdc(order.price)}` },
  ];
  if (reference !== undefined) fields.push({ label: "Reference price", value: `USDC ${formatUsdc(reference)}` });

  return (
    <Coupon
      label={label}
      number={`No. ${(order.nonce % 10_000n).toString().padStart(4, "0")}`}
      title={tokenName}
      fields={fields}
      note={note}
      stubLabel={STUB_LABEL[view.status]}
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
        <a className="wallet-link hf-arrow" href={href} target="_blank" rel="noreferrer">
          View on the explorer
        </a>
      ) : (
        <p className="caveat">Local network: this transaction has no explorer.</p>
      )}
      {userOpHash && (
        <div className="wallet-doc">
          <span className="t-field-label">Sponsored operation</span>
          <HashText value={userOpHash} />
          <p className="caveat">The sponsor covered the gas, not you.</p>
        </div>
      )}
      {view.report?.status === "acknowledged" ? (
        <p className="caveat">
          {view.report.label}. {view.report.id}
        </p>
      ) : (
        <div className="wallet-doc">
          <Stamp className="wallet-report" status="pending">Report pending</Stamp>
          <p className="caveat">The sale is settled. The registry report has no acknowledgment yet.</p>
        </div>
      )}
    </div>
  );
}
