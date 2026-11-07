import { BaseError, decodeErrorResult, type Hex } from "viem";
import { handoffRegistryAbi, handoffSettlementAbi, handoffTokenAbi } from "@/lib/abi";

/** Every custom error a fill can bubble up, so a revert reads by name. */
export const revertAbi = [...handoffSettlementAbi, ...handoffTokenAbi, ...handoffRegistryAbi];

function findRevertData(error: unknown): Hex | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const found = error.walk((e) => typeof (e as { data?: unknown }).data === "string") as { data?: unknown } | null;
  const data = found?.data;
  return typeof data === "string" && data.startsWith("0x") ? (data as Hex) : undefined;
}

/** Names a revert: `ReceiverNotAttested(0x…)`. Falls back to the error's own short message. */
export function revertReason(error: unknown): string {
  const data = findRevertData(error);
  if (data) {
    try {
      const decoded = decodeErrorResult({ abi: revertAbi, data });
      return `${decoded.errorName}(${(decoded.args ?? []).map(String).join(", ")})`;
    } catch {
      return data;
    }
  }
  if (error instanceof BaseError) return error.shortMessage;
  return error instanceof Error ? error.message : String(error);
}
