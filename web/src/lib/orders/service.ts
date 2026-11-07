import "server-only";
import { after } from "next/server";
import { getAddress, hashMessage, isAddressEqual, parseEventLogs, type Address, type Hash, type Hex } from "viem";
import { handoffRegistryAbi, handoffSettlementAbi, handoffTokenAbi } from "@/lib/abi";
import { chain, chainName, publicClient } from "@/lib/chain";
import { registryReport } from "@/lib/registry-report";
import { bandLimits } from "@/lib/wallet/band";
import { coreContracts } from "@/lib/wallet/deployment";
import { withinRate } from "@/lib/onboard/limits";
import { firstInSpans } from "@/lib/wallet/logs";
import { revertAbi, revertReason } from "@/lib/wallet/revert-reason";
import { store, type StoredOrder, type StoredReversion } from "./store";
import { reversionDigest, toWireOrder, type Order, type OrderView, type Refusal, type ReversionView, type WireOrder } from "./types";
import { orderKeyAccount, orderKeyClient } from "./venue";
import { venueIndex } from "./venues";

const RECEIPT_POLL_MS = chainName === "local" ? 200 : 1000;
const REVERSION_MAX_AGE_S = 600n;
const REPORT_CLAIM_MS = 30_000;
const ORDERS_PER_MINUTE = 20;
/** One instance at a time looks an event up by logs, and no more often than this: eth_getLogs quota is per IP, not per instance. */
const LOG_LOOKUP_GAP_MS = chainName === "local" ? 1000 : 20_000;

/** A request the PSAV declines. Logged to the refusal list the console reads. */
export class Refused extends Error {
  constructor(
    readonly code: string,
    reason: string,
    readonly status = 422,
    readonly context: Pick<Refusal, "address" | "orderHash"> = {},
  ) {
    super(reason);
  }
}

export function logRefusal(route: string, refused: Refused): Promise<void> {
  return store.addRefusal({
    at: new Date().toISOString(),
    route,
    code: refused.code,
    reason: refused.message,
    ...refused.context,
  });
}

export function listRefusals(): Promise<Refusal[]> {
  return store.listRefusals();
}

function core() {
  const contracts = coreContracts();
  if (!contracts) throw new Refused("not_deployed", "The contracts are not deployed yet.", 503);
  return contracts;
}

function settlement() {
  return { address: core().settlement, abi: handoffSettlementAbi } as const;
}

function registry() {
  return { address: core().registry, abi: handoffRegistryAbi } as const;
}

function nowSeconds() {
  return BigInt(Math.floor(Date.now() / 1000));
}

export function parseAddress(value: unknown, field: string): Address {
  try {
    return getAddress(String(value));
  } catch {
    throw new Refused("malformed", `The ${field} address is not valid.`, 400);
  }
}

export function parseUint(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Refused("malformed", `The ${field} field is not a positive whole number.`, 400);
  }
  return BigInt(value);
}

export function parseOrder(raw: Partial<WireOrder> | undefined): Order {
  if (!raw) throw new Refused("malformed", "The order is missing.", 400);
  return {
    chainId: parseUint(raw.chainId, "chainId"),
    token: parseAddress(raw.token, "token"),
    venue: parseAddress(raw.venue, "venue"),
    seller: parseAddress(raw.seller, "seller"),
    amount: parseUint(raw.amount, "amount"),
    price: parseUint(raw.price, "price"),
    expiry: parseUint(raw.expiry, "expiry"),
    nonce: parseUint(raw.nonce, "nonce"),
  };
}

function parseSignature(value: unknown): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Refused("malformed", "The signature is not valid.", 400);
  }
  return value as Hex;
}

async function assertTradable(token: Address) {
  const registered = await publicClient.readContract({ ...registry(), functionName: "isRegistered", args: [token] });
  if (!registered) throw new Refused("unknown_token", "This token is not registered.");
  const info = await publicClient.readContract({ ...registry(), functionName: "tokenInfo", args: [token] });
  if (info.paused) throw new Refused("paused", "Trading in this token is paused.");
  if (!info.tradingEnabled) throw new Refused("trading_disabled", "This token does not allow trading.");
  return info;
}

