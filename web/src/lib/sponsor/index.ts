import type { Address, Hash, Hex } from "viem";
import { chainName } from "@/lib/chain";

/** The demo actors a browser can act as. */
export type Actor = "seller" | "buyer" | "unverified";

export type Call = { to: Address; data: Hex; value?: bigint };

/** How a user acts without paying gas. Screens depend on this and nothing below it. */
export interface Sponsor {
  /** Runs the calls in order on the actor's behalf, gas-free. Rejects if any of them fails. */
  sendCalls(actor: Actor, calls: Call[]): Promise<{ hash: Hash; userOpHash?: Hash }>;
  /** Signs a 32-byte digest as the actor, for order and request signatures. */
  signDigest(actor: Actor, digest: Hash): Promise<Hex>;
}

/** Says what the sponsorship is: a mock must say it is a mock. */
export const SPONSOR_LABEL = chainName === "local" ? "Sin gas: patrocinio simulado en la red local." : "Sin gas: el patrocinio cubre la operación.";

/** Loaded on demand so a Fuji page never fetches the local fake or its dev keys. */
export async function getSponsor(): Promise<Sponsor> {
  if (chainName === "local") return (await import("./local")).localSponsor;
  return (await import("./fuji")).fujiSponsor;
}
