import type { Actor } from "@/lib/sponsor";

// Plain module: the server page reads these, and exports of a "use client" file are references there, not values.
export const ACTORS: { id: Actor; label: string }[] = [
  { id: "seller", label: "Vendedora" },
  { id: "buyer", label: "Comprador" },
  { id: "unverified", label: "Sin verificar" },
];

export const SECTIONS = [
  { id: "mercado", label: "Mercado" },
  { id: "vender", label: "Vender" },
  { id: "ordenes", label: "Órdenes" },
  { id: "historial", label: "Historial" },
  { id: "papel", label: "Papel" },
] as const;

export type Section = (typeof SECTIONS)[number]["id"];
