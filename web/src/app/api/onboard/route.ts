import { accountView, onboard } from "@/lib/onboard/service";
import { readJson, venueRoute } from "@/lib/orders/http";

/** Above the onboarding lock's ttl plus its wait, so a queued request is not cut off while it holds the lock. */
export const maxDuration = 180;

/** The visitor's smart account and how far its demo verification got. */
export function GET(request: Request) {
  return venueRoute("onboard", async () => accountView(new URL(request.url).searchParams.get("owner")));
}

/** Demo verification, with no identity check. See lib/onboard/service.ts. */
export function POST(request: Request) {
  return venueRoute("onboard", async () => onboard(await readJson(request)));
}
