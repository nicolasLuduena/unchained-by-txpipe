import { encodeFunctionData, erc20Abi, type Address, type Hash } from "viem";
import { handoffSettlementAbi } from "@/lib/abi";
import { chain } from "@/lib/chain";
import { venue, VenueRefusal } from "@/lib/orders/client";
import { fromWireOrder, toWireOrder, type Order, type OrderView } from "@/lib/orders/types";
import { getSponsor } from "@/lib/sponsor";
import { sendDirect, type DirectResult } from "@/lib/sponsor/direct";
import type { WalletConfig } from "@/lib/wallet/deployment";
import { readSnapshot } from "@/lib/wallet/market";

const ORDER_LIFETIME_S = 86_400n;

/** Names what is happening right now, so a wait of several seconds says what it is waiting for. */
export type Say = (phase: string) => void;

export type Holdings = { tokens: bigint; usdc: bigint };

function fillData(view: OrderView, venueSig: `0x${string}`) {
  return encodeFunctionData({ abi: handoffSettlementAbi, functionName: "fill", args: [fromWireOrder(view.order), view.sellerSig, venueSig] });
}

/** A fresh reading, not the last poll. Null when it fails: a slow read must not fail a step that already happened. */
export async function readHoldings(config: WalletConfig, account: Address): Promise<Holdings | null> {
  return readSnapshot(config, account).catch((error: unknown) => {
    console.error("holdings read failed", error);
    return null;
  });
}

/** The seller signs one order for free and the venue publishes it. The same calls the sell ticket makes, with the amount fixed. */
export async function postOrder(config: WalletConfig, seller: Address, amount: bigint, price: bigint, say: Say): Promise<OrderView> {
  const order: Order = {
    chainId: BigInt(chain.id),
    token: config.token,
    venue: config.venue,
    seller,
    amount,
    price,
    expiry: BigInt(Math.floor(Date.now() / 1000)) + ORDER_LIFETIME_S,
    nonce: crypto.getRandomValues(new BigUint64Array(1))[0],
  };
  say("The seller signs the order.");
  const sponsor = await getSponsor("seller");
  const signature = await sponsor.signOrder("seller", order);
  say("The PSAV publishes the order to the contract.");
  return venue.postOrder(toWireOrder(order), signature);
}

/** The refusal: an account with no attestation calls the contract itself and pays its own gas. */
export async function attemptUnverified(config: WalletConfig, view: OrderView, say?: Say): Promise<DirectResult> {
  say?.("The account asks for the co-signature it needs to try.");
  // A venue that refuses outright still leaves a named revert: the fill goes out with no co-signature.
  const venueSig = await venue.coSign(view.orderHash, config.unverified, true).catch((error: unknown) => {
    if (error instanceof VenueRefusal) return "0x" as const;
    throw error;
  });
  say?.("The account calls the contract, with no wallet in between.");
  return sendDirect("unverified", { to: config.settlement, data: fillData(view, venueSig) });
}

/** The sponsored fill of one named order: the same two calls the market screen makes, without choosing the best ask. */
export async function buyOrder(config: WalletConfig, view: OrderView, say: Say): Promise<{ hash: Hash; userOpHash?: Hash }> {
  say("The PSAV co-signs the purchase.");
  const venueSig = await venue.coSign(view.orderHash, config.buyer);
  say("The contract settles the purchase, with the gas sponsored.");
  const sponsor = await getSponsor("buyer");
  const total = BigInt(view.order.amount) * BigInt(view.order.price);
  return sponsor.sendCalls("buyer", [
    { to: config.usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [config.settlement, total] }) },
    { to: config.settlement, data: fillData(view, venueSig) },
  ]);
}