async function assertInBand(token: Address, price: bigint, floor: bigint, seller: Address) {
  const context = { address: seller };
  const band = await publicClient.readContract({ ...registry(), functionName: "band", args: [token] });
  if (band.price === 0n) throw new Refused("band_not_set", "This token has no reference price yet.", 422, context);
  if (band.maxAge !== 0n && nowSeconds() > band.timestamp + band.maxAge) {
    throw new Refused("price_stale", "The reference price has expired.", 422, context);
  }
  const { low, high } = bandLimits(band, floor);
  if (price < low || price > high) {
    throw new Refused("out_of_band", `The price ${price} is outside the allowed range, from ${low} to ${high}.`, 422, context);
  }
}

/** Accepts the raw digest or its EIP-191 wrapping, the same two forms HandoffSettlement accepts from a seller. */
async function assertHolderSigned(address: Address, digest: Hash, signature: Hex) {
  // verifyHash covers EOAs and ERC-1271 smart accounts, so this survives the move to Fuji.
  const verify = (hash: Hash) => publicClient.verifyHash({ address, hash, signature }).catch(() => false);
  if ((await verify(digest)) || (await verify(hashMessage({ raw: digest })))) return;
  throw new Refused("invalid_holder_signature", "The signature does not match this account.", 422, { address });
}

/** Everything an order must be before the PSAV takes it. The sponsor checks the same before it signs one. */
export async function assertPostable(order: Order) {
  const { seller } = order;
  const context = { address: seller };

  if (order.chainId !== BigInt(chain.id)) throw new Refused("wrong_chain", "This order is for another network.", 422, context);
  if (venueIndex(order.venue) < 0) throw new Refused("unknown_venue", "This order belongs to another venue.", 422, context);
  if (order.amount === 0n) throw new Refused("zero_amount", "The amount must be greater than zero.", 422, context);
  if (order.expiry <= nowSeconds()) throw new Refused("expired", "This order has expired.", 422, context);

  const info = await assertTradable(order.token);
  await assertInBand(order.token, order.price, info.floor, seller);

  const [attested, blocked, balance, filled, cancelled] = await Promise.all([
    publicClient.readContract({ ...registry(), functionName: "isAttested", args: [order.token, seller] }),
    publicClient.readContract({ ...registry(), functionName: "isBlocked", args: [order.token, seller] }),
    publicClient.readContract({ address: order.token, abi: handoffTokenAbi, functionName: "balanceOf", args: [seller] }),
    publicClient.readContract({ ...settlement(), functionName: "filled", args: [seller, order.nonce] }),
    publicClient.readContract({ ...settlement(), functionName: "cancelled", args: [seller, order.nonce] }),
  ]);
  // The contract announces a spent nonce without complaint, and that order could never fill.
  if (filled || cancelled) throw new Refused("nonce_used", "This order was already used. Sign a new one.", 409, context);
  if (!attested) throw new Refused("seller_not_attested", "The seller's account is not verified.", 403, context);
  if (blocked) throw new Refused("seller_blocked", "The PSAV blocked the seller's account.", 403, context);
  if (balance < order.amount) throw new Refused("insufficient_balance", "You do not have that many tokens.", 422, context);
}

/** The digest a seller signs, as the settlement contract computes it. */
export function hashOrder(order: Order): Promise<Hash> {
  return publicClient.readContract({ ...settlement(), functionName: "hashOrder", args: [order] });
}

/**
 * Validates a signed order, announces it from the order key so it reaches the feed, and stores it.
 * The seller signature, venue and order key are judged by simulating announceOrder: the contract is the
 * one place that decides what a valid seller signature is.
 */
export async function postOrder(body: { order?: Partial<WireOrder>; sellerSig?: unknown }): Promise<OrderView> {
  const order = parseOrder(body.order);
  const sellerSig = parseSignature(body.sellerSig);
  if (!(await withinRate("orders", ORDERS_PER_MINUTE, 60_000))) throw new Refused("rate_limited", "Too many orders. Try again in a minute.", 429);
  await assertPostable(order);

  const orderHash = await hashOrder(order);
  const hashed = { address: order.seller, orderHash };

  // One at a time per venue across instances: its order key has one nonce, and the duplicate check must see the last write.
  return store.exclusive(`order-key:${order.venue}`, () => announce(order, sellerSig, hashed));
}

