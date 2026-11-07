import { KumplyClient } from "@kumply/sdk";
import type { Address } from "viem";
import { chain } from "@/lib/chain";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0];
const clients = new Map<Address, KumplyClient>();

/**
 * The real SDK on both chains. It has no "local" network, but `network` only names the chain object:
 * reads go to `rpcUrl` and `contractAddress`, so on anvil the same client reads the stub store.
 */
export function kumply(store: Address): KumplyClient {
  let client = clients.get(store);
  if (!client) {
    client = new KumplyClient({ network: "fuji", rpcUrl, contractAddress: store });
    clients.set(store, client);
  }
  return client;
}

export type Category = "Persona" | "Empresa" | "Agente" | "Sin atestación";

function categoryOf(tier: number): Category {
  if (tier === 4) return "Empresa";
  if (tier === 5) return "Agente";
  return tier >= 1 && tier <= 3 ? "Persona" : "Sin atestación";
}

/** The first of a token's attesters that verifies the holder decides the category. */
export async function categoryIn(stores: readonly Address[], holder: Address): Promise<Category> {
  for (const store of stores) {
    const { verified, tier } = await kumply(store).verify(holder);
    if (verified) return categoryOf(tier);
  }
  return "Sin atestación";
}
