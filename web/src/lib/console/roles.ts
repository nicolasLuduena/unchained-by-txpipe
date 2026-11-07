import type { Address, Hash } from "viem";

/** The three actors of the console. The third has no business attestation, to show the refusal. */
export const ROLES = ["emisor", "psav", "sin-atestacion"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  emisor: "Emisor",
  psav: "PSAV",
  "sin-atestacion": "Sin atestación",
};

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

/** Registry functions the send route will sign. Anything else is rejected before a key is touched. */
export const REGISTRY_WRITES = [
  "registerToken",
  "mint",
  "setBand",
  "setFloor",
  "setTradingEnabled",
  "setPaused",
  "setBlocked",
  "revertToPaper",
  "addVenue",
  "repointVenue",
] as const;
export type RegistryWrite = (typeof REGISTRY_WRITES)[number];

export type JsonArg = string | number | boolean | JsonArg[] | { [key: string]: JsonArg };

/** A registry call as it crosses the wire. Integers travel as strings; the route coerces them from the ABI. */
export type RegistryCall = { fn: RegistryWrite; args: JsonArg[] };

export type SendResult =
  | { ok: true; hash: Hash; block: string }
  | { ok: false; code: string; detail?: string; hash?: Hash };

export type RoleAddresses = Record<Role, Address | null>;
