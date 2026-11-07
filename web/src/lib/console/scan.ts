import { erc20Abi, getAbiItem, type AbiEvent, type Address, type Hash } from "viem";
import { handoffRegistryAbi, handoffSettlementAbi } from "@/lib/abi";
import { deployment, publicClient } from "@/lib/chain";

/** Fuji's public RPC caps getLogs ranges. */
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

const FEED_EVENTS: AbiEvent[] = [
  ...["PausedSet", "HolderBlocked", "Reversion"].map((name) => getAbiItem({ abi: handoffRegistryAbi, name }) as AbiEvent),
  ...["OrderAnnounced", "OrderCancelled", "OrderFilled"].map((name) => getAbiItem({ abi: handoffSettlementAbi, name }) as AbiEvent),
];
const TRANSFER = getAbiItem({ abi: erc20Abi, name: "Transfer" }) as AbiEvent;

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

  private async advance(source: string, address: Address | Address[], events: AbiEvent[], head: bigint, into: ScannedLog[]) {
    let from = this.cursors.get(source) ?? startBlock();
    for (let chunk = 0; from <= head && chunk < MAX_CHUNKS_PER_POLL; chunk++) {
      const to = from + CHUNK_BLOCKS - 1n < head ? from + CHUNK_BLOCKS - 1n : head;
      const logs = await publicClient.getLogs({ address, events, fromBlock: from, toBlock: to });
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
