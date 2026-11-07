/**
 * Fuji's public RPC refuses eth_getLogs over more than 100 blocks, so every log read goes through this span.
 * Callers must read the upper bound with getBlockNumber({ cacheTime: 0 }): viem caches it for 4 seconds, and a
 * stale bound right after a write misses the event that write just emitted.
 */
export const MAX_LOG_SPAN = 100n;

/** Walks [from, to] in spans the RPC accepts and stops at the first span that finds something. */
export async function firstInSpans<T>(from: bigint, to: bigint, read: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>): Promise<T[]> {
  for (let start = from; start <= to; start += MAX_LOG_SPAN) {
    const end = start + MAX_LOG_SPAN - 1n;
    const found = await read(start, end < to ? end : to);
    if (found.length > 0) return found;
  }
  return [];
}