async function announce(order: Order, sellerSig: Hex, hashed: { address: Address; orderHash: Hash }): Promise<OrderView> {
  const { orderHash } = hashed;
  if (await store.getOrder(orderHash)) throw new Refused("duplicate", "This order is already posted.", 409, hashed);

  const simulated = await publicClient
    .simulateContract({ ...settlement(), abi: revertAbi, functionName: "announceOrder", args: [order, sellerSig], account: orderKeyAccount(order.venue) })
    .catch((error: unknown) => {
      const reason = revertReason(error);
      if (reason.startsWith("InvalidSellerSignature")) {
        throw new Refused("invalid_seller_signature", "The signature does not match the seller's account.", 422, hashed);
      }
      throw new Refused("announce_reverted", `The contract refused the order: ${reason}`, 422, hashed);
    });
  const announceTx = await orderKeyClient(order.venue).writeContract(simulated.request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: announceTx, pollingInterval: RECEIPT_POLL_MS });

  const stored: StoredOrder = { orderHash, order, sellerSig, announceTx, announceBlock: receipt.blockNumber, announcedAt: Number(nowSeconds()) };
  await store.putOrder(stored);
  return view(stored);
}

/**
 * One instance reports a fill. The claim expires, so a report that failed or died is retried by a later read.
 * `after` keeps the function alive past the response; a bare promise would freeze with it on Vercel.
 */
async function reportFill(stored: StoredOrder) {
  const { order, orderHash, filled } = stored;
  if (stored.acknowledged || !filled) return;
  if (!(await store.claim(`report:${orderHash}`, REPORT_CLAIM_MS))) return;
  after(async () => {
    const ack = await registryReport.report({
      orderHash,
      txHash: filled.tx,
      token: order.token,
      seller: order.seller,
      buyer: filled.buyer,
      amount: order.amount,
      price: order.price,
    });
    await store.recordAcknowledgment(orderHash, ack);
  });
}

/** The chain decides whether an order is still open; the store only remembers what it has seen. */
async function syncWithChain(stored: StoredOrder): Promise<StoredOrder> {
  if (stored.filled || stored.cancelled) {
    await reportFill(stored);
    return stored;
  }
  const { seller, nonce } = stored.order;
  const [filled, cancelled] = await Promise.all([
    publicClient.readContract({ ...settlement(), functionName: "filled", args: [seller, nonce] }),
    publicClient.readContract({ ...settlement(), functionName: "cancelled", args: [seller, nonce] }),
  ]);
  if (!filled && !cancelled) return stored;
  // A sponsored fill is recorded from its own receipt moments from now, so a lookup here is only the fallback.
  // Losing the claim only means another request is finding the event. The flag already settles a cancel.
  if (!(await store.claim(`lookup:${stored.orderHash}`, LOG_LOOKUP_GAP_MS))) return cancelled && !filled ? { ...stored, cancelled: {} } : stored;

  // The flag proves the event exists, so this scan runs once per order and always ends.
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  if (filled) {
    const [event] = await firstInSpans(stored.announceBlock, latest, (fromBlock, toBlock) =>
      publicClient.getContractEvents({ ...settlement(), eventName: "OrderFilled", args: { orderHash: stored.orderHash }, fromBlock, toBlock }),
    );
    if (!event?.args.buyer) return stored;
    const synced = { ...stored, filled: { tx: event.transactionHash, buyer: event.args.buyer, at: Number(nowSeconds()) } };
    await store.recordFill(stored.orderHash, synced.filled);
    await reportFill(synced);
    return synced;
  }
  const [event] = await firstInSpans(stored.announceBlock, latest, (fromBlock, toBlock) =>
    publicClient.getContractEvents({ ...settlement(), eventName: "OrderCancelled", args: { seller, nonce }, fromBlock, toBlock }),
  );
  const synced = { ...stored, cancelled: { tx: event?.transactionHash } };
  await store.recordCancel(stored.orderHash, synced.cancelled);
  return synced;
}

