/** JSON that keeps bigints, for server results the screens do arithmetic on. */
export function stringifyBig(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) => (typeof v === "bigint" ? { $bigint: v.toString() } : v));
}

export function parseBig<T>(text: string): T {
  return JSON.parse(text, (_, v: unknown) => {
    const big = (v as { $bigint?: unknown } | null)?.$bigint;
    return typeof big === "string" ? BigInt(big) : v;
  }) as T;
}
