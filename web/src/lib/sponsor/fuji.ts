import { venue } from "@/lib/orders/client";
import type { Sponsor } from "./index";

/** The browser half. The SDK, the mnemonic and the paymaster key are all in fuji-server.ts, behind the route. */
export const fujiSponsor: Sponsor = {
  sendCalls: (actor, calls) => venue.sponsor({ action: "sendCalls", actor, calls: calls.map(({ to, data }) => ({ to, data })) }),
  signDigest: (actor, digest) => venue.sponsor<{ signature: `0x${string}` }>({ action: "signDigest", actor, digest }).then((r) => r.signature),
};
