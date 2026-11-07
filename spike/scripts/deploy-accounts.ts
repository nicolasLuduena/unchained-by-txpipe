// First sponsored user operation for the two demo accounts: a 0-value self call, which also deploys the account.
// Needs MNEMONIC_PATH and ZEROXGASLESS_KEY_PATH. Add `-- --dry` to ask the paymaster without sending.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PaymasterMode } from "@0xgasless/smart-account";
import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";
import { FUJI, ROLE, SPIKE_DIR, fujiSmartAccount, ownerFromMnemonic, teamPaymasterUrl } from "./lib.ts";

const dry = process.argv.includes("--dry");
const { url: pm, redact } = teamPaymasterUrl();
const pub = createPublicClient({ chain: avalancheFuji, transport: http(FUJI.rpcUrl) });
const sponsored = { paymasterServiceData: { mode: PaymasterMode.SPONSORED } };
const results: Record<string, unknown>[] = [];

async function main() {
  for (const [role, index] of [["seller", ROLE.sellerOwner], ["buyer", ROLE.buyerOwner]] as const) {
    const owner = ownerFromMnemonic(index);
    const account = await fujiSmartAccount(owner, { paymasterUrl: pm });
    const address = (await account.getAccountAddress()) as `0x${string}`;
    console.log(`${role} account ${address} (owner ${owner.address})`);

    if (await pub.getCode({ address })) {
      console.log("  already deployed, skipping");
      results.push({ role, address, owner: owner.address, alreadyDeployed: true });
      continue;
    }
    const tx = { to: address, data: "0x" as const, value: 0n };
    if (dry) {
      const op = await account.buildUserOp([tx], sponsored);
      console.log(`  paymaster signed ${((op.paymasterAndData as string).length - 2) / 2} bytes. Nothing was sent.`);
      continue;
    }
    const res = await account.sendTransaction(tx, sponsored);
    if (res.error) throw new Error(`bundler refused: ${res.error.message}`);
    console.log(`  userOpHash ${res.userOpHash}`);
    const { receipt, success } = await res.wait();
    const link = `https://testnet.snowtrace.io/tx/${receipt.transactionHash}`;
    console.log(`  success=${success} ${link}`);
    results.push({ role, address, owner: owner.address, userOpHash: res.userOpHash, transactionHash: receipt.transactionHash, link, success });
  }
}

try {
  await main();
} catch (error) {
  // SDK errors can quote the paymaster URL, which embeds the key.
  console.error(redact(error instanceof Error ? error.message : JSON.stringify(error)));
  process.exitCode = 1;
}
if (!dry && results.length) {
  mkdirSync(resolve(SPIKE_DIR, "evidence"), { recursive: true });
  writeFileSync(resolve(SPIKE_DIR, "evidence/fuji-accounts.json"), `${JSON.stringify(results, null, 2)}\n`);
}
