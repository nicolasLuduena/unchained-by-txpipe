import { createPublicClient, http, type Address, type Chain, type Hash } from "viem";
import { avalancheFuji, foundry } from "viem/chains";

const CHAINS = { local: foundry, fuji: avalancheFuji } satisfies Record<string, Chain>;

export type ChainName = keyof typeof CHAINS;

/** Contents of deployments/<chain>.json. Addresses are keyed by contract name. */
export type Deployment = {
  chainId?: number;
  contracts?: Record<string, Address>;
  [key: string]: unknown;
};

function readChainName(): ChainName {
  const name = process.env.NEXT_PUBLIC_CHAIN ?? "local";
  if (name in CHAINS) return name as ChainName;
  throw new Error(`NEXT_PUBLIC_CHAIN must be local or fuji, got "${name}"`);
}

export const chainName = readChainName();
export const chain: Chain = CHAINS[chainName];

/** Null until deployments/<chain>.json exists. Inlined by next.config.ts; restart dev after a redeploy. */
export const deployment: Deployment | null = JSON.parse(process.env.NEXT_PUBLIC_DEPLOYMENT ?? "null");

export const publicClient = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

/** Explorer link for a transaction or address. Undefined on the local chain, which has no explorer. */
export function explorerUrl(kind: "tx" | "address", value: Hash | Address): string | undefined {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/${kind}/${value}` : undefined;
}
