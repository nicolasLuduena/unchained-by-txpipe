import { parseUnits } from "viem";

const USDC_DECIMALS = 6;

function groupThousands(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** `3.418,00`: decimal comma, dot for thousands, at least two decimals and never a rounded figure. */
export function formatUsdc(base: bigint): string {
  const padded = base.toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = padded.slice(0, -USDC_DECIMALS);
  const fraction = padded.slice(-USDC_DECIMALS).replace(/0+$/, "").padEnd(2, "0");
  return `${groupThousands(whole)},${fraction}`;
}

export function formatCount(units: bigint): string {
  return groupThousands(units.toString());
}

export function tokensLabel(units: bigint): string {
  return `${formatCount(units)} ${units === 1n ? "token" : "tokens"}`;
}

export function usdcToNumber(base: bigint): number {
  return Number(base) / 10 ** USDC_DECIMALS;
}

/** Reads `112,50`, `1.112,50` or `112.50`. Null when the text is not a price. */
export function parseUsdc(text: string): bigint | null {
  const trimmed = text.trim();
  const isGrouped = /^\d{1,3}(\.\d{3})+$/.test(trimmed);
  const normalized = trimmed.includes(",") ? trimmed.replaceAll(".", "").replace(",", ".") : isGrouped ? trimmed.replaceAll(".", "") : trimmed;
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) return null;
  return parseUnits(normalized, USDC_DECIMALS);
}

/** A whole number of tokens. Null otherwise: units are indivisible. */
export function parseTokens(text: string): bigint | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? BigInt(trimmed) : null;
}
