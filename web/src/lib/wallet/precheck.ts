import { KumplyClient, TIER } from "@kumply/sdk";
import type { Address } from "viem";
import { chain } from "@/lib/chain";

/**
 * The real SDK on both chains: it has no chain-id check, so rpcUrl and contractAddress point it anywhere.
 * contractAddress is always the deployment's store, never DEPLOYMENTS.fuji. That store is the team's demo
 * attester on Fuji and a stub on local, read through the same surface. It is not KUMPLY's store.
 */
export function passesPrecheck(attestationStore: Address, account: Address): Promise<boolean> {
  const client = new KumplyClient({
    network: "fuji",
    contractAddress: attestationStore,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0],
  });
  return client.isPersonAtLeast(account, TIER.STANDARD);
}
