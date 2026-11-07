import "server-only";
import { readFileSync } from "node:fs";
import { mnemonicToAccount, type HDAccount } from "viem/accounts";
import { deployment } from "@/lib/chain";
import type { Role } from "./roles";

const FIXED_INDEX: Partial<Record<Role, number>> = { emisor: 1, psav: 5 };
/** The unverified actor has no agreed index, so it is found by its address in deployments/fuji.json. */
const SEARCH_INDEXES = 20;

/** The mnemonic stays in this module: nothing here logs it or puts it in an error. */
function readMnemonic(): string | null {
  const path = process.env.MNEMONIC_PATH;
  if (!path) return null;
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

function derive(mnemonic: string, addressIndex: number): HDAccount | null {
  try {
    return mnemonicToAccount(mnemonic, { addressIndex });
  } catch {
    return null;
  }
}

export function fujiAccount(role: Role): HDAccount | null {
  const mnemonic = readMnemonic();
  if (!mnemonic) return null;
  const index = FIXED_INDEX[role];
  if (index !== undefined) return derive(mnemonic, index);
  const actors = deployment?.actors as Record<string, string> | undefined;
  const target = actors?.unverified?.toLowerCase();
  if (!target) return null;
  for (let i = 0; i < SEARCH_INDEXES; i++) {
    const account = derive(mnemonic, i);
    if (account?.address.toLowerCase() === target) return account;
  }
  return null;
}
