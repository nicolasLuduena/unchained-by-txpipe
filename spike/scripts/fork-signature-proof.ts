// Priority 1 proof on an anvil fork of Fuji. Throwaway owner keys only; nothing here touches real Fuji.
// Run: anvil --fork-url $FUJI_RPC_URL --chain-id 43113 --port 8599, then `npm run fork:sig`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSmartAccountClient } from "@0xgasless/smart-account";
import { Wallet, providers } from "ethers";
import {
  concat, createPublicClient, createTestClient, createWalletClient, decodeAbiParameters, encodeAbiParameters,
  encodeFunctionData, hashMessage, hashTypedData, http, parseAbi, parseEther, recoverAddress, size, slice, toBytes,
} from "viem";
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { FUJI, SPIKE_DIR, fujiSmartAccount } from "./lib.ts";

const RPC = process.env.FORK_RPC_URL ?? "http://127.0.0.1:8599";
const MAGIC_6492 = "0x6492649264926492649264926492649264926492649264926492649264926492";
// Anvil's public default dev account: holds fork-only balance, never real funds.
const funder = mnemonicToAccount("test test test test test test test test test test test junk");

const chain = { ...avalancheFuji, rpcUrls: { default: { http: [RPC] } } };
const pub = createPublicClient({ chain, transport: http(RPC) });
const test = createTestClient({ chain, mode: "anvil", transport: http(RPC) });
const wallet = createWalletClient({ account: funder, chain, transport: http(RPC) });

const evidence: Record<string, unknown> = {};
const log = (k: string, v: unknown) => {
  evidence[k] = v;
  console.log(k.padEnd(44), typeof v === "string" ? v : JSON.stringify(v));
};

const artifact = JSON.parse(readFileSync(resolve(SPIKE_DIR, "out/SigProbe.sol/SigProbe.json"), "utf8"));
const probeAbi = artifact.abi;
const deployTx = await wallet.deployContract({ abi: probeAbi, bytecode: artifact.bytecode.object, args: [] });
const probe = (await pub.waitForTransactionReceipt({ hash: deployTx })).contractAddress!;

const check = async (signer: `0x${string}`, digest: `0x${string}`, sig: `0x${string}`) => {
  const [direct, wrapped] = (await pub.readContract({ address: probe, abi: probeAbi, functionName: "check", args: [signer, digest, sig] })) as [boolean, boolean];
  return { direct, wrapped };
};
const unwrap = (sig: `0x${string}`) => decodeAbiParameters([{ type: "bytes" }, { type: "address" }], sig) as [`0x${string}`, `0x${string}`];
const wrap = (inner: `0x${string}`, module: `0x${string}`) => encodeAbiParameters([{ type: "bytes" }, { type: "address" }], [inner, module]);
const strip6492 = (blob: `0x${string}`) => {
  const [, , original] = decodeAbiParameters([{ type: "address" }, { type: "bytes" }, { type: "bytes" }], slice(blob, 0, size(blob) - 32));
  return original as `0x${string}`;
};

const ownerKey = generatePrivateKey();
const owner = privateKeyToAccount(ownerKey);
const account = await fujiSmartAccount(owner, { rpcUrl: RPC });
const address = (await account.getAccountAddress()) as `0x${string}`;
log("probe", probe);
log("owner (throwaway)", owner.address);
log("counterfactual", address);
log("code before deploy", (await pub.getCode({ address })) ?? "none");

const order = {
  chainId: 43113n, token: FUJI.usdc as `0x${string}`, venue: funder.address, seller: address,
  amount: 5n, price: 1_000_000n, expiry: 1_900_000_000n, nonce: 1n,
};
const typed = {
  domain: { name: "Handoff Settlement", version: "1", chainId: 43113, verifyingContract: probe },
  types: { Order: [
    { name: "chainId", type: "uint256" }, { name: "token", type: "address" }, { name: "venue", type: "address" },
    { name: "seller", type: "address" }, { name: "amount", type: "uint256" }, { name: "price", type: "uint256" },
    { name: "expiry", type: "uint256" }, { name: "nonce", type: "uint256" },
  ] },
  primaryType: "Order" as const,
  message: order,
};
const digest = hashTypedData(typed);
log("digest (viem hashTypedData)", digest);
log("digest == on-chain hashOrder", digest === (await pub.readContract({ address: probe, abi: probeAbi, functionName: "hashOrder", args: [order] })));

