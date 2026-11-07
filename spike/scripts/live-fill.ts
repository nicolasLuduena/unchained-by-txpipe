// First live fill on Fuji: seller signs, venue announces and co-signs, buyer settles [approve, fill] in one sponsored
// user operation. Needs MNEMONIC_PATH and ZEROXGASLESS_KEY_PATH. AMOUNT and PRICE override the 2 units at USDC 2.50.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PaymasterMode } from "@0xgasless/smart-account";
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi } from "viem";
import { avalancheFuji } from "viem/chains";
import { FUJI, ROLE, SPIKE_DIR, fujiSmartAccount, ownerFromMnemonic, teamPaymasterUrl } from "./lib.ts";

const dep = JSON.parse(readFileSync(resolve(SPIKE_DIR, "../deployments/fuji.json"), "utf8"));
const { HandoffSettlement: settlement, DemoToken: token, USDC: usdc } = dep.contracts;
const { venue, seller, buyer } = dep.actors;
const ORDER = "(uint256 chainId,address token,address venue,address seller,uint256 amount,uint256 price,uint256 expiry,uint256 nonce)";
const abi = parseAbi([
  `function hashOrder(${ORDER} order) view returns (bytes32)`,
  "function hashVenueFill(bytes32 orderHash, address buyer) view returns (bytes32)",
  `function announceOrder(${ORDER} order, bytes sellerSig)`,
  `function fill(${ORDER} order, bytes sellerSig, bytes venueSig)`,
]);
const erc20 = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

const transport = http(FUJI.rpcUrl);
const pub = createPublicClient({ chain: avalancheFuji, transport });
const { url: pm, redact } = teamPaymasterUrl();

async function balances() {
  const read = (a: `0x${string}`, who: `0x${string}`) => pub.readContract({ address: a, abi: erc20, functionName: "balanceOf", args: [who] });
  return {
    sellerToken: await read(token, seller), buyerToken: await read(token, buyer),
    sellerUsdc: await read(usdc, seller), buyerUsdc: await read(usdc, buyer),
    settlementToken: await read(token, settlement), settlementUsdc: await read(usdc, settlement),
  };
}

async function main() {
  const amount = BigInt(process.env.AMOUNT ?? "2");
  const price = BigInt(process.env.PRICE ?? "2500000");
  const order = {
    chainId: 43113n, token, venue, seller, amount, price,
    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), nonce: BigInt(Date.now()),
  };
  console.log("before", await balances());

  const orderHash = await pub.readContract({ address: settlement, abi, functionName: "hashOrder", args: [order] });
  const sellerAccount = await fujiSmartAccount(ownerFromMnemonic(ROLE.sellerOwner));
  const sellerSig = (await sellerAccount.signMessage(orderHash)) as `0x${string}`;

  const orderKey = ownerFromMnemonic(6);
  const wallet = createWalletClient({ account: orderKey, chain: avalancheFuji, transport });
  const announce = await wallet.writeContract({ address: settlement, abi, functionName: "announceOrder", args: [order, sellerSig] });
  await pub.waitForTransactionReceipt({ hash: announce });
  console.log("announce", `https://testnet.snowtrace.io/tx/${announce}`);

  const fillHash = await pub.readContract({ address: settlement, abi, functionName: "hashVenueFill", args: [orderHash, buyer] });
  const venueSig = await orderKey.sign({ hash: fillHash });

  const buyerAccount = await fujiSmartAccount(ownerFromMnemonic(ROLE.buyerOwner), { paymasterUrl: pm });
  const res = await buyerAccount.sendTransaction(
    [
      { to: usdc, value: 0n, data: encodeFunctionData({ abi: erc20, functionName: "approve", args: [settlement, amount * price] }) },
      { to: settlement, value: 0n, data: encodeFunctionData({ abi, functionName: "fill", args: [order, sellerSig, venueSig] }) },
    ],
    { paymasterServiceData: { mode: PaymasterMode.SPONSORED } },
  );
  if (res.error) throw new Error(`bundler refused: ${res.error.message}`);
  console.log("userOpHash", res.userOpHash);
  const { receipt, success } = await res.wait();
  const link = `https://testnet.snowtrace.io/tx/${receipt.transactionHash}`;
  console.log("fill", success, link);
  const after = await balances();
  console.log("after", after);

  mkdirSync(resolve(SPIKE_DIR, "evidence"), { recursive: true });
  writeFileSync(resolve(SPIKE_DIR, "evidence/fuji-live-fill.json"), JSON.stringify(
    { orderHash, announce, userOpHash: res.userOpHash, transactionHash: receipt.transactionHash, success, link,
      after: Object.fromEntries(Object.entries(after).map(([k, v]) => [k, v.toString()])) }, null, 2));
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : JSON.stringify(error)));
  process.exit(1);
}
