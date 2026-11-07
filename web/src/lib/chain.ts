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
export const chain: Chain = CHAINS[chainName];

/** Null until deployments/<chain>.json exists. Inlined by next.config.ts; restart dev after a redeploy. */
export const deployment: Deployment | null = JSON.parse(process.env.NEXT_PUBLIC_DEPLOYMENT ?? "null");

/** Measured on Fuji's public RPC: one eth_getLogs a second holds; two in a second trip the penalty below. */
const LOG_READ_GAP_MS = 1250;

// On globalThis so every route shares one budget: Next can load this module more than once on the server.
const logReads = globalThis as typeof globalThis & { __handoffNextLogRead?: number };

async function waitForLogSlot() {
  const now = Date.now();
  const slot = Math.max(now, logReads.__handoffNextLogRead ?? 0);
  logReads.__handoffNextLogRead = slot + LOG_READ_GAP_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

/**
 * Spaces eth_getLogs out. Going over the limit earns a 60 second 429 on every method from this IP, sends
 * included, so one burst of log reads would stop the whole demo. Nothing else needs pacing: eth_call holds at 8 a second.
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
