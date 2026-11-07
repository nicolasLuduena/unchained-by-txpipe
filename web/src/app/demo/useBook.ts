"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hash } from "viem";
import { chainName } from "@/lib/chain";
import { venue } from "@/lib/orders/client";
import type { OrderView } from "@/lib/orders/types";

/** Order service reads cost no eth_getLogs, so the book can poll far faster than the wallets. */
const BOOK_POLL_MS = chainName === "local" ? 1000 : 2500;

/** The one order set both phones show, and which orders were filled while this page watched them. */
export function useBook() {
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [torn, setTorn] = useState<ReadonlySet<Hash>>(() => new Set());
  const seenOpen = useRef(new Set<Hash>());
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const next = await venue.listOrders();
      next.filter((o) => o.status === "open").forEach((o) => seenOpen.current.add(o.orderHash));
      const landed = next.filter((o) => o.status === "filled" && seenOpen.current.delete(o.orderHash));
      if (landed.length > 0) setTorn((set) => new Set([...set, ...landed.map((o) => o.orderHash)]));
      setOrders(next);
    } catch (error) {
      console.error("book refresh failed", error);
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, BOOK_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { orders: orders ?? [], loaded: orders !== null, torn, refresh };
}

export type Book = ReturnType<typeof useBook>;
