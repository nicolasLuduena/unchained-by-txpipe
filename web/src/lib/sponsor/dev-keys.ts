import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain } from "@/lib/chain";
import type { Actor } from "./index";

/**
 * Dev only. Anvil default accounts 1, 2 and 4, public by construction. The order key is deliberately
 * not here: it stays on the server, in lib/orders/venue.ts.
 */
const DEV_KEYS: Record<Actor, Hex> = {
  seller: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  buyer: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  unverified: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
};

export function devAccount(actor: Actor) {
  return privateKeyToAccount(DEV_KEYS[actor]);
}

export function devWallet(actor: Actor) {
  return createWalletClient({ account: devAccount(actor), chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
}
