import { readJson, venueRoute } from "@/lib/orders/http";
import { listOrders, postOrder } from "@/lib/orders/service";

/** Order service operated by the PSAV. */
export function GET() {
  return venueRoute("list-orders", async () => ({ orders: await listOrders() }), "shared");
}

export function POST(request: Request) {
  return venueRoute("post-order", async () => ({ order: await postOrder(await readJson(request)) }));
}
