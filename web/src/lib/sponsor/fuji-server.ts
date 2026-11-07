import "server-only";
import { createECDSAOwnershipValidationModule, createSmartAccountClient, PaymasterMode } from "@0xgasless/smart-account";
import { createWalletClient, decodeFunctionData, erc20Abi, http, isAddress, isAddressEqual, type Account, type Address, type Chain, type Hash, type Hex, type Transport, type WalletClient } from "viem";
import { mnemonicToAccount, toAccount } from "viem/accounts";
import { handoffSettlementAbi } from "@/lib/abi";
import { chain, chainName, publicClient } from "@/lib/chain";
import { assertPostable, assertRequestable, hashOrder, parseAddress, parseOrder, parseUint, Refused } from "@/lib/orders/service";
import { reversionDigest, type WireOrder } from "@/lib/orders/types";
import { readSecret } from "@/lib/secrets";
import { walletConfig, type WalletConfig } from "@/lib/wallet/deployment";
import { sendFrom } from "./direct";
import type { Call, DemoActor } from "./index";
import { withinRate } from "@/lib/onboard/limits";

/** Mnemonic address index per demo actor, the same table as spike/scripts/lib.ts. */
const OWNER_INDEX: Record<DemoActor, number> = { unverified: 2, seller: 3, buyer: 4 };
const SPONSORED = { paymasterServiceData: { mode: PaymasterMode.SPONSORED } };
const ERC6492_SUFFIX = "6492".repeat(16);

function notConfigured(what: string) {
  return new Refused("sponsor_not_configured", `Sponsorship is not configured: ${what}.`, 503);
}

function requireSecret(name: "MNEMONIC" | "ZEROXGASLESS_KEY") {
  const secret = readSecret(name);
  if (!secret) throw notConfigured(name);
  return secret;
}

export function requireConfig(): WalletConfig {
  const config = walletConfig();
  if (!config) throw notConfigured("deployment");
  return config;
}

function owner(actor: DemoActor) {
  return mnemonicToAccount(requireSecret("MNEMONIC"), { addressIndex: OWNER_INDEX[actor] });
}

