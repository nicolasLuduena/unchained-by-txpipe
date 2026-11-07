import "server-only";
import type { Address, Hash, Hex } from "viem";
import type { Order, Refusal, ReportState, ReversionStatus } from "./types";

export type StoredOrder = {
  orderHash: Hash;
  order: Order;
  sellerSig: Hex;
  announceTx: Hash;
  announceBlock: bigint;
  filled?: { tx: Hash; buyer: Address };
  cancelled?: { tx?: Hash };
  report?: ReportState;
};

export type StoredReversion = {
  id: Hash;
  token: Address;
  holder: Address;
  amount: bigint;
  requestedAt: bigint;
  /** The next block to look at for the PSAV's Reversion event. */
  scanFrom: bigint;
  status: ReversionStatus;
  certificateRef?: string;
  txHash?: Hash;
};

type VenueStore = {
  orders: Map<Hash, StoredOrder>;
  reversions: Map<Hash, StoredReversion>;
  refusals: Refusal[];
};

// On globalThis so the in-memory store survives Next dev reloads of this module.
const holder = globalThis as typeof globalThis & { __handoffVenue?: VenueStore };

export const store: VenueStore = (holder.__handoffVenue ??= {
  orders: new Map(),
  reversions: new Map(),
  refusals: [],
});
