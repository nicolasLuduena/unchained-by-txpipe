import { createPublicClient, http, type Address, type Chain, type Hash, type Transport } from "viem";
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

/** How the UI names the network to people. */
export const networkLabel = chainName === "local" ? "la red local" : "Fuji";
export const chain: Chain = CHAINS[chainName];

/** Null until deployments/<chain>.json exists. Inlined by next.config.ts; restart dev after a redeploy. */
export const deployment: Deployment | null = JSON.parse(process.env.NEXT_PUBLIC_DEPLOYMENT ?? "null");

/**
 * Measured on Fuji's public RPC: about 12 eth_getLogs in any minute trips the penalty below, however they are spaced
 * (9 reads at a 1.25s gap, 10 at 2.5s, 12 at 4s). This gap stays under it with room for a second reader.
 */
const LOG_READ_GAP_MS = chainName === "local" ? 0 : 7000;

// On globalThis so every route shares one budget: Next can load this module more than once on the server.
const logReads = globalThis as typeof globalThis & { __handoffNextLogRead?: number };

/** How long a log read asked for now would wait. A caller that can walk away checks this first, and spends no quota. */
export function logSlotWaitMs(): number {
  return Math.max(0, (logReads.__handoffNextLogRead ?? 0) - Date.now());
}

async function waitForLogSlot() {
  const now = Date.now();
  const slot = Math.max(now, logReads.__handoffNextLogRead ?? 0);
  logReads.__handoffNextLogRead = slot + LOG_READ_GAP_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

/**
 * Spaces eth_getLogs out. Going over the limit earns a 60 second 429 on every method from this IP, sends
 * included, so a backfill could stop the whole demo. Nothing else needs pacing: eth_call holds at 8 a second.
 * On serverless this budget is per instance, and instances that share an IP share the RPC's quota.
 */
function pacedLogs(inner: Transport): Transport {
  return (args) => {
    const transport = inner(args);
    const request: typeof transport.request = async (call, options) => {
      if (call.method === "eth_getLogs") await waitForLogSlot();
      return transport.request(call, options);
    };
    return { ...transport, request };
  };
}

const rpc = http(process.env.NEXT_PUBLIC_RPC_URL, { retryCount: 6 });

/** On Fuji, reads made together go out as one multicall. A 429 that gets through waits out its Retry-After in viem. */
export const publicClient = createPublicClient({
  chain,
  transport: chainName === "fuji" ? pacedLogs(rpc) : rpc,
  batch: chainName === "fuji" ? { multicall: { wait: 50 } } : undefined,
});

/** Explorer link for a transaction or address. Undefined on the local chain, which has no explorer. */
export function explorerUrl(kind: "tx" | "address", value: Hash | Address): string | undefined {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/${kind}/${value}` : undefined;
}
