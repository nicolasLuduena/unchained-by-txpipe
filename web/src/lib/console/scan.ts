import "server-only";
import { erc20Abi, getAddress, type AbiEvent, type Address, type Hash } from "viem";
import { handoffRegistryAbi, handoffSettlementAbi } from "@/lib/abi";
import { deployment, publicClient } from "@/lib/chain";

/** Starting chunk. An RPC that allows less says so, and the scanner drops to its cap: Fuji's public RPC allows 100. */
const CHUNK_BLOCKS = 2048n;
/** Bounds one poll, so a long backfill shows progress instead of holding the screen. */
const MAX_CHUNKS_PER_POLL = 12;

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
const SCANNED_EVENTS = [...FEED_EVENTS, TRANSFER];

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
 * Reads logs from the deployment's start block in fixed chunks, one chunk at a time, with one read per chunk for
 * the contracts and every token: log reads are the scarce thing on the public RPC. No indexer.
 */
export class LogScanner {
  readonly feedLogs: ScannedLog[] = [];
  readonly transfers = new Map<Address, ScannedLog[]>();
  private cursor = startBlock();
  private sources = "";
  private readonly blockTimes = new Map<bigint, number>();
  private chunkBlocks = CHUNK_BLOCKS;

  private keep(log: ScannedLog) {
    if (log.eventName !== "Transfer") {
      this.feedLogs.push(log);
      return;
    }
    const token = getAddress(log.address); // The RPC returns it lowercase; the registry returns it checksummed.
    this.transfers.set(token, [...(this.transfers.get(token) ?? []), log]);
  }

  async poll(head: bigint, contracts: Address[], tokens: readonly Address[]) {
    const address = [...contracts, ...tokens];
    // A token registered later has logs behind the cursor, so a new source starts the scan over.
    if (address.join() !== this.sources) {
      this.sources = address.join();
      this.cursor = startBlock();
      this.feedLogs.length = 0;
      this.transfers.clear();
    }

    for (let chunk = 0; this.cursor <= head && chunk < MAX_CHUNKS_PER_POLL; chunk++) {
      const end = this.cursor + this.chunkBlocks - 1n;
      const toBlock = end < head ? end : head;
      let logs;
      try {
        logs = await publicClient.getLogs({ address, events: SCANNED_EVENTS, fromBlock: this.cursor, toBlock });
      } catch (error) {
        const cap = rangeCap(error);
        if (cap === null || cap >= this.chunkBlocks) throw error;
        this.chunkBlocks = cap;
        continue;
      }
      (logs as unknown as ScannedLog[]).forEach((log) => this.keep(log));
      this.cursor = toBlock + 1n;
    }

    const missing = [...new Set(this.feedLogs.map((log) => log.blockNumber))].filter((n) => !this.blockTimes.has(n));
    for (const blockNumber of missing) {
      const block = await publicClient.getBlock({ blockNumber });
      this.blockTimes.set(blockNumber, Number(block.timestamp));
    }
  }

  /** The last block the scan has reached, for the progress line. */
  scannedTo(): bigint {
    return this.cursor - 1n;
  }

  timeOf(blockNumber: bigint): number {
    return this.blockTimes.get(blockNumber) ?? 0;
  }

  times(): [bigint, number][] {
    return [...this.blockTimes];
  }
}
