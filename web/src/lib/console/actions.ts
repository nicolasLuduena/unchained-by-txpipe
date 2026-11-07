import { isAddress, isHex, keccak256, stringToHex, type Address } from "viem";
import { deployment } from "@/lib/chain";
import { normalizeUsdc } from "@/lib/wallet/format";
import { parseUsdc } from "./format";
import type { JsonArg, RegistryWrite, Role } from "./roles";
import type { TokenView } from "./state";

export type FieldKind = "text" | "required" | "address" | "addresses" | "hash" | "whole" | "usdc" | "flag";

export type FieldDef = { name: string; label: string; kind: FieldKind; help?: string; initial?: string };

export type ActionContext = { token: TokenView | null; store: Address | null };

export type ActionDef = {
  id: string;
  title: string;
  who: string;
  roles: readonly Role[];
  /** Needs a token selected. Everything but registration does. */
  needsToken: boolean;
  /** Issuer action: passes the KUMPLY business read first, unless the PSAV is the one acting. */
  gated: boolean;
  danger?: boolean;
  fn: RegistryWrite;
  fields: (ctx: ActionContext) => FieldDef[];
  label: (ctx: ActionContext, values: Values) => string;
  args: (values: Values, ctx: ActionContext) => JsonArg[];
};

export type Values = Record<string, string>;

const EMISOR: readonly Role[] = ["emisor", "sin-atestacion"];
const PSAV: readonly Role[] = ["psav", "sin-atestacion"];
const BOTH: readonly Role[] = ["emisor", "psav", "sin-atestacion"];

const EXAMPLE_DOC_HASH = keccak256(stringToHex("Documento de ejemplo, ficticio"));

/** Fuji's deployment file holds only `owner` until the issuer registers, so no actor can be assumed. */
function actor(name: string): string {
  const actors = deployment?.actors as Record<string, string> | undefined;
  return actors?.[name] ?? "";
}

const tokenOf = (ctx: ActionContext) => ctx.token?.address as string;


