import { chainName } from "@/lib/chain";
import type { Actor } from "@/lib/sponsor";

// Plain module: the server page reads these, and exports of a "use client" file are references there, not values.
export const ACTORS: { id: Actor; label: string }[] = [
  { id: "seller", label: "Seller" },
  { id: "buyer", label: "Buyer" },
  { id: "unverified", label: "Unverified" },
  // Needs the bundler and the paymaster, so it exists only on Fuji.
  ...(chainName === "fuji" ? [{ id: "metamask" as const, label: "My wallet" }] : []),
];

export const SECTIONS = [
  { id: "mercado", label: "Market" },
  { id: "vender", label: "Sell" },
  { id: "ordenes", label: "Orders" },
  { id: "historial", label: "History" },
  { id: "papel", label: "Convert to paper" },
] as const;

export type Section = (typeof SECTIONS)[number]["id"];