function view(stored: StoredOrder): OrderView {
  const expired = stored.order.expiry <= nowSeconds();
  const status = stored.filled ? "filled" : stored.cancelled ? "cancelled" : expired ? "expired" : "open";
  return {
    orderHash: stored.orderHash,
    order: toWireOrder(stored.order),
    sellerSig: stored.sellerSig,
    status,
    announceTx: stored.announceTx,
    closeTx: stored.filled?.tx ?? stored.cancelled?.tx,
    buyer: stored.filled?.buyer,
    announcedAt: stored.announcedAt,
    closedAt: stored.filled?.at,
    report: stored.acknowledged ? { status: "acknowledged", ...stored.acknowledged } : stored.filled && { status: "pending" },
  };
}

/**
 * Records the fills in a transaction the sponsor just sent, from its receipt, so no screen waits on a log scan.
 * The receipt is the proof: a hash that holds no OrderFilled from this settlement records nothing.
 */
export async function recordSettledFills(tx: Hash): Promise<void> {
  const receipt = await publicClient.getTransactionReceipt({ hash: tx });
  const fills = parseEventLogs({ abi: handoffSettlementAbi, eventName: "OrderFilled", logs: receipt.logs }).filter((log) => isAddressEqual(log.address, core().settlement));
  await Promise.all(
    fills.map(async ({ args }) => {
      const stored = await store.getOrder(args.orderHash);
      if (!stored || stored.filled) return;
      const filled = { tx, buyer: args.buyer, at: Number(nowSeconds()) };
      await store.recordFill(stored.orderHash, filled);
      await reportFill({ ...stored, filled });
    }),
  );
}

export async function listOrders(): Promise<OrderView[]> {
  const orders = await Promise.all((await store.listOrders()).map(syncWithChain));
  return orders.map(view).reverse();
}

async function findOrder(orderHash: string): Promise<StoredOrder> {
  const stored = await store.getOrder(orderHash as Hash);
  if (!stored) throw new Refused("unknown_order", "That order is not in the book.", 404);
  return stored;
}

/** Records a cancel the seller already made on-chain. The chain is the proof, so nobody can void someone else's order. */
export async function markCancelled(orderHash: string): Promise<OrderView> {
  const stored = await syncWithChain(await findOrder(orderHash));
  if (!stored.cancelled) {
    throw new Refused("not_cancelled_on_chain", "The order is still open in the contract.", 409, { address: stored.order.seller, orderHash: stored.orderHash });
  }
  return view(stored);
}

/**
 * Returns the venue's co-signature for one buyer on one order. An unattested buyer is refused and logged.
 * `demoDirectAttempt` logs the same refusal and still returns the signature, so the demo shows the token hook
 * rejecting the fill on-chain. Without a signature the revert would be InvalidVenueSignature, not the hook's.
 */
export async function coSign(orderHash: string, body: { buyer?: unknown; demoDirectAttempt?: unknown }): Promise<{ venueSig: Hex }> {
  const found = await findOrder(orderHash);
  const buyer = parseAddress(body.buyer, "buyer");
  const context = { address: buyer, orderHash: found.orderHash };

  const stored = await syncWithChain(found);
  if (view(stored).status !== "open") throw new Refused("order_closed", "This order is no longer open.", 409, context);
  if (buyer === stored.order.seller) throw new Refused("self_trade", "You cannot buy your own order.", 422, context);
  await assertTradable(stored.order.token);

  const [attested, blocked] = await Promise.all([
    publicClient.readContract({ ...registry(), functionName: "isAttested", args: [stored.order.token, buyer] }),
    publicClient.readContract({ ...registry(), functionName: "isBlocked", args: [stored.order.token, buyer] }),
  ]);
  if (blocked) throw new Refused("buyer_blocked", "The PSAV blocked the buyer's account.", 403, context);
  if (!attested) {
    const refused = new Refused("buyer_not_attested", "The buyer's account is not verified.", 403, context);
    const demoAllowed = chainName === "local" || process.env.VENUE_DEMO_COSIGN === "1";
    if (body.demoDirectAttempt !== true || !demoAllowed) throw refused;
    await logRefusal("co-sign (demo: firma entregada para mostrar el rechazo en el contrato)", refused);
  }

  const digest = await publicClient.readContract({ ...settlement(), functionName: "hashVenueFill", args: [stored.orderHash, buyer] });
  // The order's own venue, whichever wallet the buyer came through: the contract checks this key and no other.
  return { venueSig: await orderKeyAccount(stored.order.venue).sign({ hash: digest }) };
}

