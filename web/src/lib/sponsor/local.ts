import type { Hash } from "viem";
import { handoffSettlementAbi } from "@/lib/abi";
import { publicClient } from "@/lib/chain";
import { reversionDigest } from "@/lib/orders/types";
import { coreContracts } from "@/lib/wallet/deployment";
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

  async signOrder(actor, order) {
    const address = coreContracts()?.settlement;
    if (!address) throw new Error("Los contratos todavía no están desplegados.");
    const hash = await publicClient.readContract({ address, abi: handoffSettlementAbi, functionName: "hashOrder", args: [order] });
    return devAccount(actor).sign({ hash });
  },

  signReversion(actor, request) {
    return devAccount(actor).sign({ hash: reversionDigest(request) });
  },
};
