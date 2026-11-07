// Verifies an SDK signature over an order digest through OpenZeppelin SignatureChecker, on Fuji.
// Needs MNEMONIC_PATH and deployed accounts (run deploy-accounts first). Deploys SigProbe from the
// deployer (mnemonic index 0, faucet AVAX) unless SIGPROBE_ADDRESS is set.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, createWalletClient, hashTypedData, http } from "viem";
import { avalancheFuji } from "viem/chains";
import { FUJI, ROLE, SPIKE_DIR, fujiSmartAccount, ownerFromMnemonic } from "./lib.ts";

const transport = http(FUJI.rpcUrl);
const pub = createPublicClient({ chain: avalancheFuji, transport });
const artifact = JSON.parse(readFileSync(resolve(SPIKE_DIR, "out/SigProbe.sol/SigProbe.json"), "utf8"));

async function probeAddress(): Promise<`0x${string}`> {
  if (process.env.SIGPROBE_ADDRESS) return process.env.SIGPROBE_ADDRESS as `0x${string}`;
  const deployer = ownerFromMnemonic(ROLE.deployer);
  if ((await pub.getBalance({ address: deployer.address })) === 0n) {
    throw new Error(`${deployer.address} has no AVAX. Use the faucet, or set SIGPROBE_ADDRESS.`);
  }
  const wallet = createWalletClient({ account: deployer, chain: avalancheFuji, transport });
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [] });
  const { contractAddress } = await pub.waitForTransactionReceipt({ hash });
  console.log(`SigProbe deployed: ${contractAddress} https://testnet.snowtrace.io/tx/${hash}`);
  return contractAddress!;
}

const probe = await probeAddress();
let failed = 0;

for (const [role, index] of [["seller", ROLE.sellerOwner], ["buyer", ROLE.buyerOwner]] as const) {
  const owner = ownerFromMnemonic(index);
  // A fresh client per signature: a client that saw the account undeployed keeps returning ERC-6492.
  const account = await fujiSmartAccount(owner);
  const seller = (await account.getAccountAddress()) as `0x${string}`;
  if (!(await pub.getCode({ address: seller }))) throw new Error(`account ${role} ${seller} is not deployed. Run deploy-accounts.`);

  const order = {
    chainId: 43113n, token: FUJI.usdc as `0x${string}`, venue: seller, seller,
    amount: 1n, price: 1_000_000n, expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), nonce: BigInt(Date.now()),
  };
  const digest = hashTypedData({
    domain: { name: "Handoff Settlement", version: "1", chainId: 43113, verifyingContract: probe },
    types: { Order: [
      { name: "chainId", type: "uint256" }, { name: "token", type: "address" }, { name: "venue", type: "address" },
      { name: "seller", type: "address" }, { name: "amount", type: "uint256" }, { name: "price", type: "uint256" },
      { name: "expiry", type: "uint256" }, { name: "nonce", type: "uint256" },
    ] },
    primaryType: "Order",
    message: order,
  });
  const sig = (await account.signMessage(digest)) as `0x${string}`;
  const [direct, wrapped] = (await pub.readContract({ address: probe, abi: artifact.abi, functionName: "check", args: [seller, digest, sig] })) as [boolean, boolean];
  const [tampered] = (await pub.readContract({ address: probe, abi: artifact.abi, functionName: "check", args: [seller, `0x${"00".repeat(32)}`, sig] })) as [boolean, boolean];
  if (!direct || tampered) failed++;
  console.log(`account ${role} ${seller} digest ${digest} direct=${direct} wrapped=${wrapped} wrongDigest=${tampered}`);
}
process.exit(failed ? 1 : 0);
