import "server-only";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, chainName } from "@/lib/chain";
import { venueIndex } from "./venues";

/** Anvil default accounts 6 and 8. Public by construction; only ever used on the local chain. */
const LOCAL_ORDER_KEYS: Hex[] = [
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
];
const ORDER_KEY_ENV = ["VENUE_ORDER_KEY", "VENUE_ORDER_KEY_2"] as const;

function orderKey(venue: Address): Hex {
  const index = venueIndex(venue);
  if (index < 0) throw new Error(`no order key for venue ${venue}`);
  const key = process.env[ORDER_KEY_ENV[index]] ?? (chainName === "local" ? LOCAL_ORDER_KEYS[index] : undefined);
  if (!key) throw new Error(`${ORDER_KEY_ENV[index]} is required outside the local chain`);
  return key as Hex;
}

/** One venue's order-service signer. Server only: these keys never reach the browser. */
export function orderKeyAccount(venue: Address) {
  return privateKeyToAccount(orderKey(venue));
}

export function orderKeyClient(venue: Address) {
  return createWalletClient({ account: orderKeyAccount(venue), chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
}
