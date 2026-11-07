import { readJson, venueRoute } from "@/lib/orders/http";
import { coSign } from "@/lib/orders/service";

/** Venue co-signature, operated by the PSAV. The order key signs here and nowhere else. */
export async function POST(request: Request, { params }: { params: Promise<{ orderHash: string }> }) {
  const { orderHash } = await params;
  return venueRoute("co-sign", async () => coSign(orderHash, await readJson(request)));
}