export const ACTIONS: ActionDef[] = [
  {
    id: "registrar",
    title: "Register token",
    who: "Issuer",
    roles: EMISOR,
    needsToken: false,
    gated: true,
    fn: "registerToken",
    fields: (ctx) => [
      { name: "name", label: "Name", kind: "required", initial: "Example Trust" },
      { name: "symbol", label: "Symbol", kind: "required", initial: "EXT" },
      { name: "depositRef", label: "Deposit reference", kind: "required", initial: "DEMO-DEPOSIT-0002 (fictional)" },
      { name: "cnvAuthRef", label: "CNV authorization reference", kind: "required", initial: "DEMO-CNV-RESFC-0001 (fictional)" },
      { name: "docHash", label: "Issuance document hash", kind: "hash", help: "Example hash. Paste the hash of the real document.", initial: EXAMPLE_DOC_HASH },
      { name: "supply", label: "Authorized units", kind: "whole", initial: "1000" },
      { name: "attesters", label: "Attesters", kind: "addresses", help: "Addresses separated by commas.", initial: ctx.store ?? "" },
      { name: "qualified", label: "Qualified investors only", kind: "flag", help: "Stored in the registry. Not enforced yet." },
      { name: "capped", label: "Crowdfunding cap", kind: "flag", help: "Stored in the registry. Not enforced yet." },
    ],
    label: () => "Register token",
    args: (v) => [
      {
        name: v.name,
        symbol: v.symbol,
        depositRef: v.depositRef,
        cnvAuthRef: v.cnvAuthRef,
        issuanceDocHash: v.docHash,
        authorizedSupply: v.supply,
        attesters: v.attesters.split(",").map((a) => a.trim()).filter(Boolean),
        flags: String((v.qualified === "1" ? 1 : 0) + (v.capped === "1" ? 2 : 0)),
      },
    ],
  },
  {
    id: "emitir",
    title: "Issue units",
    who: "Issuer",
    roles: EMISOR,
    needsToken: true,
    gated: true,
    fn: "mint",
    fields: () => [
      { name: "to", label: "Holder", kind: "address", initial: actor("seller") },
      { name: "amount", label: "Units", kind: "whole", initial: "10" },
    ],
    label: () => "Issue",
    args: (v, ctx) => [tokenOf(ctx), v.to, v.amount],
  },
  {
    id: "banda",
    title: "Set price band",
    who: "Issuer or PSAV",
    roles: BOTH,
    needsToken: true,
    gated: true,
    fn: "setBand",
    fields: () => [
      { name: "price", label: "Reference price", kind: "usdc", help: "USDC per unit.", initial: "2.50" },
      { name: "width", label: "Width in basis points", kind: "whole", help: "1000 is 10% to each side.", initial: "1000" },
      { name: "maxAge", label: "Valid for, in seconds", kind: "whole", help: "0 means it never expires.", initial: "0" },
    ],
    label: () => "Set price band",
    args: (v, ctx) => [tokenOf(ctx), parseUsdc(v.price).toString(), v.width, v.maxAge],
  },
  {
    id: "piso",
    title: "Set floor",
    who: "Issuer",
    roles: EMISOR,
    needsToken: true,
    gated: true,
    fn: "setFloor",
    fields: () => [{ name: "floor", label: "Floor", kind: "usdc", help: "USDC per unit. 0 removes it.", initial: "2.00" }],
    label: () => "Set floor",
    args: (v, ctx) => [tokenOf(ctx), parseUsdc(v.floor).toString()],
  },
  {
    id: "negociacion",
    title: "Secondary trading",
    who: "Issuer",
    roles: EMISOR,
    needsToken: true,
    gated: true,
    fn: "setTradingEnabled",
    fields: () => [],
    label: (ctx) => (ctx.token?.tradingEnabled ? "Close trading" : "Open trading"),
    args: (_, ctx) => [tokenOf(ctx), !ctx.token?.tradingEnabled],
  },
  {
    id: "pausa",
    title: "Pause token",
    who: "Issuer or PSAV",
    roles: BOTH,
    needsToken: true,
    gated: true,
    danger: true,
    fn: "setPaused",
    fields: () => [],
    label: (ctx) => (ctx.token?.paused ? "Resume" : "Pause"),
    args: (_, ctx) => [tokenOf(ctx), !ctx.token?.paused],
  },
  {
    id: "bloquear",
    title: "Block holder",
    who: "PSAV",
    roles: PSAV,
    needsToken: true,
    gated: false,
    danger: true,
    fn: "setBlocked",
    fields: () => [{ name: "holder", label: "Holder", kind: "address", initial: actor("seller") }],
    label: (ctx, v) => (isBlocked(ctx, v.holder) ? "Unblock" : "Block"),
    args: (v, ctx) => [tokenOf(ctx), v.holder, !isBlocked(ctx, v.holder)],
  },
  {
    id: "revertir",
    title: "Revert to paper",
    who: "PSAV",
    roles: PSAV,
    needsToken: true,
    gated: false,
    danger: true,
    fn: "revertToPaper",
    fields: () => [
      { name: "holder", label: "Holder", kind: "address", initial: actor("seller") },
      { name: "amount", label: "Units", kind: "whole", initial: "1" },
      // The contract accepts an empty reference, so this form is what requires it.
      { name: "certificate", label: "Certificate reference", kind: "required", help: "The depositary issues it. Handoff does not issue certificates." },
      { name: "docHash", label: "Document hash", kind: "hash", help: "Example hash. Paste the hash of the real document.", initial: EXAMPLE_DOC_HASH },
    ],
    label: () => "Revert to paper",
    args: (v, ctx) => [tokenOf(ctx), v.holder, v.amount, v.certificate, v.docHash],
  },
  {
    id: "plataforma",
    title: "Add venue",
    who: "Issuer",
    roles: EMISOR,
    needsToken: true,
    gated: true,
    fn: "addVenue",
    fields: () => [
      { name: "venue", label: "Venue address", kind: "address" },
      { name: "orderKey", label: "Order key", kind: "address" },
    ],
    label: () => "Add venue",
    args: (v, ctx) => [tokenOf(ctx), v.venue, v.orderKey],
  },
  {
    id: "reapuntar",
    title: "Repoint venue",
    who: "Issuer or PSAV",
    roles: BOTH,
    needsToken: true,
    gated: true,
    fn: "repointVenue",
    fields: (ctx) => [
      { name: "oldVenue", label: "Current venue", kind: "address", initial: ctx.token?.venues[0]?.venue ?? "" },
      { name: "newVenue", label: "New venue", kind: "address" },
      { name: "newOrderKey", label: "New order key", kind: "address" },
    ],
    label: () => "Repoint",
    args: (v, ctx) => [tokenOf(ctx), v.oldVenue, v.newVenue, v.newOrderKey],
  },
];

function isBlocked(ctx: ActionContext, holder: string): boolean {
  return ctx.token?.holders.some((h) => h.address.toLowerCase() === holder.toLowerCase() && h.blocked) ?? false;
}

/** The sentence under a field, or undefined when the value is fine. */
export function fieldError(field: FieldDef, value: string): string | undefined {
  const text = value.trim();
  switch (field.kind) {
    case "required":
      return text ? undefined : "Fill in this field.";
    case "address":
      return isAddress(text) ? undefined : "Enter a valid 0x address.";
    case "addresses":
      return text.split(",").every((a) => isAddress(a.trim())) ? undefined : "Enter valid 0x addresses, separated by commas.";
    case "hash":
      return isHex(text) && text.length === 66 ? undefined : "Enter a 32-byte 0x hash.";
    case "whole":
      return /^\d+$/.test(text) ? undefined : "Enter a whole number.";
    case "usdc":
      return normalizeUsdc(text) !== null ? undefined : "Enter an amount like 2.50.";
    default:
      return undefined;
  }
}
