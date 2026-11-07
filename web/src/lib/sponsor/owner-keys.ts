import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain } from "@/lib/chain";
import type { Actor } from "./index";

const storageKey = (actor: Actor) => `handoff.ownerKey.${actor}`;
const KEY_FORMAT = /^0x[0-9a-fA-F]{64}$/;

/**
 * Fuji owner keys for the demo actors. The operator enters them at the start of a session: they live in
 * sessionStorage only, and never in the repo, a NEXT_PUBLIC variable or the bundle. In production the
 * host wallet holds this key and these two functions disappear.
 */
export function readOwnerKey(actor: Actor): Hex | null {
  try {
    const key = sessionStorage.getItem(storageKey(actor));
    return key && KEY_FORMAT.test(key) ? (key as Hex) : null;
  } catch {
    return null;
  }
}

export function saveOwnerKey(actor: Actor, key: string): boolean {
  if (!KEY_FORMAT.test(key)) return false;
  try {
    sessionStorage.setItem(storageKey(actor), key);
    return true;
  } catch {
    return false;
  }
}

export function ownerWallet(actor: Actor) {
  const key = readOwnerKey(actor);
  if (!key) throw new Error("Falta la clave del dueño de esta cuenta para la demo.");
  return createWalletClient({ account: privateKeyToAccount(key), chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
}
