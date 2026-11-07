import "server-only";
import { chain } from "@/lib/chain";
import { venueKv } from "@/lib/orders/kv";
import { coreContracts } from "@/lib/wallet/deployment";

/** The same scope as the venue store, so a redeploy or a test prefix also starts these from zero. */
export function scopedKey(name: string): string {
  const prefix = process.env.VENUE_STORE_PREFIX ?? "handoff";
  const settlement = coreContracts()?.settlement.toLowerCase() ?? "undeployed";
  return `${prefix}:${chain.id}:${settlement}:${name}`;
}

/** A fixed-window counter in Redis. False once `limit` calls landed in this window. */
export async function withinRate(name: string, limit: number, windowMs: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / windowMs);
  return (await venueKv().incr(scopedKey(`rate:${name}:${bucket}`))) <= limit;
}
