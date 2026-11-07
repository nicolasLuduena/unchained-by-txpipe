import { encodeAbiParameters, keccak256, type Address, type Hash, type Hex } from "viem";

/** The label every venue response carries: this service belongs to the PSAV, not to Handoff. */
export const OPERATED_BY = "PSAV";

/** IHandoffSettlement.Order as viem encodes it. */
export type Order = {
  chainId: bigint;
  token: Address;
  venue: Address;
  seller: Address;
  amount: bigint;
  price: bigint;
  expiry: bigint;
  nonce: bigint;
};

/** An order on the wire: integers travel as decimal strings. */
export type WireOrder = { [K in keyof Order]: Order[K] extends bigint ? string : Order[K] };

export type OrderStatus = "open" | "filled" | "cancelled" | "expired";

export type ReportState =
  | { status: "pending" }
  | { status: "acknowledged"; id: string; label: string; at: string };

export type OrderView = {
  orderHash: Hash;
  order: WireOrder;
  sellerSig: Hex;
  status: OrderStatus;
  announceTx: Hash;
  /** The fill or cancel transaction, once the chain shows one. */
  closeTx?: Hash;
  buyer?: Address;
  /** Unix seconds, for orders stored since these fields exist. */
  announcedAt?: number;
  closedAt?: number;
  /** Registry report for a filled order. */
  report?: ReportState;
};

export type Refusal = {
  id: number;
  at: string;
  route: string;
  code: string;
  reason: string;
  address?: Address;
  orderHash?: Hash;
};

export type ReversionStatus = "pending" | "done";

export type ReversionView = {
  id: Hash;
  token: Address;
  holder: Address;
  amount: string;
  requestedAt: string;
  status: ReversionStatus;
  /** Set by the PSAV's revertToPaper, read back from the Reversion event. */
  certificateRef?: string;
  txHash?: Hash;
};

export function toWireOrder(order: Order): WireOrder {
  return {
    ...order,
    chainId: order.chainId.toString(),
    amount: order.amount.toString(),
    price: order.price.toString(),
    expiry: order.expiry.toString(),
    nonce: order.nonce.toString(),
  };
}

export function fromWireOrder(order: WireOrder): Order {
  return {
    ...order,
    chainId: BigInt(order.chainId),
    amount: BigInt(order.amount),
    price: BigInt(order.price),
    expiry: BigInt(order.expiry),
    nonce: BigInt(order.nonce),
  };
}

/** A holder's ask to go back to paper, as it is signed. */
export type ReversionRequest = {
  chainId: bigint;
  token: Address;
  holder: Address;
  amount: bigint;
  requestedAt: bigint;
};

/** The digest a holder signs to ask for reversion. Binds the chain, so a request cannot be replayed elsewhere. */
export function reversionDigest(r: ReversionRequest): Hash {
  return keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "uint256" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }],
      ["Handoff reversion request", r.chainId, r.token, r.holder, r.amount, r.requestedAt],
    ),
  );
}
