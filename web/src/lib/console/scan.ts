import "server-only";
import { erc20Abi, getAddress, type AbiEvent, type Address, type Hash } from "viem";
import { handoffRegistryAbi, handoffSettlementAbi } from "@/lib/abi";
import { chainName, deployment, logSlotWaitMs, publicClient } from "@/lib/chain";
import { MAX_LOG_SPAN } from "@/lib/wallet/logs";

/** Starting chunk. An RPC that allows less says so, and the scanner drops to its cap. Fuji's cap is known, and a refused read still costs quota. */
const CHUNK_BLOCKS = chainName === "local" ? 2048n : MAX_LOG_SPAN;
/**
 * Bounds one poll in time, so a backfill shows progress and fits a serverless function. Time and not a chunk count:
 * a 429 carries a Retry-After of up to 60 seconds, and viem would sit out all of it inside a single read.
 * Longer than the gap between log reads, so every poll gets at least one.
 */
const SCAN_BUDGET_MS = 8000;

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

/** A scanner's whole progress, so another instance can pick it up instead of starting over. */
export type ScanSnapshot = {
  cursor: bigint;
  sources: string;
  chunkBlocks: bigint;
  feedLogs: ScannedLog[];
  transfers: [Address, ScannedLog[]][];
  times: [bigint, number][];
};

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
 *
 * What it holds is always an unbroken prefix of the chain, up to scannedTo(). A poll that runs out of time or gets
 * throttled just stops there, and the next one carries on. On serverless, lib/console/shared.ts hands this progress
 * between instances, so a cold one resumes from the shared cursor.
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
    // Tokens append, and a new one has no logs behind the cursor. Anything else starts the scan over.
    if (!address.join().startsWith(this.sources)) {
      this.cursor = startBlock();
      this.feedLogs.length = 0;
      this.transfers.clear();
    }
    this.sources = address.join();

    const deadline = Date.now() + SCAN_BUDGET_MS;
    let timer: NodeJS.Timeout | undefined;
    const expiry = new Promise<null>((resolve) => {
      timer = setTimeout(resolve, SCAN_BUDGET_MS, null);
    });
    try {
      await this.readLogs(address, head, expiry, deadline);
      await this.readTimes(expiry, deadline);
    } catch (error) {
      console.error("scan stopped early", error instanceof Error ? error.message.slice(0, 200) : error);
    } finally {
      clearTimeout(timer);
    }
  }

  private async readLogs(address: Address[], head: bigint, expiry: Promise<null>, deadline: number) {
    // Stops rather than queues when no slot fits the budget: a read it abandoned would still spend quota, and the
    // order service's lookups, which a screen is waiting on, get the slot instead.
    while (this.cursor <= head && Date.now() + logSlotWaitMs() < deadline) {
      const end = this.cursor + this.chunkBlocks - 1n;
      const toBlock = end < head ? end : head;
      let logs;
      try {
        logs = await Promise.race([publicClient.getLogs({ address, events: SCANNED_EVENTS, fromBlock: this.cursor, toBlock }), expiry]);
      } catch (error) {
        const cap = rangeCap(error);
        if (cap === null || cap >= this.chunkBlocks) throw error;
        this.chunkBlocks = cap;
        continue;
      }
      if (logs === null) return; // The read lost the race, so the cursor stays and the next poll repeats it.
      (logs as unknown as ScannedLog[]).forEach((log) => this.keep(log));
      this.cursor = toBlock + 1n;
    }
  }

  private async readTimes(expiry: Promise<null>, deadline: number) {
    const missing = [...new Set(this.feedLogs.map((log) => log.blockNumber))].filter((n) => !this.blockTimes.has(n));
    for (const blockNumber of missing) {
      if (Date.now() >= deadline) return;
      const block = await Promise.race([publicClient.getBlock({ blockNumber }), expiry]);
      if (block) this.blockTimes.set(blockNumber, Number(block.timestamp));
    }
  }

  snapshot(): ScanSnapshot {
    return { cursor: this.cursor, sources: this.sources, chunkBlocks: this.chunkBlocks, feedLogs: [...this.feedLogs], transfers: [...this.transfers], times: this.times() };
  }

  restore(snapshot: ScanSnapshot) {
    this.cursor = snapshot.cursor;
    this.sources = snapshot.sources;
    this.chunkBlocks = snapshot.chunkBlocks;
    this.feedLogs.splice(0, this.feedLogs.length, ...snapshot.feedLogs);
    this.transfers.clear();
    snapshot.transfers.forEach(([token, logs]) => this.transfers.set(token, logs));
    snapshot.times.forEach(([block, time]) => this.blockTimes.set(block, time));
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