// --- Undeployed account
const preDeploySig = (await account.signMessage(digest)) as `0x${string}`;
log("undeployed: SDK output is ERC-6492", slice(preDeploySig, size(preDeploySig) - 32) === MAGIC_6492);
log("undeployed: SignatureChecker", await check(address, digest, preDeploySig));
const preDeployInner = strip6492(preDeploySig);
log("undeployed: stripped sig pre-deploy", await check(address, digest, preDeployInner));

// --- Deploy through the factory from a funded fork account
const factoryData = (await account.getFactoryData()) as `0x${string}`;
const deployHash = await wallet.sendTransaction({ to: FUJI.factory, data: factoryData });
log("factory deploy status", (await pub.waitForTransactionReceipt({ hash: deployHash })).status);
log("code size after deploy", size((await pub.getCode({ address }))!));

const accountAbi = parseAbi(["function isModuleEnabled(address) view returns (bool)", "function getImplementation() view returns (address)"]);
const moduleAbi = parseAbi(["function getOwner(address) view returns (address)"]);
log("deployed implementation", await pub.readContract({ address, abi: accountAbi, functionName: "getImplementation" }));
log("ECDSA module enabled", await pub.readContract({ address, abi: accountAbi, functionName: "isModuleEnabled", args: [FUJI.ecdsaModule] }));
log("module owner == throwaway owner", (await pub.readContract({ address: FUJI.ecdsaModule, abi: moduleAbi, functionName: "getOwner", args: [address] })) === owner.address);

// --- The cached client: same instance that saw the account undeployed
const staleSig = (await account.signMessage(digest)) as `0x${string}`;
log("stale client: still ERC-6492 after deploy", slice(staleSig, size(staleSig) - 32) === MAGIC_6492);
log("stale client: SignatureChecker", await check(address, digest, staleSig));
log("stale client: stripped", await check(address, digest, strip6492(staleSig)));
log("pre-deploy sig, stripped, after deploy", await check(address, digest, preDeployInner));

// --- A fresh client, the normal path
const fresh = await fujiSmartAccount(owner, { rpcUrl: RPC });
const sig = (await fresh.signMessage(digest)) as `0x${string}`;
const [inner, module] = unwrap(sig);
log("fresh client: sig bytes", size(sig));
log("fresh client: inner sig bytes", size(inner));
log("fresh client: wrapped module", module);
log("fresh client: SignatureChecker", await check(address, digest, sig));

// --- What exactly is signed
const recovered = {
  rawDigest: await recoverAddress({ hash: digest, signature: inner }),
  eip191Over32Bytes: await recoverAddress({ hash: hashMessage({ raw: digest }), signature: inner }),
  eip191OverHexString: await recoverAddress({ hash: hashMessage(digest), signature: inner }),
};
log("recovers owner: raw digest", recovered.rawDigest === owner.address);
log("recovers owner: EIP-191 over 32 bytes", recovered.eip191Over32Bytes === owner.address);
log("recovers owner: EIP-191 over hex string", recovered.eip191OverHexString === owner.address);

// --- Input shapes
const bytesSig = (await fresh.signMessage(toBytes(digest))) as `0x${string}`;
log("Uint8Array input == hex input", bytesSig === sig);
const noPrefix = (await fresh.signMessage(digest.slice(2))) as `0x${string}`;
const [noPrefixInner] = unwrap(noPrefix);
log("no-0x input: EIP-191 over the 64-char text", (await recoverAddress({ hash: hashMessage(digest.slice(2)), signature: noPrefixInner })) === owner.address);
log("no-0x input: SignatureChecker", await check(address, digest, noPrefix));

// --- Signer kinds: all must give the same bytes
const walletClientSigner = createWalletClient({ account: owner, chain, transport: http(RPC) });
const viaWalletClient = await (await fujiSmartAccount(walletClientSigner, { rpcUrl: RPC })).signMessage(digest);
log("viem WalletClient signer == local", viaWalletClient === sig);
const ethersWallet = new Wallet(ownerKey, new providers.StaticJsonRpcProvider(RPC, 43113));
const viaEthers = await (await fujiSmartAccount(ethersWallet, { rpcUrl: RPC })).signMessage(digest);
log("ethers 5 Wallet signer == local", viaEthers === sig);

// --- Typed data signed natively by the owner, wrapped by hand
const typedInner = await owner.signTypedData(typed);
log("owner signTypedData + manual wrap", await check(address, digest, wrap(typedInner, FUJI.ecdsaModule)));

