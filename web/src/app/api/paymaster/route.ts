import { forwardToPaymaster } from "@/lib/sponsor/paymaster-proxy";

/** Same-origin stand-in for the paymaster URL, for the SDK running in the visitor's browser. */
export async function POST(request: Request) {
  return forwardToPaymaster(await request.json().catch(() => null));
}
