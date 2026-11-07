import type { Hash } from "viem";
import { handoffSettlementAbi } from "@/lib/abi";
import { publicClient } from "@/lib/chain";
import { reversionDigest } from "@/lib/orders/types";
import { coreContracts } from "@/lib/wallet/deployment";
import { devAccount, devWallet } from "./dev-keys";
import type { Actor, DemoActor, Sponsor } from "./index";

const RECEIPT_POLL_MS = 200;

function demoActor(actor: Actor): DemoActor {
  if (actor === "metamask") throw new Error("My wallet works only on Fuji.");
  return actor;
}

/**
 * Fake sponsorship for the local chain: signs and sends with the actor's anvil key, one transaction per call.
 * The real one batches into a single userOp. The unverified actor is refused as a real paymaster would refuse
 * an unattested account; its on-chain attempt goes through lib/sponsor/direct.ts instead.
 */
export const localSponsor: Sponsor = {
  async sendCalls(actor, calls) {
    if (actor === "unverified") throw new Error("An unverified account has no sponsorship.");
    if (calls.length === 0) throw new Error("sendCalls needs at least one call");
    const wallet = devWallet(demoActor(actor));
    let hash: Hash | undefined;
    for (const call of calls) {
      hash = await wallet.sendTransaction(call);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: RECEIPT_POLL_MS });
      if (receipt.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
    }
    return { hash: hash as Hash };
  },

  async signOrder(actor, order) {
    const address = coreContracts()?.settlement;
    if (!address) throw new Error("The contracts are not deployed yet.");
    const hash = await publicClient.readContract({ address, abi: handoffSettlementAbi, functionName: "hashOrder", args: [order] });
    return devAccount(demoActor(actor)).sign({ hash });
  },

  signReversion(actor, request) {
    return devAccount(demoActor(actor)).sign({ hash: reversionDigest(request) });
  },
};
