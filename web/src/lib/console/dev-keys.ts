import "server-only";
import { mnemonicToAccount, type HDAccount } from "viem/accounts";
import { chainName } from "@/lib/chain";
import type { Role } from "./roles";

// Dev only: anvil's public default mnemonic, the same accounts contracts/script/DeployLocal.s.sol uses.
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
const ANVIL_INDEX: Record<Role, number> = { emisor: 3, psav: 5, "sin-atestacion": 4 };

export function anvilAccount(role: Role): HDAccount {
  if (chainName !== "local") throw new Error("anvil keys are only for the local chain");
  return mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: ANVIL_INDEX[role] });
}
