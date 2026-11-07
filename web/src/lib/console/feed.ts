import type { Address } from "viem";
import type { StampStatus } from "@/design";
import type { OrderView } from "@/lib/orders/types";
import { venueLabel } from "@/lib/orders/venues";
import { usdc, units } from "./format";
import type { ScannedLog } from "./scan";

/** One line of the compliance feed, whether it came from an event or from a refusal. */
export type FeedEntry = {
  id: string;
  at: number; // unix seconds; 0 when the source gave none
  order: number; // tiebreak inside one timestamp
  event: string;
  status: StampStatus;
  asset: string;
  from: string;
  /** Who `from` is when it is not a seller. FeedRow prints "Vende", so these rows relabel it. */
  fromRole?: string;
  to?: string;
  price: string;
  unit?: string;
  hash?: string;
  code: string;
  detail?: string;
};

type Order = { token: Address; venue: Address; seller: Address; amount: bigint; price: bigint; expiry: bigint; nonce: bigint };

const orderKey = (seller: unknown, nonce: unknown) => `${String(seller).toLowerCase()}:${String(nonce)}`;

function lots(amount: bigint, price: bigint): string {
  return `${units(amount)} unidades, total USDC ${usdc(amount * price)}`;
}

const announcedDetail = (amount: bigint, price: bigint, venue: Address) => `${lots(amount, price)}. Publicada por ${venueLabel(venue)}.`;
const filledDetail = (amount: bigint, price: bigint, venue: Address) => `${lots(amount, price)}. Co-firma ${venueLabel(venue)}, la plataforma de la orden.`;

export function feedFromLogs(logs: readonly ScannedLog[], timeOf: (block: bigint) => number, assetName: (token: Address) => string): FeedEntry[] {
  const announced = new Map<string, Order>();
  for (const log of logs) {
    if (log.eventName !== "OrderAnnounced") continue;
    const order = log.args as Order;
    announced.set(orderKey(order.seller, order.nonce), order);
  }

  return logs.map((log) => {
    const base = {
      id: `${log.transactionHash}:${log.logIndex}`,
      at: timeOf(log.blockNumber),
      order: Number(log.blockNumber) * 1000 + log.logIndex,
      hash: log.transactionHash,
      code: log.eventName,
    };
    const a = log.args;
    switch (log.eventName) {
      case "OrderAnnounced": {
        const o = a as Order;
        return { ...base, event: "Orden", status: "unused", asset: assetName(o.token), from: o.seller, price: usdc(o.price), detail: announcedDetail(o.amount, o.price, o.venue) };
      }
      case "OrderFilled": {
        const o = a as Order & { buyer: Address };
        return { ...base, event: "Vendido", status: "sold", asset: assetName(o.token), from: o.seller, to: o.buyer, price: usdc(o.price), detail: filledDetail(o.amount, o.price, o.venue) };
      }
      case "OrderCancelled": {
        const o = announced.get(orderKey(a.seller, a.nonce));
        return {
          ...base,
          event: "Cancelada",
          status: "cancelled",
          asset: o ? assetName(o.token) : "Orden sin anunciar",
          from: a.seller as string,
          price: o ? usdc(o.price) : "-",
          detail: `Nonce ${String(a.nonce)}`,
        };
      }
      case "Reversion":
        return {
          ...base,
          event: "Revertida",
          status: "reverted",
          asset: assetName(a.token as Address),
          from: a.holder as string,
          fromRole: "Titular",
          price: units(a.amount as bigint),
          unit: "Unid.",
          detail: `Art. 16. Certificado ${String(a.certificateRef)}. Documento ${String(a.docHash)}`,
        };
      case "HolderBlocked":
        return {
          ...base,
          event: a.blocked ? "Bloqueado" : "Desbloqueado",
          status: a.blocked ? "blocked" : "verified",
          asset: assetName(a.token as Address),
          from: a.holder as string,
          fromRole: "Titular",
          price: "-",
          unit: " ",
          detail: `Arts. 16 y 19. Por ${String(a.by)}`,
        };
      default:
        return {
          ...base,
          event: a.paused ? "Pausado" : "Reanudado",
          status: a.paused ? "blocked" : "verified",
          asset: assetName(a.token as Address),
          from: a.by as string,
          fromRole: "Por",
          price: "-",
          unit: " ",
          detail: "Art. 36",
        };
    }
  });
}

