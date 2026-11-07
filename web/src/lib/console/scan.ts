import { erc20Abi, type AbiEvent, type Address, type Hash } from "viem";
import { handoffRegistryAbi, handoffSettlementAbi } from "@/lib/abi";
import { deployment, publicClient } from "@/lib/chain";

/** Starting chunk. An RPC that allows less says so, and the scanner drops to its cap: Fuji's public RPC allows 100. */
const CHUNK_BLOCKS = 2048n;
/** Bounds one poll, so a long backfill shows progress instead of holding the screen. */
const MAX_CHUNKS_PER_POLL = 25;

export type ScannedLog = {
  eventName: string;
  args: Record<string, unknown>;
  address: Address;
  transactionHash: Hash;
  blockNumber: bigint;
  logIndex: number;
};

const FEED_EVENT_NAMES = ["PausedSet", "HolderBlocked", "Reversion", "OrderAnnounced", "OrderCancelled", "OrderFilled"];
const FEED_EVENTS = [...handoffRegistryAbi, ...handoffSettlementAbi].filter(
  (item) => item.type === "event" && FEED_EVENT_NAMES.includes(item.name),
) as unknown as AbiEvent[];
const TRANSFER = erc20Abi.find((item) => item.type === "event" && item.name === "Transfer") as AbiEvent;

/** The cap named in a "block range too large" refusal, or null for any other failure. */
function rangeCap(error: unknown): bigint | null {
  const match = /maximum of (\d+) blocks/.exec(String((error as Error)?.message));
  return match ? BigInt(match[1]) : null;
}

function startBlock(): bigint {
  const start = deployment?.startBlock;
  return typeof start === "number" || typeof start === "string" ? BigInt(start) : 0n;
}

/**
 * Reads logs from the deployment's start block in fixed chunks, keeping one cursor per source.
 * Each token has its own cursor, so a token registered later backfills from the start. No indexer.
 */
export class LogScanner {
  readonly feedLogs: ScannedLog[] = [];
  readonly transfers = new Map<Address, ScannedLog[]>();
  private readonly cursors = new Map<string, bigint>();
  private readonly blockTimes = new Map<bigint, number>();
  private chunkBlocks = CHUNK_BLOCKS;

  private async advance(source: string, address: Address | Address[], events: AbiEvent[], head: bigint, into: ScannedLog[]) {
    let from = this.cursors.get(source) ?? startBlock();
    for (let chunk = 0; from <= head && chunk < MAX_CHUNKS_PER_POLL; chunk++) {
      const to = from + this.chunkBlocks - 1n < head ? from + this.chunkBlocks - 1n : head;
      let logs;
      try {
        logs = await publicClient.getLogs({ address, events, fromBlock: from, toBlock: to });
      } catch (error) {
        const cap = rangeCap(error);
        if (cap === null || cap >= this.chunkBlocks) throw error;
        this.chunkBlocks = cap;
        continue;
      }
      into.push(...(logs as unknown as ScannedLog[]));
      from = to + 1n;
      this.cursors.set(source, from);
    }
  }

  async poll(head: bigint, contracts: Address[], tokens: readonly Address[]) {
    await this.advance("feed", contracts, FEED_EVENTS, head, this.feedLogs);
    for (const token of tokens) {
      if (!this.transfers.has(token)) this.transfers.set(token, []);
      await this.advance(token, token, [TRANSFER], head, this.transfers.get(token)!);
    }
    const missing = [...new Set(this.feedLogs.map((log) => log.blockNumber))].filter((n) => !this.blockTimes.has(n));
    await Promise.all(
      missing.map(async (blockNumber) => {
        const block = await publicClient.getBlock({ blockNumber });
        this.blockTimes.set(blockNumber, Number(block.timestamp));
      }),
    );
  }

  /** The lowest block every source has reached, for the progress line. */
  scannedTo(): bigint {
    const cursors = [...this.cursors.values()];
    return cursors.length ? cursors.reduce((low, c) => (c < low ? c : low)) - 1n : startBlock();
  }

  timeOf(blockNumber: bigint): number {
    return this.blockTimes.get(blockNumber) ?? 0;
  }
}
