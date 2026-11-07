import "server-only";
import { stringifyBig } from "@/lib/big-json";
import { chainName } from "@/lib/chain";
import { store } from "@/lib/orders/store";
import { LogScanner, type ScanSnapshot } from "./scan";
import { roleAddresses } from "./send-as";
import { readConsole, type ConsoleState } from "./state";

/**
 * A reading is reused for this long, by every screen on every instance. It is also the lease on the next scan, so the
 * whole deployment scans once per window, whatever the instance count. A scan makes at most two log reads, which
 * keeps Fuji at 8 a minute against its limit of about 12.
 */
const MIN_INTERVAL_MS = chainName === "local" ? 1000 : 15_000;
/** How long an idle deployment keeps its cursor. Any scan renews it; past this, the next scan starts from the start block. */
const CURSOR_TTL_MS = 86_400_000;
const SHARED_READING = "console:reading";

type Reading = { readAt: number; state: ConsoleState; scan: ScanSnapshot };
type Shared = { scanner: LogScanner; state: ConsoleState | null; readAt: number; running: Promise<ConsoleState> | null };

// On globalThis, like the venue store, so every route and dev reload shares one scan.
const holder = globalThis as typeof globalThis & { __handoffConsole?: Shared };
const shared: Shared = (holder.__handoffConsole ??= { scanner: new LogScanner(), state: null, readAt: 0, running: null });

/** Takes up what another instance read, if it is newer than what this one holds. */
async function adoptShared() {
  const reading = await store.getCached<Reading>(SHARED_READING).catch(() => null);
  if (!reading || reading.readAt <= shared.readAt) return;
  shared.scanner.restore(reading.scan);
  shared.state = reading.state;
  shared.readAt = reading.readAt;
}

async function scanOrReuse(): Promise<ConsoleState> {
  await adoptShared();
  if (shared.state && Date.now() - shared.readAt < MIN_INTERVAL_MS) return shared.state;
  // The lease is left to expire, never released: that is what spaces the scans.
  if (!(await store.claim("console-scan", MIN_INTERVAL_MS))) {
    if (shared.state) return shared.state;
    throw new Error("another instance holds the first scan");
  }
  const state = await readConsole(shared.scanner, roleAddresses());
  shared.state = state;
  shared.readAt = Date.now();
  await store
    .putCached(SHARED_READING, { readAt: shared.readAt, state, scan: shared.scanner.snapshot() } satisfies Reading, CURSOR_TTL_MS)
    .catch((error: unknown) => console.error("scan not shared", error));
  return state;
}

/**
 * The one chain poll behind the console and the wallet's history. However many screens and instances are open, the
 * RPC sees a single scan, through the venue store: Upstash when it is configured, process memory otherwise. A poll
 * that fails falls back to the last good reading, if there is one, because a stale screen that says how far it has
 * read beats an error; the next poll carries on from the cursor.
 */
export async function sharedConsole(): Promise<ConsoleState> {
  if (shared.state && Date.now() - shared.readAt < MIN_INTERVAL_MS) return shared.state;
  shared.running ??= scanOrReuse()
    .catch((error: unknown) => {
      if (!shared.state) throw error;
      console.error("chain read failed, serving the last reading", error instanceof Error ? error.message.slice(0, 200) : error);
      return shared.state;
    })
    .finally(() => {
      shared.running = null;
    });
  return shared.running;
}

/** The scanned events and their block times, for the wallet's history. */
export async function sharedLogs() {
  const { head, scannedTo } = await sharedConsole();
  return { head, scannedTo, logs: shared.scanner.feedLogs, times: shared.scanner.times() };
}

/** Runs a shared read as a route: bigints survive the trip, and a throttled RPC is a 503 the screens retry. */
export async function chainRoute(read: () => Promise<object>): Promise<Response> {
  try {
    // The scan itself moves at most every 15 seconds, so five seconds on the CDN costs nothing a viewer can see.
    return new Response(stringifyBig(await read()), {
      headers: { "content-type": "application/json", "Vercel-CDN-Cache-Control": "max-age=5" },
    });
  } catch (error) {
    console.error("chain read failed", error);
    return Response.json({ error: "rpc_unavailable" }, { status: 503 });
  }
}