/** The same rows from the order service, which knows of an order or a fill before any log scan reaches it. */
export function feedFromOrders(orders: readonly OrderView[], assetName: (token: Address) => string): FeedEntry[] {
  return orders.flatMap((view) => {
    const { token, venue, seller } = view.order;
    const amount = BigInt(view.order.amount);
    const price = BigInt(view.order.price);
    const common = { asset: assetName(token), from: seller, price: usdc(price) };
    const at = view.announcedAt ?? 0;
    const rows: FeedEntry[] = [
      { ...common, id: `${view.announceTx}:OrderAnnounced`, at, order: at * 1000, event: "Orden", status: "unused", hash: view.announceTx, code: "OrderAnnounced", detail: announcedDetail(amount, price, venue) },
    ];
    if (view.status === "filled" && view.closeTx) {
      const closed = view.closedAt ?? at;
      rows.push({ ...common, id: `${view.closeTx}:OrderFilled`, at: closed, order: closed * 1000 + 1, event: "Vendido", status: "sold", to: view.buyer, hash: view.closeTx, code: "OrderFilled", detail: filledDetail(amount, price, venue) });
    }
    return rows;
  });
}

/** Scanned rows win over live ones for the same event: they carry the block's own time. Newest first. */
export function mergeFeed(scanned: readonly FeedEntry[], live: readonly FeedEntry[]): FeedEntry[] {
  const known = new Set(scanned.map((entry) => `${entry.hash}:${entry.code}`));
  return [...scanned, ...live.filter((entry) => !known.has(`${entry.hash}:${entry.code}`))].sort((a, b) => b.at - a.at || b.order - a.order);
}

/** Tokens with an order still open: announced, not filled, not cancelled, not expired. */
export function openOrders(logs: readonly ScannedLog[], token: Address, now: number): number {
  const closed = new Set<string>();
  for (const log of logs) {
    if (log.eventName === "OrderFilled" || log.eventName === "OrderCancelled") closed.add(orderKey(log.args.seller, log.args.nonce));
  }
  return logs.filter((log) => {
    if (log.eventName !== "OrderAnnounced") return false;
    const o = log.args as Order;
    return o.token === token && o.expiry > BigInt(now) && !closed.has(orderKey(o.seller, o.nonce));
  }).length;
}

function pick(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function secondsOf(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  if (Number.isNaN(n)) return Math.floor(Date.parse(value) / 1000) || 0;
  return n > 1e11 ? Math.floor(n / 1000) : n;
}

/** The order service owns this shape, so every field is read defensively and nothing here assumes it exists. */
export function feedFromVenue(payload: unknown, assetName: (token: Address) => string): FeedEntry[] {
  const list = Array.isArray(payload) ? payload : ((payload as { refusals?: unknown } | null)?.refusals ?? []);
  if (!Array.isArray(list)) return [];
  return list.flatMap((item, index) => {
    if (typeof item !== "object" || item === null) return [];
    const r = item as Record<string, unknown>;
    const isRevertRequest = pick(r, ["kind", "type"])?.toLowerCase().includes("revert") ?? false;
    const token = pick(r, ["token", "asset"]);
    const at = secondsOf(pick(r, ["at", "timestamp", "time", "createdAt"]));
    const price = pick(r, ["price"]);
    return [
      {
        id: `venue:${pick(r, ["id"]) ?? index}`,
        at,
        order: at * 1000,
        event: isRevertRequest ? "Reversión pedida" : "Rechazado",
        status: (isRevertRequest ? "pending" : "blocked") as StampStatus,
        asset: token ? assetName(token as Address) : "Sin token",
        from: pick(r, ["address", "account", "seller", "holder", "from", "buyer"]) ?? "-",
        fromRole: "Cuenta",
        price: price ?? "-",
        unit: price ? undefined : " ",
        hash: pick(r, ["hash", "txHash", "orderHash"]),
        code: pick(r, ["code", "reasonCode", "reason"]) ?? (isRevertRequest ? "RevertRequest" : "Refused"),
        detail: pick(r, ["message", "detail", "certificateRef"]),
      },
    ];
  });
}
