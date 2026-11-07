import "server-only";
import { getAddress, hashMessage, type Address, type Hash, type Hex } from "viem";
import { handoffRegistryAbi, handoffSettlementAbi, handoffTokenAbi } from "@/lib/abi";
import { chain, chainName, publicClient } from "@/lib/chain";
import { registryReport } from "@/lib/registry-report";
import { bandLimits } from "@/lib/wallet/band";
import { coreContracts } from "@/lib/wallet/deployment";
import { revertAbi, revertReason } from "@/lib/wallet/revert-reason";
import { store, type StoredOrder, type StoredReversion } from "./store";
import { reversionDigest, toWireOrder, type Order, type OrderView, type Refusal, type ReversionView, type WireOrder } from "./types";
import { orderKeyAccount, orderKeyClient } from "./venue";

const RECEIPT_POLL_MS = 200;
const REVERSION_MAX_AGE_S = 600n;
const MAX_REFUSALS = 200;

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

export function logRefusal(route: string, refused: Refused) {
  store.refusals.unshift({
    id: (store.refusals[0]?.id ?? 0) + 1,
    at: new Date().toISOString(),
    route,
    code: refused.code,
    reason: refused.message,
    ...refused.context,
  });
  store.refusals.length = Math.min(store.refusals.length, MAX_REFUSALS);
}

export function listRefusals(): Refusal[] {
  return store.refusals;
}

function core() {
  const contracts = coreContracts();
  if (!contracts) throw new Refused("not_deployed", "Los contratos todavía no están desplegados.", 503);
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

function parseAddress(value: unknown, field: string): Address {
  try {
    return getAddress(String(value));
  } catch {
    throw new Refused("malformed", `La dirección de ${field} no es válida.`, 400);
  }
}

function parseUint(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Refused("malformed", `El campo ${field} no es un entero positivo.`, 400);
  }
  return BigInt(value);
}

function parseOrder(raw: Partial<WireOrder> | undefined): Order {
  if (!raw) throw new Refused("malformed", "Falta la orden.", 400);
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
    throw new Refused("malformed", "La firma no es válida.", 400);
  }
  return value as Hex;
}

async function assertTradable(token: Address) {
  const registered = await publicClient.readContract({ ...registry(), functionName: "isRegistered", args: [token] });
  if (!registered) throw new Refused("unknown_token", "Este token no está registrado.");
  const info = await publicClient.readContract({ ...registry(), functionName: "tokenInfo", args: [token] });
  if (info.paused) throw new Refused("paused", "La negociación de este token está pausada.");
  if (!info.tradingEnabled) throw new Refused("trading_disabled", "Este token no admite negociación.");
  return info;
}

async function assertInBand(token: Address, price: bigint, floor: bigint, seller: Address) {
  const context = { address: seller };
  const band = await publicClient.readContract({ ...registry(), functionName: "band", args: [token] });
  if (band.price === 0n) throw new Refused("band_not_set", "Este token todavía no tiene precio de referencia.", 422, context);
  if (band.maxAge !== 0n && nowSeconds() > band.timestamp + band.maxAge) {
    throw new Refused("price_stale", "El precio de referencia está vencido.", 422, context);
  }
  const { low, high } = bandLimits(band, floor);
  if (price < low || price > high) {
    throw new Refused("out_of_band", `El precio ${price} está fuera del rango permitido, de ${low} a ${high}.`, 422, context);
  }
}

/** Accepts the raw digest or its EIP-191 wrapping, the same two forms HandoffSettlement accepts from a seller. */
async function assertHolderSigned(address: Address, digest: Hash, signature: Hex) {
  // verifyHash covers EOAs and ERC-1271 smart accounts, so this survives the move to Fuji.
  const verify = (hash: Hash) => publicClient.verifyHash({ address, hash, signature }).catch(() => false);
  if ((await verify(digest)) || (await verify(hashMessage({ raw: digest })))) return;
  throw new Refused("invalid_holder_signature", "La firma no corresponde a esta cuenta.", 422, { address });
}

/**
 * Validates a signed order, announces it from the order key so it reaches the feed, and stores it.
 * The seller signature, venue and order key are judged by simulating announceOrder: the contract is the
 * one place that decides what a valid seller signature is.
 */
