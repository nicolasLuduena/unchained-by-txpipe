import { forwardToPaymaster } from "@/lib/sponsor/paymaster-proxy";

/** Keeps the keyed paymaster URL on the server. Speaks JSON-RPC, because the smart-account SDK calls it directly. */
export function POST(request: Request) {
  return forwardToPaymaster(request);
}
