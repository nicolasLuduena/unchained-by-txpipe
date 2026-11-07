import { venueRoute } from "@/lib/orders/http";
import { listRefusals } from "@/lib/orders/service";

/** Everything the PSAV's order service declined, newest first. Read by the console. */
export function GET() {
  return venueRoute("list-refusals", async () => ({ refusals: await listRefusals() }), "shared");
}
