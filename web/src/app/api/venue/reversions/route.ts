import { readJson, venueRoute } from "@/lib/orders/http";
import { listReversions, requestReversion } from "@/lib/orders/service";

/** Reversion requests held by the PSAV. The console acts on them through revertToPaper. */
export function GET() {
  return venueRoute("list-reversions", async () => ({ reversions: await listReversions() }));
}

export function POST(request: Request) {
  return venueRoute("request-reversion", async () => ({ reversion: await requestReversion(await readJson(request)) }));
}
