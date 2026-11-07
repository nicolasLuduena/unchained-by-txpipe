"use client";

import { useCallback, useEffect, useState } from "react";
import { isAddressEqual, type Address } from "viem";
import { chainName } from "@/lib/chain";
import { venue, VenueRefusal } from "@/lib/orders/client";
import type { OrderView, ReversionView } from "@/lib/orders/types";
import type { WalletConfig } from "@/lib/wallet/deployment";
import { readHistory, type HistoryEntry } from "@/lib/wallet/history";
import { readSnapshot, type Snapshot } from "@/lib/wallet/market";
import { passesPrecheck } from "@/lib/wallet/precheck";
import { revertReason } from "@/lib/wallet/revert-reason";

/** A throttled response from Fuji's public RPC reads as a CORS failure here, so the wallet polls gently. */
const POLL_MS = chainName === "local" ? 2500 : 15_000;

export type Precheck = "checking" | "passed" | "blocked" | "unavailable";

export type WalletData = {
  address: Address;
  snapshot: Snapshot | null;
  orders: OrderView[];
  reversions: ReversionView[];
  history: HistoryEntry[];
  precheck: Precheck;
  offline: boolean;
};

const empty = (address: Address): WalletData => ({
  address,
  snapshot: null,
  orders: [],
  reversions: [],
  history: [],
  precheck: "checking",
  offline: false,
});

/** Polls the chain and the order service for one account. Data from the previous actor is never shown. */
export function useWallet(config: WalletConfig, address: Address) {
  const [data, setData] = useState<WalletData>(() => empty(address));
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    async function load() {
      // Apart from the rest: history is a record, and a slow log read must not hold the ticket shut.
      readHistory(config, address)
        .then((history) => {
          if (live) setData((d) => (d.address === address ? { ...d, history } : d));
        })
        .catch((error: unknown) => console.error("history refresh failed", error));

      try {
        const [snapshot, orders, reversions, passed] = await Promise.all([
          readSnapshot(config, address),
          venue.listOrders(),
          venue.listReversions(),
          passesPrecheck(config.attestationStore, address),
        ]);
        if (live) {
          setData((d) => ({
            ...(d.address === address ? d : empty(address)),
            snapshot,
            orders,
            reversions: reversions.filter((r) => isAddressEqual(r.holder, address)),
            precheck: passed ? "passed" : "blocked",
            offline: false,
          }));
        }
      } catch (error) {
        console.error("wallet refresh failed", error);
        // Fail closed until there is a first reading. After that a throttled poll keeps it, and says it is stale:
        // the venue and the chain both check again on every order, so this is never the last word.
        if (live) setData((d) => (d.address === address && d.snapshot ? { ...d, offline: true } : { ...empty(address), precheck: "unavailable", offline: true }));
      }
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [config, address, tick]);

  return { ...(data.address === address ? data : empty(address)), refresh };
}

export type Wallet = ReturnType<typeof useWallet>;

/** Tracks one user action: its working state and the message to show if it fails. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof VenueRefusal ? e.message : revertReason(e));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run };
}
