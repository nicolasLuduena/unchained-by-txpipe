import { isAddressEqual, parseEventLogs, type Address, type Hash, type Log } from "viem";
import type { StampStatus } from "@/design";
import { handoffRegistryAbi, handoffSettlementAbi } from "@/lib/abi";
import { publicClient } from "@/lib/chain";
import { deployedAtBlock, type WalletConfig } from "./deployment";
import { formatUsdc, tokensLabel } from "./format";
import { MAX_LOG_SPAN } from "./logs";

/** How far back the first read reaches. About an hour on Fuji; the whole chain on a fresh local one. */
const LOOKBACK_BLOCKS = 2000n;

const eventsAbi = [...handoffSettlementAbi, ...handoffRegistryAbi];

export type HistoryEntry = {
  id: string;
  time: string;
  event: string;
  status: StampStatus;
  detail: string;
  from: Address;
  to?: Address;
  price: string;
  currency?: string;
  hash: Hash;
};

// One tail for the page, shared by every actor: after the first scan a poll costs a single eth_getLogs.
const tail: { next: bigint | null; logs: Log[]; running: Promise<void> | null } = { next: null, logs: [], running: null };
const blockTimes = new Map<bigint, bigint>();

async function advanceTail(config: WalletConfig) {
  const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
  const lookback = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;
  let fromBlock: bigint = tail.next ?? (lookback > deployedAtBlock ? lookback : deployedAtBlock);
  while (fromBlock <= latest) {
    const end: bigint = fromBlock + MAX_LOG_SPAN - 1n;
    const toBlock = end < latest ? end : latest;
    tail.logs.push(...(await publicClient.getLogs({ address: [config.settlement, config.registry], fromBlock, toBlock })));
    fromBlock = toBlock + 1n;
    tail.next = fromBlock;
  }
}

async function blockTime(blockNumber: bigint) {
  let time = blockTimes.get(blockNumber);
  if (time === undefined) {
    time = (await publicClient.getBlock({ blockNumber })).timestamp;
    blockTimes.set(blockNumber, time);
  }
  return time;
}

/** Everything this account did on the token, from chain events over RPC. There is no indexer. */
export async function readHistory(config: WalletConfig, account: Address): Promise<HistoryEntry[]> {
  tail.running ??= advanceTail(config).finally(() => {
    tail.running = null;
  });
  await tail.running;

  const mine = (address: Address) => isAddressEqual(address, account);
  const ofToken = (token: Address) => isAddressEqual(token, config.token);
  const announced = new Map<bigint, { amount: bigint; price: bigint }>();
  const entries: (Omit<HistoryEntry, "time"> & { blockNumber: bigint })[] = [];

  for (const e of parseEventLogs({ abi: eventsAbi, logs: tail.logs })) {
    const located = { id: `${e.transactionHash}-${e.logIndex}`, hash: e.transactionHash, blockNumber: e.blockNumber };

    if (e.eventName === "OrderAnnounced" && ofToken(e.args.token) && mine(e.args.seller)) {
      const { seller, amount, price, nonce } = e.args;
      announced.set(nonce, { amount, price });
      entries.push({ ...located, event: "Publicada", status: "unused", detail: tokensLabel(amount), from: seller, price: formatUsdc(price) });
    } else if (e.eventName === "OrderCancelled" && mine(e.args.seller)) {
      const order = announced.get(e.args.nonce);
      if (!order) continue; // Cancelled on another token, or announced before the window.
      entries.push({ ...located, event: "Cancelada", status: "cancelled", detail: tokensLabel(order.amount), from: account, price: formatUsdc(order.price) });
    } else if (e.eventName === "OrderFilled" && ofToken(e.args.token) && (mine(e.args.seller) || mine(e.args.buyer))) {
      const { seller, buyer, amount, price } = e.args;
      entries.push({ ...located, event: mine(seller) ? "Vendido" : "Comprado", status: "sold", detail: tokensLabel(amount), from: seller, to: buyer, price: formatUsdc(price) });
    } else if (e.eventName === "Reversion" && ofToken(e.args.token) && mine(e.args.holder)) {
      // Amount prints the currency first, so a blank one keeps this reading "1 token" rather than "tokens 1".
      entries.push({ ...located, event: "Revertido", status: "reverted", detail: "A certificado en papel", from: e.args.holder, price: tokensLabel(e.args.amount), currency: " " });
    }
  }

  // The tail is oldest first; the screen is newest first.
  return Promise.all(
    entries.reverse().map(async ({ blockNumber, ...entry }) => ({
      ...entry,
      time: new Date(Number(await blockTime(blockNumber)) * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    })),
  );
}
