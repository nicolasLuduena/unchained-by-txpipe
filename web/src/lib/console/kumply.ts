import { KumplyClient } from "@kumply/sdk";
import type { Address } from "viem";
import { chain, deployment } from "@/lib/chain";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0];
const clients = new Map<Address, KumplyClient>();

/**
 * The real SDK on both chains, always against the deployment's store, never DEPLOYMENTS.fuji: on anvil that is
 * the stub, on Fuji the team's demo instance of KUMPLY's contract, which is not KUMPLY's official store.
 * The SDK has no "local" network; `network` only names the chain object, and reads go to `rpcUrl`.
 */
function sdk(store: Address): KumplyClient {
  let client = clients.get(store);
  if (!client) {
    client = new KumplyClient({ network: "fuji", rpcUrl, contractAddress: store });
    clients.set(store, client);
  }
  return client;
}

/** The business read behind every issuer action. null when the store cannot be read. */
export async function isBusiness(address: Address): Promise<boolean | null> {
  const store = deployment?.contracts?.AttestationStore;
  if (!store) return null;
  return sdk(store).isBusiness(address).catch(() => null);
}

export type Category = "Person" | "Business" | "Agent" | "No attestation";

function categoryOf(tier: number): Category {
  if (tier === 4) return "Business";
  if (tier === 5) return "Agent";
  return tier >= 1 && tier <= 3 ? "Person" : "No attestation";
}

/** A token names its own attesters, so the first of them that verifies the holder decides the category. */
export async function categoryIn(stores: readonly Address[], holder: Address): Promise<Category> {
  for (const store of stores) {
    const { verified, tier } = await sdk(store).verify(holder);
    if (verified) return categoryOf(tier);
  }
  return "No attestation";
}
