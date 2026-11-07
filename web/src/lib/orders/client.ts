import type { Address, Hash, Hex } from "viem";
import type { OrderView, ReversionView, WireOrder } from "./types";

/** The venue declined. The message is written for the user. */
export class VenueRefusal extends Error {
  constructor(
    readonly code: string,
    reason: string,
  ) {
    super(reason);
  }
}

async function call<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/venue${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok) throw new VenueRefusal(json.error?.code ?? "unavailable", json.error?.reason ?? "The order service could not respond.");
  return json as T;
}

export const venue = {
  listOrders: () => call<{ orders: OrderView[] }>("/orders").then((r) => r.orders),
  postOrder: (order: WireOrder, sellerSig: Hex) => call<{ order: OrderView }>("/orders", { order, sellerSig }).then((r) => r.order),
  markCancelled: (orderHash: Hash) => call<{ order: OrderView }>(`/orders/${orderHash}/cancel`, {}).then((r) => r.order),
  coSign: (orderHash: Hash, buyer: Address, demoDirectAttempt = false) =>
    call<{ venueSig: Hex }>(`/orders/${orderHash}/cosign`, { buyer, demoDirectAttempt }).then((r) => r.venueSig),
  sponsor: <T = { hash: Hash; userOpHash?: Hash }>(request: object) => call<T>("/sponsor", request),
  listReversions: () => call<{ reversions: ReversionView[] }>("/reversions").then((r) => r.reversions),
  requestReversion: (request: { token: Address; holder: Address; amount: string; requestedAt: string; signature: Hex }) =>
    call<{ reversion: ReversionView }>("/reversions", request).then((r) => r.reversion),
};
