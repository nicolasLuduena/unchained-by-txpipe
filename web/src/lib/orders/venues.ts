import { isAddressEqual, type Address } from "viem";
import { deployment } from "@/lib/chain";

export type VenueInfo = { label: string; venue: Address; orderKey: Address };

const actors = (deployment?.actors ?? {}) as Partial<Record<"venue" | "orderKey" | "venue2" | "orderKey2", Address>>;

/** The venues of this deployment, in slot order. Both serve one shared order set; an order names its own. */
export const VENUES = [
  { label: "PSAV 1", venue: actors.venue, orderKey: actors.orderKey },
  { label: "PSAV 2", venue: actors.venue2, orderKey: actors.orderKey2 },
].filter((v): v is VenueInfo => Boolean(v.venue && v.orderKey));

export function venueIndex(venue: Address): number {
  return VENUES.findIndex((v) => isAddressEqual(v.venue, venue));
}

export function venueLabel(venue: Address): string {
  return VENUES[venueIndex(venue)]?.label ?? "Otra plataforma";
}