function ownerWallet(actor: DemoActor) {
  return createWalletClient({ account: owner(actor), chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
}

/** The SDK defaults are mainnet addresses, so all four are required. Values: spike/README.md, "Fuji addresses". */
export function accountContracts() {
  const { AA_FACTORY, AA_IMPLEMENTATION, AA_FALLBACK_HANDLER, AA_ECDSA_MODULE } = process.env;
  if (!AA_FACTORY || !AA_IMPLEMENTATION || !AA_FALLBACK_HANDLER || !AA_ECDSA_MODULE) throw notConfigured("AA_*");
  return { factoryAddress: AA_FACTORY, implementationAddress: AA_IMPLEMENTATION, defaultFallbackHandler: AA_FALLBACK_HANDLER, moduleAddress: AA_ECDSA_MODULE };
}

/**
 * Ported from fujiSmartAccount in spike/scripts/lib.ts, with the addresses read from env. Always a new client:
 * the SDK caches NOT_DEPLOYED, so one that saw the account undeployed keeps returning ERC-6492 afterwards.
 * Both modules must be passed, or the client silently computes another address; the result is checked for that.
 */
async function freshClient(actor: "seller" | "buyer", paymasterUrl: string) {
  const client = await buildClient(ownerWallet(actor), paymasterUrl);
  const computed = (await client.getAccountAddress()) as Address;
  if (!isAddressEqual(computed, requireConfig()[actor])) {
    throw new Refused("wrong_owner", "The owner key does not match this account.", 503);
  }
  return client;
}

async function buildClient(signer: WalletClient<Transport, Chain, Account>, paymasterUrl?: string) {
  const { moduleAddress, ...account } = accountContracts();
  const ecdsa = await createECDSAOwnershipValidationModule({ signer, moduleAddress } as never);
  const client = await createSmartAccountClient({
    signer,
    chainId: chain.id,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0],
    bundlerUrl: bundlerUrl(),
    paymasterUrl,
    index: 0,
    ...account,
    defaultValidationModule: ecdsa,
    activeValidationModule: ecdsa,
  } as never);
  return client;
}

export function bundlerUrl() {
  return process.env.BUNDLER_URL ?? `https://bundler.0xgasless.com/${chain.id}`;
}

/** The team key at this mnemonic index: 0 is the deployer and the store's verifier, 1 the issuer. */
export function teamWallet(addressIndex: number) {
  return createWalletClient({ account: mnemonicToAccount(requireSecret("MNEMONIC"), { addressIndex }), chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
}

/** The smart account a visitor's EOA owns, read through the SDK so it matches the browser's client. It can never sign. */
export async function ownedAccount(ownerAddress: Address): Promise<{ address: Address; initCode: Hex }> {
  const refuse = async (): Promise<never> => {
    throw new Error("This account is watch-only.");
  };
  const account = toAccount({ address: ownerAddress, signMessage: refuse, signTransaction: refuse, signTypedData: refuse });
  const client = await buildClient(createWalletClient({ account, chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) }));
  return { address: (await client.getAccountAddress()) as Address, initCode: (await client.getAccountInitCode()) as Hex };
}

/** Runs SDK work with the keyed URL in scope. SDK errors can quote that URL and refusals are readable, so all are redacted. */
export async function withPaymaster<T>(run: (paymasterUrl: string) => Promise<T>): Promise<T> {
  const key = requireSecret("ZEROXGASLESS_KEY");
  try {
    return await run(`https://paymaster.0xgasless.com/v1/${chain.id}/rpc/${key}`);
  } catch (error) {
    if (error instanceof Refused) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Refused("sponsor_failed", `Sponsorship refused the operation: ${message.replaceAll(key, "<key>").slice(0, 300)}`, 502);
  }
}

export async function sendSponsored(actor: "seller" | "buyer", calls: Call[], paymasterUrl: string) {
  const client = await freshClient(actor, paymasterUrl);
  const transactions = calls.map((call) => ({ to: call.to, data: call.data, value: 0n }));
  // calculateGasLimits stays unset: false estimates first, which fails with AA21 on an unfunded account.
  const response = await client.sendTransaction(transactions as never, SPONSORED as never);
  if (response.error) throw new Error(`bundler: ${response.error.message}`);

  const { receipt, success } = await response.wait();
  // success is the string "true" or "false", so a plain truthiness check would pass a failed operation.
  if (String(success) !== "true") throw new Error(`Transaction reverted: ${receipt.transactionHash}`);
  return { hash: receipt.transactionHash as Hash, userOpHash: response.userOpHash as Hash };
}

async function signDigest(actor: "seller" | "buyer", digest: Hash, paymasterUrl: string) {
  // SignatureChecker has no ERC-6492 support, so the account must exist before its signature is any use.
  const address = requireConfig()[actor];
  if (!(await publicClient.getCode({ address }))) await sendSponsored(actor, [{ to: address, data: "0x" }], paymasterUrl);

  const client = await freshClient(actor, paymasterUrl);
  // The 0x prefix matters: without it the SDK signs the text and verification fails.
  const signature = (await client.signMessage(digest)) as Hex;
  if (signature.endsWith(ERC6492_SUFFIX)) throw new Error("The account is not deployed yet.");
  return signature;
}

function sponsoredActor(value: unknown): "seller" | "buyer" {
  if (value === "seller" || value === "buyer") return value;
  throw new Refused("sponsor_actor", "This account has no sponsorship.", 403);
}

function parseCall(raw: unknown): Call {
  const { to, data } = (raw ?? {}) as { to?: unknown; data?: unknown };
  if (typeof to !== "string" || !isAddress(to) || typeof data !== "string" || !data.startsWith("0x")) {
    throw new Refused("malformed", "The call is malformed.", 400);
  }
  return { to, data: data as Hex };
}

/** This route signs and spends sponsorship, so it runs only the calls the wallet makes, and nothing else. */
function assertWalletCall(call: Call, allowed: readonly string[]) {
  const { settlement, usdc } = requireConfig();
  const refused = new Refused("call_not_allowed", "Sponsorship does not cover this operation.", 403);
  try {
    if (isAddressEqual(call.to, usdc)) {
      const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: call.data });
      if (functionName === "approve" && allowed.includes("approve") && isAddressEqual(args[0], settlement)) return;
    } else if (isAddressEqual(call.to, settlement)) {
      if (allowed.includes(decodeFunctionData({ abi: handoffSettlementAbi, data: call.data }).functionName)) return;
    }
  } catch {
    throw refused;
  }
  throw refused;
}

