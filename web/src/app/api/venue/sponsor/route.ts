import type { Hash } from "viem";
import { readJson, venueRoute } from "@/lib/orders/http";
import { recordSettledFills } from "@/lib/orders/service";
import { runSponsorRequest } from "@/lib/sponsor/fuji-server";

/** Server half of the Fuji Sponsor. Holds the owner keys and the paymaster key; runs only the wallet's own calls. */
export function POST(request: Request) {
  return venueRoute("sponsor", async () => {
    const body = await readJson<{ action?: unknown }>(request);
    const result = await runSponsorRequest(body);
    if (body.action === "sendCalls" && "hash" in result) {
      // A failure here only costs the fallback lookup; the fill itself already happened.
      await recordSettledFills(result.hash as Hash).catch((error: unknown) => console.error("fill not recorded from its receipt", error));
    }
    return result;
  });
}
