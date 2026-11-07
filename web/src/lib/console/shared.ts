import "server-only";
import { stringifyBig } from "@/lib/big-json";
import { chainName } from "@/lib/chain";
import { LogScanner } from "./scan";
import { roleAddresses } from "./send-as";
import { readConsole, type ConsoleState } from "./state";

/** A reading is reused for this long, so screens polling together cost the public RPC one read. */
const MIN_INTERVAL_MS = chainName === "local" ? 1000 : 4000;

type Shared = { scanner: LogScanner; state: ConsoleState | null; readAt: number; running: Promise<ConsoleState> | null };

// On globalThis, like the venue store, so every route and dev reload shares one scan.
const holder = globalThis as typeof globalThis & { __handoffConsole?: Shared };
const shared: Shared = (holder.__handoffConsole ??= { scanner: new LogScanner(), state: null, readAt: 0, running: null });

/**
 * The one chain poll behind the console and the wallet's history. However many screens are open, the RPC
 * sees a single scan, and a failed poll keeps its cursors, so the next one carries on from there.
 */
export async function sharedConsole(): Promise<ConsoleState> {
  if (shared.state && Date.now() - shared.readAt < MIN_INTERVAL_MS) return shared.state;
  shared.running ??= readConsole(shared.scanner, roleAddresses())
    .then((state) => {
      shared.state = state;
      shared.readAt = Date.now();
      return state;
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
    return new Response(stringifyBig(await read()), { headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("chain read failed", error);
    return Response.json({ error: "rpc_unavailable" }, { status: 503 });
  }
}
