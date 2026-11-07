import { formatUnits, parseUnits } from "viem";

const AR_TIME = { timeZone: "America/Argentina/Buenos_Aires", hour12: false } as const;
const thousands = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** USDC base units to "3.418,00". */
export function usdc(base: bigint): string {
  const [whole, fraction = ""] = formatUnits(base, 6).split(".");
  return `${thousands(whole)},${fraction.padEnd(2, "0")}`;
}

/** "3.418,00" or "2,5" to USDC base units. */
export function parseUsdc(text: string): bigint {
  return parseUnits(text.trim().replace(/\./g, "").replace(",", "."), 6);
}

export function units(amount: bigint): string {
  return thousands(amount.toString());
}

export function share(part: bigint, total: bigint): string {
  if (total === 0n) return "0,00 %";
  const hundredths = (part * 10_000n) / total;
  return `${thousands((hundredths / 100n).toString())},${(hundredths % 100n).toString().padStart(2, "0")} %`;
}

export function clock(seconds: number): string {
  return new Intl.DateTimeFormat("es-AR", { ...AR_TIME, hour: "2-digit", minute: "2-digit" }).format(seconds * 1000);
}

export function fullTime(seconds: number): string {
  const { timeZone } = AR_TIME;
  return new Intl.DateTimeFormat("es-AR", { timeZone, hourCycle: "h23", dateStyle: "short", timeStyle: "medium" }).format(seconds * 1000);
}

export function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
