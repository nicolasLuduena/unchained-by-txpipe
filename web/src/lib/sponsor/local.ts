import type { Hash } from "viem";
import { publicClient } from "@/lib/chain";
import { devAccount, devWallet } from "./dev-keys";
import type { Sponsor } from "./index";

const RECEIPT_POLL_MS = 200;

/**
 * Fake sponsorship for the local chain: signs and sends with the actor's anvil key, one transaction per call.
 * The real one batches into a single userOp. The unverified actor is refused as a real paymaster would refuse
 * an unattested account; its on-chain attempt goes through lib/sponsor/direct.ts instead.
 */
export const localSponsor: Sponsor = {
  async sendCalls(actor, calls) {
    if (actor === "unverified") throw new Error("Una cuenta sin verificar no tiene patrocinio.");
    if (calls.length === 0) throw new Error("sendCalls needs at least one call");
    const wallet = devWallet(actor);
    let hash: Hash | undefined;
    for (const call of calls) {
      hash = await wallet.sendTransaction(call);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: RECEIPT_POLL_MS });
      if (receipt.status !== "success") throw new Error(`Transacción revertida: ${hash}`);
    }
    return { hash: hash as Hash };
  },

  signDigest(actor, digest) {
    return devAccount(actor).sign({ hash: digest });
  },
};
