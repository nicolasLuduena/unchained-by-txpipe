import type { Address, Hash, Hex } from "viem";
import { chainName } from "@/lib/chain";
import type { Order, ReversionRequest } from "@/lib/orders/types";

/** The demo actors whose keys the team holds. */
export type DemoActor = "seller" | "buyer" | "unverified";

/** Who a browser can act as. "metamask" is the visitor's own wallet: its key never leaves the browser. */
export type Actor = DemoActor | "metamask";

export type Call = { to: Address; data: Hex; value?: bigint };

/** How a user acts without paying gas. Screens depend on this and nothing below it. */
export interface Sponsor {
  /** Runs the calls in order on the actor's behalf, gas-free. Rejects if any of them fails. */
  sendCalls(actor: Actor, calls: Call[]): Promise<{ hash: Hash; userOpHash?: Hash }>;
  /** Signs a sell order as the actor. The signer works out the digest itself: it never signs one it is handed. */
  signOrder(actor: Actor, order: Order): Promise<Hex>;
  /** Signs a request to go back to paper as the actor, with the same rule. */
  signReversion(actor: Actor, request: ReversionRequest): Promise<Hex>;
}

/** Says what the sponsorship is: a mock must say it is a mock. */
export const SPONSOR_LABEL = chainName === "local" ? "Sin gas: patrocinio simulado en la red local." : "Sin gas: el patrocinio cubre la operación.";

/** Loaded on demand so a Fuji page never fetches the local fake or its dev keys. */
export async function getSponsor(actor?: Actor): Promise<Sponsor> {
  if (actor === "metamask") return (await import("./metamask")).metamaskSponsor;
  if (chainName === "local") return (await import("./local")).localSponsor;
  return (await import("./fuji")).fujiSponsor;
}
