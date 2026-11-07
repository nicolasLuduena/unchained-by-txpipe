import { venueRoute } from "@/lib/orders/http";
import { markCancelled } from "@/lib/orders/service";

/** Cancel marker, operated by the PSAV. The cancel itself is the seller's on-chain call. */
export async function POST(_request: Request, { params }: { params: Promise<{ orderHash: string }> }) {
  const { orderHash } = await params;
  return venueRoute("cancel", async () => ({ order: await markCancelled(orderHash) }));
}
