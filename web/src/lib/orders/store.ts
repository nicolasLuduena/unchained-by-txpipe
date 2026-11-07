import "server-only";
import type { Address, Hash, Hex } from "viem";
import { chain } from "@/lib/chain";
import type { Acknowledgment } from "@/lib/registry-report";
import { coreContracts } from "@/lib/wallet/deployment";
import { venueKv } from "./kv";
import type { Order, Refusal, ReversionStatus } from "./types";

export type StoredOrder = {
  orderHash: Hash;
  order: Order;
  sellerSig: Hex;
  announceTx: Hash;
  announceBlock: bigint;
  filled?: { tx: Hash; buyer: Address };
  cancelled?: { tx?: Hash };
  acknowledged?: Acknowledgment;
};

export type StoredReversion = {
  id: Hash;
  token: Address;
  holder: Address;
  amount: bigint;
  requestedAt: bigint;
  /** The next block to look at for the PSAV's Reversion event. */
  scanFrom: bigint;
  status: ReversionStatus;
  certificateRef?: string;
  txHash?: Hash;
};

type ReversionOutcome = { certificateRef?: string; txHash: Hash };
type OrderRecord = Omit<StoredOrder, "filled" | "cancelled" | "acknowledged">;
type ReversionRecord = Omit<StoredReversion, "scanFrom" | "status" | "certificateRef" | "txHash">;

const MAX_REFUSALS = 200;
const LOCK_TTL_MS = 60_000;
const LOCK_WAIT_MS = 30_000;
const LOCK_POLL_MS = 150;

/*
 * Each mutable fact has its own hash, written by one idempotent HSET. Serverless instances poll the same
 * records at once, and rewriting a whole record would let a stale reader undo a newer write: a "still
 * pending" scan landing after "done" would strand a reversion, since scanFrom has already passed its event.
 */
const ORDERS = "orders";
const FILLS = "orders:filled";
const CANCELS = "orders:cancelled";
const ACKS = "orders:acknowledged";
const REVERSIONS = "reversions";
const SCANS = "reversions:scan";
const OUTCOMES = "reversions:outcome";
const REFUSALS = "refusals";
const REFUSAL_ID = "refusals:id";

function encode(value: unknown): string {
  return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? { $bigint: v.toString() } : v));
}

function decode<T>(raw: string): T {
  return JSON.parse(raw, (_, v) => (typeof v?.$bigint === "string" ? BigInt(v.$bigint) : v));
}

function decodeAll<T>(record: Record<string, string>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).map(([field, raw]) => [field, decode<T>(raw)]));
}

/** Scoped to one settlement on one chain, so a redeploy starts with an empty book. */
function key(name: string): string {
  const prefix = process.env.VENUE_STORE_PREFIX ?? "handoff";
  const settlement = coreContracts()?.settlement.toLowerCase() ?? "undeployed";
  return `${prefix}:${chain.id}:${settlement}:${name}`;
}

