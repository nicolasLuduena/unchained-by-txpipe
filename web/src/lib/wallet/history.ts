import { isAddressEqual, type Address, type Hash } from "viem";
import type { StampStatus } from "@/design";
import { parseBig } from "@/lib/big-json";
import type { ScannedLog } from "@/lib/console/scan";
import type { WalletConfig } from "./deployment";
import { formatUsdc, tokensLabel } from "./format";

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

type OrderArgs = { token: Address; seller: Address; buyer: Address; amount: bigint; price: bigint; nonce: bigint };
type ReversionArgs = { token: Address; holder: Address; amount: bigint };

/** The server scans the chain once, from the deployment's start block, for every screen. There is no indexer. */
async function readEvents() {
  const response = await fetch("/api/chain/logs", { cache: "no-store" });
  if (!response.ok) throw new Error(`chain logs: ${response.status}`);
  return parseBig<{ head: bigint; scannedTo: bigint; logs: ScannedLog[]; times: [bigint, number][] }>(await response.text());
}

function clock(seconds: number) {
  return new Date(seconds * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** Everything this account did on the token, from chain events. `partial` while the scan is still catching up. */
export async function readHistory(config: WalletConfig, account: Address): Promise<{ entries: HistoryEntry[]; partial: boolean }> {
  const { head, scannedTo, logs, times } = await readEvents();
  const timeOf = new Map(times);
  const mine = (address: Address) => isAddressEqual(address, account);
  const ofToken = (token: Address) => isAddressEqual(token, config.token);
  const announced = new Map<bigint, { amount: bigint; price: bigint }>();
  const entries: HistoryEntry[] = [];

  for (const e of logs) {
    const seconds = timeOf.get(e.blockNumber);
    const located = { id: `${e.transactionHash}-${e.logIndex}`, hash: e.transactionHash, time: seconds ? clock(seconds) : "-" };
    const order = e.args as OrderArgs;

    if (e.eventName === "OrderAnnounced" && ofToken(order.token) && mine(order.seller)) {
      const { seller, amount, price, nonce } = order;
      announced.set(nonce, { amount, price });
      entries.push({ ...located, event: "Publicada", status: "unused", detail: tokensLabel(amount), from: seller, price: formatUsdc(price) });
    } else if (e.eventName === "OrderCancelled" && mine(order.seller)) {
      const known = announced.get(order.nonce);
      if (!known) continue; // Cancelled on another token.
      entries.push({ ...located, event: "Cancelada", status: "cancelled", detail: tokensLabel(known.amount), from: account, price: formatUsdc(known.price) });
    } else if (e.eventName === "OrderFilled" && ofToken(order.token) && (mine(order.seller) || mine(order.buyer))) {
      const { seller, buyer, amount, price } = order;
      entries.push({ ...located, event: mine(seller) ? "Vendido" : "Comprado", status: "sold", detail: tokensLabel(amount), from: seller, to: buyer, price: formatUsdc(price) });
    } else if (e.eventName === "Reversion") {
      const { token, holder, amount } = e.args as ReversionArgs;
      if (!ofToken(token) || !mine(holder)) continue;
      // Amount prints the currency first, so a blank one keeps this reading "1 token" rather than "tokens 1".
      entries.push({ ...located, event: "En papel", status: "verified", detail: "A certificado en papel", from: holder, price: tokensLabel(amount), currency: " " });
    }
  }

  // The scan is oldest first; the screen is newest first.
  return { entries: entries.reverse(), partial: scannedTo < head };
}
