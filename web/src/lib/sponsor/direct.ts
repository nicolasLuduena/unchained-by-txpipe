import type { Account, Chain, Hash, Transport, WalletClient } from "viem";
import { chainName, publicClient } from "@/lib/chain";
import { venue } from "@/lib/orders/client";
import { revertReason } from "@/lib/wallet/revert-reason";
import type { Actor, Call } from "./index";

/** Fixed, so the transaction skips estimation and lands on-chain even though it reverts. */
const DIRECT_GAS = 600_000n;
const RECEIPT_POLL_MS = chainName === "local" ? 200 : 1000;

export type DirectResult = { hash: Hash; reverted: boolean; reason?: string };

/** Sends from a plain EOA, and names the revert if there is one. */
export async function sendFrom(wallet: WalletClient<Transport, Chain, Account>, call: Call): Promise<DirectResult> {
  const hash = await wallet.sendTransaction({ ...call, gas: DIRECT_GAS });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: RECEIPT_POLL_MS });
  if (receipt.status === "success") return { hash, reverted: false };

  // A receipt carries no reason, so the call is replayed at its block to read the named error.
  const reason = await publicClient
    .call({ account: wallet.account.address, to: call.to, data: call.data, blockNumber: receipt.blockNumber })
    .then(() => "Revertida sin motivo informado")
    .catch(revertReason);
  return { hash, reverted: true, reason };
}

/** An unsponsored transaction the actor pays for: the refusal demo, where a revert with a hash is the point. */
export async function sendDirect(actor: Actor, call: Call): Promise<DirectResult> {
  if (chainName === "local") return sendFrom((await import("./dev-keys")).devWallet(actor), call);
  return venue.sponsor<DirectResult>({ action: "direct", actor, call });
}
