import type { Address } from "viem";
import type { StampStatus } from "@/design";
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

type Order = { token: Address; seller: Address; amount: bigint; price: bigint; expiry: bigint; nonce: bigint };

const orderKey = (seller: unknown, nonce: unknown) => `${String(seller).toLowerCase()}:${String(nonce)}`;

function lots(amount: bigint, price: bigint): string {
  return `${units(amount)} unidades, total USDC ${usdc(amount * price)}`;
}

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
        return { ...base, event: "Orden", status: "unused", asset: assetName(o.token), from: o.seller, price: usdc(o.price), detail: lots(o.amount, o.price) };
      }
      case "OrderFilled": {
        const o = a as Order & { buyer: Address };
        return { ...base, event: "Vendido", status: "sold", asset: assetName(o.token), from: o.seller, to: o.buyer, price: usdc(o.price), detail: lots(o.amount, o.price) };
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
