// On-chain refusal and reversion scenes on Fuji. The reverted transactions are sent with a fixed gas limit so they land
// on the explorer instead of failing at estimation. Needs MNEMONIC_PATH.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http, keccak256, parseAbi, toBytes } from "viem";
import { avalancheFuji } from "viem/chains";
import { FUJI, ROLE, SPIKE_DIR, fujiSmartAccount, ownerFromMnemonic } from "./lib.ts";

const dep = JSON.parse(readFileSync(resolve(SPIKE_DIR, "../deployments/fuji.json"), "utf8"));
const { HandoffSettlement: settlement, HandoffRegistry: registry, DemoToken: token } = dep.contracts;
const { venue, seller, buyer, unverified, issuer } = dep.actors;
const ORDER = "(uint256 chainId,address token,address venue,address seller,uint256 amount,uint256 price,uint256 expiry,uint256 nonce)";
const settlementAbi = parseAbi([
  `function hashOrder(${ORDER} order) view returns (bytes32)`,
  "function hashVenueFill(bytes32 orderHash, address buyer) view returns (bytes32)",
  `function fill(${ORDER} order, bytes sellerSig, bytes venueSig)`,
]);
const tokenAbi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "error ReceiverNotAttested(address receiver)",
  "error SenderNotAttested(address sender)",
  "error NotRoutedThroughVenue(address caller)",
]);
const registryAbi = parseAbi([
  "function mint(address token, address to, uint256 amount)",
  "function revertToPaper(address token, address holder, uint256 amount, string certificateRef, bytes32 docHash)",
]);
const transport = http(FUJI.rpcUrl);
const pub = createPublicClient({ chain: avalancheFuji, transport });
const client = (index: number) => { const account = ownerFromMnemonic(index); return { account, wallet: createWalletClient({ account, chain: avalancheFuji, transport }) }; };
const link = (h: string) => `https://testnet.snowtrace.io/tx/${h}`;
const out: Record<string, unknown> = {};

async function reason(args: any) {
  try { await pub.simulateContract(args); return "did not revert"; } catch (e) {
    const r = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
    return (r as any)?.data?.errorName ?? (r as any)?.signature ?? (e as Error).message.slice(0, 120);
  }
}

async function forced(name: string, index: number, args: any, abi: any) {
  const { account, wallet } = client(index);
  const why = await reason({ ...args, abi, account });
  const hash = await wallet.writeContract({ ...args, abi, gas: 400_000n });
  const { status } = await pub.waitForTransactionReceipt({ hash });
  console.log(name, status, why, link(hash));
  out[name] = { hash, status, reason: why, link: link(hash) };
}

const merged = [...settlementAbi, ...tokenAbi];
const order = { chainId: 43113n, token, venue, seller, amount: 1n, price: 2500000n, expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), nonce: BigInt(Date.now()) };
const orderHash = await pub.readContract({ address: settlement, abi: settlementAbi, functionName: "hashOrder", args: [order] });
const sellerSig = (await (await fujiSmartAccount(ownerFromMnemonic(ROLE.sellerOwner))).signMessage(orderHash)) as `0x${string}`;
const venueDigest = await pub.readContract({ address: settlement, abi: settlementAbi, functionName: "hashVenueFill", args: [orderHash, unverified] });
const venueSig = await ownerFromMnemonic(6).sign({ hash: venueDigest });

// 1. The unverified EOA fills with a valid co-signature, so the refusal comes from the token hook, not the venue check.
await forced("unverifiedFill", ROLE.unverified, { address: settlement, functionName: "fill", args: [order, sellerSig, venueSig] }, merged);

// 2. An attested holder sends directly to the unverified EOA.
const { wallet: issuerWallet } = client(ROLE.issuer);
const mint = await issuerWallet.writeContract({ address: registry, abi: registryAbi, functionName: "mint", args: [token, issuer, 1n] });
await pub.waitForTransactionReceipt({ hash: mint });
await forced("attestedDirectToUnverified", ROLE.issuer, { address: token, functionName: "transfer", args: [unverified, 1n] }, tokenAbi);

// 3. An attested holder sends directly to another attested holder, outside any venue.
await forced("attestedDirectToAttested", ROLE.issuer, { address: token, functionName: "transfer", args: [buyer, 1n] }, tokenAbi);

// 4. Reversion to paper by the PSAV, art. 16.
const { wallet: venueWallet } = client(5);
const before = await pub.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [buyer] });
const certificateRef = "DEMO-CERT-0001";
const docHash = keccak256(toBytes("Constancia de tenencia de demostracion, DEMO-CERT-0001"));
const rev = await venueWallet.writeContract({ address: registry, abi: registryAbi, functionName: "revertToPaper", args: [token, buyer, 1n, certificateRef, docHash] });
const { status } = await pub.waitForTransactionReceipt({ hash: rev });
const after = await pub.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [buyer] });
console.log("reversion", status, `buyer units ${before} -> ${after}`, link(rev));
out.reversion = { hash: rev, status, certificateRef, link: link(rev) };

mkdirSync(resolve(SPIKE_DIR, "evidence"), { recursive: true });
writeFileSync(resolve(SPIKE_DIR, "evidence/fuji-refusals.json"), JSON.stringify(out, null, 2));
process.exit(0);