export const store = {
  async putOrder({ orderHash, order, sellerSig, announceTx, announceBlock }: StoredOrder) {
    const record: OrderRecord = { orderHash, order, sellerSig, announceTx, announceBlock };
    await venueKv().hset(key(ORDERS), orderHash, encode(record));
  },

  async getOrder(orderHash: Hash): Promise<StoredOrder | undefined> {
    const kv = venueKv();
    const [record, filled, cancelled, acknowledged] = await Promise.all([ORDERS, FILLS, CANCELS, ACKS].map((name) => kv.hget(key(name), orderHash)));
    if (!record) return undefined;
    return {
      ...decode<OrderRecord>(record),
      filled: filled ? decode(filled) : undefined,
      cancelled: cancelled ? decode(cancelled) : undefined,
      acknowledged: acknowledged ? decode(acknowledged) : undefined,
    };
  },

  /** Oldest first. */
  async listOrders(): Promise<StoredOrder[]> {
    const kv = venueKv();
    const [orders, filled, cancelled, acknowledged] = await Promise.all([ORDERS, FILLS, CANCELS, ACKS].map((name) => kv.hgetall(key(name))));
    const fills = decodeAll<StoredOrder["filled"]>(filled);
    const cancels = decodeAll<StoredOrder["cancelled"]>(cancelled);
    const acks = decodeAll<Acknowledgment>(acknowledged);
    return Object.values(decodeAll<OrderRecord>(orders))
      .sort((a, b) => Number(a.announceBlock - b.announceBlock) || a.orderHash.localeCompare(b.orderHash))
      .map((order) => ({ ...order, filled: fills[order.orderHash], cancelled: cancels[order.orderHash], acknowledged: acks[order.orderHash] }));
  },

  async recordFill(orderHash: Hash, filled: NonNullable<StoredOrder["filled"]>) {
    await venueKv().hset(key(FILLS), orderHash, encode(filled));
  },

  async recordCancel(orderHash: Hash, cancelled: NonNullable<StoredOrder["cancelled"]>) {
    await venueKv().hset(key(CANCELS), orderHash, encode(cancelled));
  },

  async recordAcknowledgment(orderHash: Hash, acknowledged: Acknowledgment) {
    await venueKv().hset(key(ACKS), orderHash, encode(acknowledged));
  },

  async putReversion({ id, token, holder, amount, requestedAt, scanFrom }: StoredReversion) {
    const kv = venueKv();
    const record: ReversionRecord = { id, token, holder, amount, requestedAt };
    await kv.hset(key(SCANS), id, encode(scanFrom));
    await kv.hset(key(REVERSIONS), id, encode(record));
  },

  /** Oldest first. */
  async listReversions(): Promise<StoredReversion[]> {
    const kv = venueKv();
    const [reversions, scans, outcomes] = await Promise.all([REVERSIONS, SCANS, OUTCOMES].map((name) => kv.hgetall(key(name))));
    const scanFrom = decodeAll<bigint>(scans);
    const outcome = decodeAll<ReversionOutcome>(outcomes);
    return Object.values(decodeAll<ReversionRecord>(reversions))
      .sort((a, b) => Number(a.requestedAt - b.requestedAt) || a.id.localeCompare(b.id))
      .map((r) => ({ ...r, scanFrom: scanFrom[r.id] ?? 0n, status: outcome[r.id] ? "done" : "pending", ...outcome[r.id] }));
  },

  /** A slower instance can move this back. That costs a rescan and misses nothing: every value was scanned up to. */
  async advanceScan(id: Hash, scanFrom: bigint) {
    await venueKv().hset(key(SCANS), id, encode(scanFrom));
  },

  async recordOutcome(id: Hash, outcome: ReversionOutcome) {
    await venueKv().hset(key(OUTCOMES), id, encode(outcome));
  },

  /** INCR and a capped push, so two instances refusing at once get distinct ids and neither entry is lost. */
  async addRefusal(refusal: Omit<Refusal, "id">) {
    const kv = venueKv();
    const id = await kv.incr(key(REFUSAL_ID));
    await kv.pushCapped(key(REFUSALS), encode({ id, ...refusal }), MAX_REFUSALS);
  },

  /** Newest first. */
  async listRefusals(): Promise<Refusal[]> {
    return (await venueKv().list(key(REFUSALS))).map((raw) => decode<Refusal>(raw));
  },

  /** True for the one instance that should do the work. The claim is left to expire, which is also the retry. */
  claim(name: string, ttlMs: number): Promise<boolean> {
    return venueKv().acquire(key(`claim:${name}`), crypto.randomUUID(), ttlMs);
  },

  /** Runs `work` while no other instance runs work under the same name. Throws if the wait runs out. */
  async exclusive<T>(name: string, work: () => Promise<T>): Promise<T> {
    const kv = venueKv();
    const lock = key(`lock:${name}`);
    const token = crypto.randomUUID();
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (!(await kv.acquire(lock, token, LOCK_TTL_MS))) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${name}`);
      await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
    }
    try {
      return await work();
    } finally {
      await kv.release(lock, token);
    }
  },
};
