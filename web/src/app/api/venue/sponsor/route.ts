import { readJson, venueRoute } from "@/lib/orders/http";
import { runSponsorRequest } from "@/lib/sponsor/fuji-server";

/** Server half of the Fuji Sponsor. Holds the owner keys and the paymaster key; runs only the wallet's own calls. */
export function POST(request: Request) {
  return venueRoute("sponsor", async () => runSponsorRequest(await readJson(request)));
}
