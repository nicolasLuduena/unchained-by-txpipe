import { isAddress, isHex, keccak256, stringToHex, type Address } from "viem";
import { deployment } from "@/lib/chain";
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
    title: "Registrar token",
    who: "Emisor",
    roles: EMISOR,
    needsToken: false,
    gated: true,
    fn: "registerToken",
    fields: (ctx) => [
      { name: "name", label: "Nombre", kind: "required", initial: "Fideicomiso Ejemplo" },
      { name: "symbol", label: "Símbolo", kind: "required", initial: "FEJ" },
      { name: "depositRef", label: "Referencia de depósito", kind: "required", initial: "DEMO-DEPOSITO-0002 (ficticio)" },
      { name: "cnvAuthRef", label: "Referencia de autorización CNV", kind: "required", initial: "DEMO-CNV-RESFC-0001 (ficticia)" },
      { name: "docHash", label: "Hash del documento de emisión", kind: "hash", help: "Hash de ejemplo. Pegá el del documento real.", initial: EXAMPLE_DOC_HASH },
      { name: "supply", label: "Unidades autorizadas", kind: "whole", initial: "1000" },
      { name: "attesters", label: "Atestadores", kind: "addresses", help: "Direcciones separadas por coma.", initial: ctx.store ?? "" },
      { name: "qualified", label: "Solo inversores calificados", kind: "flag", help: "Se guarda en el registro. Todavía no se aplica." },
      { name: "capped", label: "Tope de financiamiento colectivo", kind: "flag", help: "Se guarda en el registro. Todavía no se aplica." },
    ],
    label: () => "Registrar token",
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
    title: "Emitir unidades",
    who: "Emisor",
    roles: EMISOR,
    needsToken: true,
    gated: true,
    fn: "mint",
    fields: () => [
      { name: "to", label: "Titular", kind: "address", initial: actor("seller") },
      { name: "amount", label: "Unidades", kind: "whole", initial: "10" },
    ],
    label: () => "Emitir",
    args: (v, ctx) => [tokenOf(ctx), v.to, v.amount],
  },
  {
    id: "banda",
    title: "Fijar banda",
    who: "Emisor o PSAV",
    roles: BOTH,
    needsToken: true,
    gated: true,
    fn: "setBand",
    fields: () => [
      { name: "price", label: "Precio de referencia", kind: "usdc", help: "USDC por unidad.", initial: "2,50" },
      { name: "width", label: "Ancho en puntos básicos", kind: "whole", help: "1000 es 10 % hacia cada lado.", initial: "1000" },
      { name: "maxAge", label: "Vigencia en segundos", kind: "whole", help: "0 la deja sin vencimiento.", initial: "0" },
    ],
    label: () => "Fijar banda",
    args: (v, ctx) => [tokenOf(ctx), parseUsdc(v.price).toString(), v.width, v.maxAge],
  },
  {
    id: "piso",
    title: "Fijar piso",
    who: "Emisor",
    roles: EMISOR,
    needsToken: true,
    gated: true,
    fn: "setFloor",
    fields: () => [{ name: "floor", label: "Piso", kind: "usdc", help: "USDC por unidad. 0 lo quita.", initial: "2,00" }],
    label: () => "Fijar piso",
    args: (v, ctx) => [tokenOf(ctx), parseUsdc(v.floor).toString()],
  },
  {
    id: "negociacion",
    title: "Negociación secundaria",
    who: "Emisor",
    roles: EMISOR,
    needsToken: true,
    gated: true,
    fn: "setTradingEnabled",
    fields: () => [],
    label: (ctx) => (ctx.token?.tradingEnabled ? "Cerrar negociación" : "Abrir negociación"),
    args: (_, ctx) => [tokenOf(ctx), !ctx.token?.tradingEnabled],
  },
  {
    id: "pausa",
    title: "Pausar token",
    who: "Emisor o PSAV",
    roles: BOTH,
    needsToken: true,
    gated: true,
    danger: true,
    fn: "setPaused",
    fields: () => [],
    label: (ctx) => (ctx.token?.paused ? "Reanudar" : "Pausar"),
    args: (_, ctx) => [tokenOf(ctx), !ctx.token?.paused],
  },
  {
    id: "bloquear",
    title: "Bloquear titular",
    who: "PSAV",
    roles: PSAV,
    needsToken: true,
    gated: false,
    danger: true,
    fn: "setBlocked",
    fields: () => [{ name: "holder", label: "Titular", kind: "address", initial: actor("seller") }],
    label: (ctx, v) => (isBlocked(ctx, v.holder) ? "Desbloquear" : "Bloquear"),
    args: (v, ctx) => [tokenOf(ctx), v.holder, !isBlocked(ctx, v.holder)],
  },
  {
    id: "revertir",
    title: "Revertir a papel",
    who: "PSAV",
    roles: PSAV,
    needsToken: true,
    gated: false,
    danger: true,
    fn: "revertToPaper",
    fields: () => [
      { name: "holder", label: "Titular", kind: "address", initial: actor("seller") },
      { name: "amount", label: "Unidades", kind: "whole", initial: "1" },
      // The contract accepts an empty reference, so this form is what requires it.
      { name: "certificate", label: "Referencia del certificado", kind: "required", help: "La emite el depositario. Handoff no emite certificados." },
      { name: "docHash", label: "Hash del documento", kind: "hash", help: "Hash de ejemplo. Pegá el del documento real.", initial: EXAMPLE_DOC_HASH },
    ],
    label: () => "Revertir a papel",
    args: (v, ctx) => [tokenOf(ctx), v.holder, v.amount, v.certificate, v.docHash],
  },
  {
    id: "plataforma",
    title: "Agregar plataforma",
    who: "Emisor",
    roles: EMISOR,
    needsToken: true,
    gated: true,
    fn: "addVenue",
    fields: () => [
      { name: "venue", label: "Dirección de la plataforma", kind: "address" },
      { name: "orderKey", label: "Clave de órdenes", kind: "address" },
    ],
    label: () => "Agregar plataforma",
    args: (v, ctx) => [tokenOf(ctx), v.venue, v.orderKey],
  },
  {
    id: "reapuntar",
    title: "Re-apuntar plataforma",
    who: "Emisor o PSAV",
    roles: BOTH,
    needsToken: true,
    gated: true,
    fn: "repointVenue",
    fields: (ctx) => [
      { name: "oldVenue", label: "Plataforma actual", kind: "address", initial: ctx.token?.venues[0]?.venue ?? "" },
      { name: "newVenue", label: "Plataforma nueva", kind: "address" },
      { name: "newOrderKey", label: "Clave de órdenes nueva", kind: "address" },
    ],
    label: () => "Re-apuntar",
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
      return text ? undefined : "Completá este campo.";
    case "address":
      return isAddress(text) ? undefined : "Ingresá una dirección 0x válida.";
    case "addresses":
      return text.split(",").every((a) => isAddress(a.trim())) ? undefined : "Ingresá direcciones 0x válidas, separadas por coma.";
    case "hash":
      return isHex(text) && text.length === 66 ? undefined : "Ingresá un hash 0x de 32 bytes.";
    case "whole":
      return /^\d+$/.test(text) ? undefined : "Ingresá un número entero.";
    case "usdc":
      return /^\d{1,3}(\.\d{3})*(,\d{1,6})?$|^\d+(,\d{1,6})?$/.test(text) ? undefined : "Ingresá un monto como 2,50.";
    default:
      return undefined;
  }
}