// --- Negative controls
const stranger = privateKeyToAccount(generatePrivateKey());
log("neg: stranger key", await check(address, digest, wrap(await stranger.signMessage({ message: { raw: digest } }), FUJI.ecdsaModule)));
log("neg: unwrapped 65-byte sig", await check(address, digest, inner));
log("neg: wrapped with unknown module", await check(address, digest, wrap(inner, funder.address)));
log("neg: different digest", await check(address, hashMessage("other"), sig));
const noOverride = await createSmartAccountClient({
  signer: createWalletClient({ account: owner, chain, transport: http(RPC) }), chainId: 43113, rpcUrl: RPC, bundlerUrl: FUJI.bundlerUrl,
  factoryAddress: FUJI.factory, implementationAddress: FUJI.implementation, defaultFallbackHandler: FUJI.fallbackHandler,
} as any);
log("neg: client missing module override", (await noOverride.getAccountAddress().catch((e: Error) => `throws: ${e.message.slice(0, 80)}`)));

// --- EntryPoint.handleOps: SDK-built, SDK-signed op deploying a second account with one executeBatch
const owner2 = privateKeyToAccount(generatePrivateKey());
const account2 = await fujiSmartAccount(owner2, { rpcUrl: RPC });
const address2 = (await account2.getAccountAddress()) as `0x${string}`;
await test.setBalance({ address: address2, value: parseEther("1") });
const approve = encodeFunctionData({ abi: parseAbi(["function approve(address,uint256)"]), functionName: "approve", args: [probe, 123n] });
const fill = encodeFunctionData({ abi: probeAbi, functionName: "fillShape", args: [FUJI.usdc] });
const callData = (await account2.encodeExecuteBatch([FUJI.usdc, probe], [0n, 0n], [approve, fill])) as `0x${string}`;
log("executeBatch selector", slice(callData, 0, 4));
const fees = await pub.estimateFeesPerGas();
const signedOp = await account2.signUserOp({
  sender: address2, nonce: "0x0", initCode: await account2.getInitCode(), callData,
  callGasLimit: "0x7a120", verificationGasLimit: "0xf4240", preVerificationGas: "0x186a0",
  maxFeePerGas: `0x${fees.maxFeePerGas!.toString(16)}`, maxPriorityFeePerGas: `0x${fees.maxPriorityFeePerGas!.toString(16)}`,
  paymasterAndData: "0x",
} as any);
const opAbi = parseAbi([
  "struct Op { address sender; uint256 nonce; bytes initCode; bytes callData; uint256 callGasLimit; uint256 verificationGasLimit; uint256 preVerificationGas; uint256 maxFeePerGas; uint256 maxPriorityFeePerGas; bytes paymasterAndData; bytes signature; }",
  "function handleOps(Op[] ops, address beneficiary)",
]);
const big = (v: unknown) => BigInt(v as string);
const handleHash = await wallet.writeContract({
  address: FUJI.entryPoint, abi: opAbi, functionName: "handleOps", gas: 3_000_000n,
  args: [[{
    sender: address2, nonce: 0n, initCode: signedOp.initCode as `0x${string}`, callData,
    callGasLimit: big(signedOp.callGasLimit), verificationGasLimit: big(signedOp.verificationGasLimit), preVerificationGas: big(signedOp.preVerificationGas),
    maxFeePerGas: big(signedOp.maxFeePerGas), maxPriorityFeePerGas: big(signedOp.maxPriorityFeePerGas),
    paymasterAndData: "0x", signature: signedOp.signature as `0x${string}`,
  }], funder.address],
});
const handleReceipt = await pub.waitForTransactionReceipt({ hash: handleHash });
log("handleOps status", handleReceipt.status);
log("handleOps deployed account", size((await pub.getCode({ address: address2 })) ?? "0x") > 0);
const fillTopic = handleReceipt.logs.find((l) => l.address.toLowerCase() === probe.toLowerCase());
log("batch: fill saw allowance from approve", fillTopic ? BigInt(fillTopic.data) === 123n : false);
const sig2 = (await (await fujiSmartAccount(owner2, { rpcUrl: RPC })).signMessage(digest)) as `0x${string}`;
log("handleOps account: SignatureChecker", await check(address2, digest, sig2));

mkdirSync(resolve(SPIKE_DIR, "evidence"), { recursive: true });
writeFileSync(resolve(SPIKE_DIR, "evidence/fork-signature-proof.json"), `${JSON.stringify(evidence, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2)}\n`);
void concat;
