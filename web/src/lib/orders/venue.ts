import "server-only";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, chainName } from "@/lib/chain";

/** Anvil default account 6. Public by construction; only ever used on the local chain. */
const LOCAL_ORDER_KEY: Hex = "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e";

function orderKey(): Hex {
  const key = process.env.VENUE_ORDER_KEY ?? (chainName === "local" ? LOCAL_ORDER_KEY : undefined);
  if (!key) throw new Error("VENUE_ORDER_KEY is required outside the local chain");
  return key as Hex;
}

/** The venue's order-service signer. Server only: this key never reaches the browser. */
export function orderKeyAccount() {
  return privateKeyToAccount(orderKey());
}

export function orderKeyClient() {
  return createWalletClient({ account: orderKeyAccount(), chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
}
