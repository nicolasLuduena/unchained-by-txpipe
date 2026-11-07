// Fork only: funds the deployer and deploys the demo accounts through the factory, so verify-1271 can be
// exercised end to end before the real sponsored deployment. Refuses to run against anything but local anvil.
import { createPublicClient, createTestClient, createWalletClient, http, parseEther } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { FUJI, ROLE, fujiSmartAccount, ownerFromMnemonic } from "./lib.ts";

if (!FUJI.rpcUrl.includes("127.0.0.1")) throw new Error("fork-seed only runs against a local fork. Set FUJI_RPC_URL.");
const transport = http(FUJI.rpcUrl);
const pub = createPublicClient({ chain: avalancheFuji, transport });
const test = createTestClient({ chain: avalancheFuji, mode: "anvil", transport });
const funder = mnemonicToAccount("test test test test test test test test test test test junk");
const wallet = createWalletClient({ account: funder, chain: avalancheFuji, transport });

await test.setBalance({ address: ownerFromMnemonic(ROLE.deployer).address, value: parseEther("1") });
for (const index of [ROLE.sellerOwner, ROLE.buyerOwner]) {
  const account = await fujiSmartAccount(ownerFromMnemonic(index));
  const data = (await account.getFactoryData()) as `0x${string}` | undefined;
  if (!data) continue;
  await pub.waitForTransactionReceipt({ hash: await wallet.sendTransaction({ to: FUJI.factory, data }) });
  console.log(`fork deployed ${await account.getAccountAddress()}`);
}
