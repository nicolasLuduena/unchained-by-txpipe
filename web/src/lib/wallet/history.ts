import { isAddressEqual, type Address, type Hash } from "viem";
import type { StampStatus } from "@/design";
import { handoffRegistryAbi, handoffSettlementAbi } from "@/lib/abi";
import { publicClient } from "@/lib/chain";
import type { WalletConfig } from "./deployment";
import { formatUsdc, tokensLabel } from "./format";

/** Fuji's public RPC refuses wide getLogs ranges. History shows the recent window. */
const LOG_WINDOW_BLOCKS = 2000n;

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

type Located = { blockNumber: bigint; logIndex: number; transactionHash: Hash };

function newestFirst(a: Located, b: Located) {
  return a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : Number(b.blockNumber - a.blockNumber);
}

/** Everything this account did on the token, from chain events over RPC. There is no indexer. */
export async function readHistory(config: WalletConfig, account: Address): Promise<HistoryEntry[]> {
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > LOG_WINDOW_BLOCKS ? latest - LOG_WINDOW_BLOCKS : 0n;
  const settlement = { address: config.settlement, abi: handoffSettlementAbi, fromBlock } as const;

  const [announced, cancelled, filled, reversions] = await Promise.all([
    publicClient.getContractEvents({ ...settlement, eventName: "OrderAnnounced", args: { token: config.token } }),
    publicClient.getContractEvents({ ...settlement, eventName: "OrderCancelled", args: { seller: account } }),
    publicClient.getContractEvents({ ...settlement, eventName: "OrderFilled", args: { token: config.token } }),
    publicClient.getContractEvents({
      address: config.registry,
      abi: handoffRegistryAbi,
      fromBlock,
      eventName: "Reversion",
      args: { token: config.token, holder: account },
    }),
  ]);

  const mine = (address?: Address) => !!address && isAddressEqual(address, account);
  const orderByNonce = new Map(announced.filter((e) => mine(e.args.seller)).map((e) => [e.args.nonce, e.args]));

  const entries: (Omit<HistoryEntry, "time"> & Located)[] = [];
  const located = (e: Located) => ({
    id: `${e.transactionHash}-${e.logIndex}`,
    hash: e.transactionHash,
    blockNumber: e.blockNumber,
    logIndex: e.logIndex,
    transactionHash: e.transactionHash,
  });

  for (const e of announced) {
    const { seller, amount, price } = e.args;
    if (!mine(seller) || !seller || amount === undefined || price === undefined) continue;
    entries.push({ ...located(e), event: "Publicada", status: "unused", detail: tokensLabel(amount), from: seller, price: formatUsdc(price) });
  }
  for (const e of cancelled) {
    const order = orderByNonce.get(e.args.nonce);
    entries.push({
      ...located(e),
      event: "Cancelada",
      status: "cancelled",
      detail: order?.amount === undefined ? "Orden" : tokensLabel(order.amount),
      from: account,
      price: order?.price === undefined ? "0,00" : formatUsdc(order.price),
    });
  }
  for (const e of filled) {
    const { seller, buyer, amount, price } = e.args;
    if (!seller || !buyer || amount === undefined || price === undefined) continue;
    if (!mine(seller) && !mine(buyer)) continue;
    entries.push({ ...located(e), event: mine(seller) ? "Vendido" : "Comprado", status: "sold", detail: tokensLabel(amount), from: seller, to: buyer, price: formatUsdc(price) });
  }
  for (const e of reversions) {
    const { amount, holder } = e.args;
    if (amount === undefined || !holder) continue;
    // Amount prints the currency first, so a blank one keeps this reading "1 token" rather than "tokens 1".
    entries.push({ ...located(e), event: "Revertido", status: "reverted", detail: "A certificado en papel", from: holder, price: tokensLabel(amount), currency: " " });
  }

  entries.sort(newestFirst);
  const blocks = [...new Set(entries.map((e) => e.blockNumber))];
  const times = new Map(
    await Promise.all(blocks.map(async (blockNumber) => [blockNumber, (await publicClient.getBlock({ blockNumber })).timestamp] as const)),
  );
  return entries.map((e) => ({
    ...e,
    time: new Date(Number(times.get(e.blockNumber)) * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  }));
}