function reversionView(r: StoredReversion): ReversionView {
  return {
    id: r.id,
    token: r.token,
    holder: r.holder,
    amount: r.amount.toString(),
    requestedAt: new Date(Number(r.requestedAt) * 1000).toISOString(),
    status: r.status,
    certificateRef: r.certificateRef,
    txHash: r.txHash,
  };
}

/** Everything a reversion request must be. The sponsor checks the same before it signs one. */
export async function assertRequestable(request: { token: Address; holder: Address; amount: bigint; requestedAt: bigint }) {
  const { token, holder, amount, requestedAt } = request;
  const context = { address: holder };
  if (amount === 0n) throw new Refused("zero_amount", "The amount must be greater than zero.", 422, context);
  const age = nowSeconds() - requestedAt;
  if (age > REVERSION_MAX_AGE_S || age < -REVERSION_MAX_AGE_S) throw new Refused("stale_request", "The request has expired. Sign it again.", 422, context);
  const balance = await publicClient.readContract({ address: token, abi: handoffTokenAbi, functionName: "balanceOf", args: [holder] });
  if (balance < amount) throw new Refused("insufficient_balance", "You do not have that many tokens.", 422, context);
}

/** Stores a holder's request for the console's PSAV to act on. Only the holder's signature can open one. */
export async function requestReversion(body: {
  token?: unknown;
  holder?: unknown;
  amount?: unknown;
  requestedAt?: unknown;
  signature?: unknown;
}): Promise<ReversionView> {
  const token = parseAddress(body.token, "token");
  const holder = parseAddress(body.holder, "holder");
  const amount = parseUint(body.amount, "amount");
  const requestedAt = parseUint(body.requestedAt, "requestedAt");
  const signature = parseSignature(body.signature);
  const context = { address: holder };

  await assertRequestable({ token, holder, amount, requestedAt });

  const id = reversionDigest({ chainId: BigInt(chain.id), token, holder, amount, requestedAt });
  await assertHolderSigned(holder, id, signature);

  // Exclusive so two requests with different timestamps, hence different ids, cannot both pass the pending check.
  return store.exclusive(`reversion:${token}:${holder}`, async () => {
    const open = (await store.listReversions()).some((r) => r.token === token && r.holder === holder && r.status === "pending");
    if (open) throw new Refused("already_pending", "You already have a pending request to go back to paper.", 409, context);

    const stored: StoredReversion = {
      id,
      token,
      holder,
      amount,
      requestedAt,
      scanFrom: await publicClient.getBlockNumber({ cacheTime: 0 }),
      status: "pending",
    };
    await store.putReversion(stored);
    return reversionView(stored);
  });
}

/** A request is done when the PSAV's revertToPaper shows up as a Reversion event; the console writes nothing here. */
async function syncReversion(r: StoredReversion): Promise<StoredReversion> {
  if (r.status === "done") return r;
  if (!(await store.claim(`lookup:${r.id}`, LOG_LOOKUP_GAP_MS))) return r;
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  const [event] = await firstInSpans(r.scanFrom, latest, async (fromBlock, toBlock) => {
    const events = await publicClient.getContractEvents({ ...registry(), eventName: "Reversion", args: { token: r.token, holder: r.holder }, fromBlock, toBlock });
    return events.filter((e) => e.args.amount === r.amount);
  });
  if (!event) {
    await store.advanceScan(r.id, latest + 1n); // A pending request costs one read per poll, however long the PSAV takes.
    return r;
  }
  const outcome = { certificateRef: event.args.certificateRef, txHash: event.transactionHash };
  await store.recordOutcome(r.id, outcome);
  return { ...r, ...outcome, status: "done" };
}

export async function listReversions(): Promise<ReversionView[]> {
  const reversions = await Promise.all((await store.listReversions()).map(syncReversion));
  return reversions.map(reversionView).reverse();
}