/** The digest of a real order from this actor, for the token and venue of this deployment. Nothing else gets signed. */
async function orderDigest(actor: "seller" | "buyer", raw: Partial<WireOrder> | undefined): Promise<Hash> {
  const config = requireConfig();
  const order = parseOrder(raw);
  const context = { address: order.seller };
  if (!isAddressEqual(order.seller, config[actor])) throw new Refused("not_your_order", "This order does not belong to this account.", 403, context);
  if (!isAddressEqual(order.token, config.token)) throw new Refused("unknown_token", "This token is not registered.", 422, context);
  if (!isAddressEqual(order.venue, config.venue)) throw new Refused("unknown_venue", "This order belongs to another venue.", 422, context);
  await assertPostable(order);
  return hashOrder(order);
}

/** The digest of this actor's own reversion request. The holder comes from the actor, never from the caller. */
async function reversionRequestDigest(actor: "seller" | "buyer", body: SponsorRequest): Promise<Hash> {
  const config = requireConfig();
  const request = {
    chainId: BigInt(chain.id),
    token: parseAddress(body.token, "token"),
    holder: config[actor],
    amount: parseUint(body.amount, "amount"),
    requestedAt: parseUint(body.requestedAt, "requestedAt"),
  };
  if (!isAddressEqual(request.token, config.token)) throw new Refused("unknown_token", "This token is not registered.", 422, { address: request.holder });
  await assertRequestable(request);
  return reversionDigest(request);
}

type SponsorRequest = {
  action?: unknown;
  actor?: unknown;
  calls?: unknown;
  call?: unknown;
  order?: Partial<WireOrder>;
  token?: unknown;
  amount?: unknown;
  requestedAt?: unknown;
};

const MAX_CALLS = 3;
const SPONSORED_PER_MINUTE = 20;
const DIRECT_PER_MINUTE = 10;

async function assertWithinRate(name: string, limit: number) {
  if (!(await withinRate(name, limit, 60_000))) throw new Refused("rate_limited", "Too many operations. Try again in a minute.", 429);
}

/** The server half of the Fuji Sponsor: signing needs the mnemonic and the paymaster key, which stay here. */
export async function runSponsorRequest(body: SponsorRequest): Promise<object> {
  if (chainName === "local") throw new Refused("not_on_local", "On the local network, sponsorship is simulated.", 404);

  if (body.action === "sendCalls") {
    const actor = sponsoredActor(body.actor);
    if (!Array.isArray(body.calls) || body.calls.length === 0) throw new Refused("malformed", "The calls are missing.", 400);
    if (body.calls.length > MAX_CALLS) throw new Refused("malformed", "Too many calls in one operation.", 400);
    await assertWithinRate(`sponsor:${actor}`, SPONSORED_PER_MINUTE);
    const calls = body.calls.map(parseCall);
    calls.forEach((call) => assertWalletCall(call, ["approve", "fill", "cancel"]));
    return withPaymaster((paymasterUrl) => sendSponsored(actor, calls, paymasterUrl));
  }

  if (body.action === "signOrder" || body.action === "signReversion") {
    const actor = sponsoredActor(body.actor);
    const digest = await (body.action === "signOrder" ? orderDigest(actor, body.order) : reversionRequestDigest(actor, body));
    return { signature: await withPaymaster((paymasterUrl) => signDigest(actor, digest, paymasterUrl)) };
  }

  if (body.action === "direct") {
    // The refusal demo: the unverified EOA pays its own gas, so no paymaster is involved.
    if (body.actor !== "unverified") throw new Refused("sponsor_actor", "Only the unverified account uses this path.", 403);
    await assertWithinRate("direct", DIRECT_PER_MINUTE);
    const call = parseCall(body.call);
    assertWalletCall(call, ["fill"]);
    const wallet = ownerWallet("unverified");
    if (!isAddressEqual(wallet.account.address, requireConfig().unverified)) {
      throw new Refused("wrong_owner", "The owner key does not match this account.", 503);
    }
    return sendFrom(wallet, call);
  }

  throw new Refused("malformed", "Unknown action.", 400);
}
