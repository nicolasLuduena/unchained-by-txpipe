import type { Hex } from "viem";
import { venue } from "@/lib/orders/client";
import { toWireOrder } from "@/lib/orders/types";
import type { Sponsor } from "./index";

const signature = (request: object) => venue.sponsor<{ signature: Hex }>(request).then((r) => r.signature);

/** The browser half. The SDK, the mnemonic and the paymaster key are all in fuji-server.ts, behind the route. */
export const fujiSponsor: Sponsor = {
  sendCalls: (actor, calls) => venue.sponsor({ action: "sendCalls", actor, calls: calls.map(({ to, data }) => ({ to, data })) }),
  signOrder: (actor, order) => signature({ action: "signOrder", actor, order: toWireOrder(order) }),
  signReversion: (actor, { token, amount, requestedAt }) =>
    signature({ action: "signReversion", actor, token, amount: amount.toString(), requestedAt: requestedAt.toString() }),
};