export async function postOrder(body: { order?: Partial<WireOrder>; sellerSig?: unknown }): Promise<OrderView> {
  const order = parseOrder(body.order);
  const sellerSig = parseSignature(body.sellerSig);
  const { seller } = order;
  const context = { address: seller };

  if (order.chainId !== BigInt(chain.id)) throw new Refused("wrong_chain", "La orden es de otra red.", 422, context);
  if (order.amount === 0n) throw new Refused("zero_amount", "La cantidad tiene que ser mayor a cero.", 422, context);
  if (order.expiry <= nowSeconds()) throw new Refused("expired", "La orden ya venció.", 422, context);

  const info = await assertTradable(order.token);
  await assertInBand(order.token, order.price, info.floor, seller);

  const [attested, blocked, balance] = await Promise.all([
    publicClient.readContract({ ...registry(), functionName: "isAttested", args: [order.token, seller] }),
    publicClient.readContract({ ...registry(), functionName: "isBlocked", args: [order.token, seller] }),
    publicClient.readContract({ address: order.token, abi: handoffTokenAbi, functionName: "balanceOf", args: [seller] }),
  ]);
  if (!attested) throw new Refused("seller_not_attested", "La cuenta vendedora no está verificada.", 403, context);
  if (blocked) throw new Refused("seller_blocked", "La cuenta vendedora está bloqueada por el PSAV.", 403, context);
  if (balance < order.amount) throw new Refused("insufficient_balance", "No tenés esa cantidad de tokens.", 422, context);

  const orderHash = await publicClient.readContract({ ...settlement(), functionName: "hashOrder", args: [order] });
  const hashed = { ...context, orderHash };
  if (store.orders.has(orderHash)) throw new Refused("duplicate", "Esta orden ya está publicada.", 409, hashed);

  const simulated = await publicClient
    .simulateContract({ ...settlement(), abi: revertAbi, functionName: "announceOrder", args: [order, sellerSig], account: orderKeyAccount() })
    .catch((error: unknown) => {
      const reason = revertReason(error);
      if (reason.startsWith("InvalidSellerSignature")) {
        throw new Refused("invalid_seller_signature", "La firma no corresponde a la cuenta vendedora.", 422, hashed);
      }
      throw new Refused("announce_reverted", `La cadena rechazó la orden: ${reason}`, 422, hashed);
    });
  const announceTx = await orderKeyClient().writeContract(simulated.request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: announceTx, pollingInterval: RECEIPT_POLL_MS });

  const stored: StoredOrder = { orderHash, order, sellerSig, announceTx, announceBlock: receipt.blockNumber };
  store.orders.set(orderHash, stored);
  return view(stored);
}

function reportFill(stored: StoredOrder) {
  if (stored.report || !stored.filled) return;
  stored.report = { status: "pending" };
  const { order, orderHash, filled } = stored;
  registryReport
    .report({ orderHash, txHash: filled.tx, token: order.token, seller: order.seller, buyer: filled.buyer, amount: order.amount, price: order.price })
    .then((ack) => {
      stored.report = { status: "acknowledged", ...ack };
    })
    .catch(() => {
      stored.report = undefined; // The next read retries.
    });
}

/** The chain decides whether an order is still open; the store only remembers what it has seen. */
async function syncWithChain(stored: StoredOrder) {
  if (stored.filled || stored.cancelled) return reportFill(stored);
  const { seller, nonce } = stored.order;
  const [filled, cancelled] = await Promise.all([
    publicClient.readContract({ ...settlement(), functionName: "filled", args: [seller, nonce] }),
    publicClient.readContract({ ...settlement(), functionName: "cancelled", args: [seller, nonce] }),
  ]);
  if (filled) {
    const [event] = await publicClient.getContractEvents({
      ...settlement(),
      eventName: "OrderFilled",
      args: { orderHash: stored.orderHash },
      fromBlock: stored.announceBlock,
    });
    if (event?.args.buyer) stored.filled = { tx: event.transactionHash, buyer: event.args.buyer };
    reportFill(stored);
  } else if (cancelled) {
    const [event] = await publicClient.getContractEvents({
      ...settlement(),
      eventName: "OrderCancelled",
      args: { seller, nonce },
      fromBlock: stored.announceBlock,
    });
    stored.cancelled = { tx: event?.transactionHash };
  }
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
    report: stored.report,
  };
}

export async function listOrders(): Promise<OrderView[]> {
  const orders = [...store.orders.values()];
  await Promise.all(orders.map(syncWithChain));
  return orders.map(view).reverse();
}

function findOrder(orderHash: string): StoredOrder {
  const stored = store.orders.get(orderHash as Hash);
  if (!stored) throw new Refused("unknown_order", "Esa orden no está en el libro.", 404);
  return stored;
}

/** Records a cancel the seller already made on-chain. The chain is the proof, so nobody can void someone else's order. */
export async function markCancelled(orderHash: string): Promise<OrderView> {
  const stored = findOrder(orderHash);
  await syncWithChain(stored);
  if (!stored.cancelled) {
    throw new Refused("not_cancelled_on_chain", "La orden sigue vigente en la cadena.", 409, { address: stored.order.seller, orderHash: stored.orderHash });
  }
  return view(stored);
}

/**
 * Returns the venue's co-signature for one buyer on one order. An unattested buyer is refused and logged.
 * `demoDirectAttempt` logs the same refusal and still returns the signature, so the demo shows the token hook
 * rejecting the fill on-chain. Without a signature the revert would be InvalidVenueSignature, not the hook's.
 */
export async function coSign(orderHash: string, body: { buyer?: unknown; demoDirectAttempt?: unknown }): Promise<{ venueSig: Hex }> {
  const stored = findOrder(orderHash);
  const buyer = parseAddress(body.buyer, "buyer");
  const context = { address: buyer, orderHash: stored.orderHash };

  await syncWithChain(stored);
  if (view(stored).status !== "open") throw new Refused("order_closed", "Esta orden ya no está vigente.", 409, context);
  if (buyer === stored.order.seller) throw new Refused("self_trade", "No podés comprar tu propia orden.", 422, context);
  await assertTradable(stored.order.token);

  const attested = await publicClient.readContract({ ...registry(), functionName: "isAttested", args: [stored.order.token, buyer] });
  if (!attested) {
    const refused = new Refused("buyer_not_attested", "La cuenta compradora no está verificada.", 403, context);
    const demoAllowed = chainName === "local" || process.env.VENUE_DEMO_COSIGN === "1";
    if (body.demoDirectAttempt !== true || !demoAllowed) throw refused;
    logRefusal("co-sign (demo: firma entregada para mostrar el rechazo en la cadena)", refused);
  }

  const digest = await publicClient.readContract({ ...settlement(), functionName: "hashVenueFill", args: [stored.orderHash, buyer] });
  return { venueSig: await orderKeyAccount().sign({ hash: digest }) };
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

  if (amount === 0n) throw new Refused("zero_amount", "La cantidad tiene que ser mayor a cero.", 422, context);
  const age = nowSeconds() - requestedAt;
  if (age > REVERSION_MAX_AGE_S || age < -REVERSION_MAX_AGE_S) throw new Refused("stale_request", "El pedido venció. Volvé a firmarlo.", 422, context);

  const id = reversionDigest({ chainId: BigInt(chain.id), token, holder, amount, requestedAt });
  await assertHolderSigned(holder, id, signature);

  const open = [...store.reversions.values()].some((r) => r.token === token && r.holder === holder && r.status === "pending");
  if (open) throw new Refused("already_pending", "Ya tenés un pedido de reversión pendiente.", 409, context);

  const balance = await publicClient.readContract({ address: token, abi: handoffTokenAbi, functionName: "balanceOf", args: [holder] });
  if (balance < amount) throw new Refused("insufficient_balance", "No tenés esa cantidad de tokens.", 422, context);

  const stored: StoredReversion = {
    id,
    token,
    holder,
    amount,
    requestedAt,
    requestBlock: await publicClient.getBlockNumber(),
    status: "pending",
  };
  store.reversions.set(id, stored);
  return reversionView(stored);
}

/** A request is done when the PSAV's revertToPaper shows up as a Reversion event; the console writes nothing here. */
async function syncReversion(r: StoredReversion) {
  if (r.status === "done") return;
  const events = await publicClient.getContractEvents({
    ...registry(),
    eventName: "Reversion",
    args: { token: r.token, holder: r.holder },
    fromBlock: r.requestBlock,
  });
  const event = events.find((e) => e.args.amount === r.amount);
  if (!event) return;
  r.status = "done";
  r.certificateRef = event.args.certificateRef;
  r.txHash = event.transactionHash;
}

export async function listReversions(): Promise<ReversionView[]> {
  const reversions = [...store.reversions.values()];
  await Promise.all(reversions.map(syncReversion));
  return reversions.map(reversionView).reverse();
}
