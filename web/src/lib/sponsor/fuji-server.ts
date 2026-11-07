import "server-only";
import { readFileSync } from "node:fs";
import { createECDSAOwnershipValidationModule, createSmartAccountClient, PaymasterMode } from "@0xgasless/smart-account";
import { createWalletClient, decodeFunctionData, erc20Abi, http, isAddress, isAddressEqual, type Address, type Hash, type Hex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { handoffSettlementAbi } from "@/lib/abi";
import { chain, chainName, publicClient } from "@/lib/chain";
import { Refused } from "@/lib/orders/service";
import { walletConfig, type WalletConfig } from "@/lib/wallet/deployment";
import { sendFrom } from "./direct";
import type { Actor, Call } from "./index";

/** Mnemonic address index per demo actor, the same table as spike/scripts/lib.ts. */
const OWNER_INDEX: Record<Actor, number> = { unverified: 2, seller: 3, buyer: 4 };
const SPONSORED = { paymasterServiceData: { mode: PaymasterMode.SPONSORED } };
const ERC6492_SUFFIX = "6492".repeat(16);

function notConfigured(what: string) {
  return new Refused("sponsor_not_configured", `Falta configurar el patrocinio: ${what}.`, 503);
}

/** Reads a secret from the file its env variable names. The contents never reach a log or an error. */
function readSecretFile(variable: "MNEMONIC_PATH" | "ZEROXGASLESS_KEY_PATH") {
  const path = process.env[variable];
  if (!path) throw notConfigured(variable);
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    throw notConfigured(variable);
  }
}

function requireConfig(): WalletConfig {
  const config = walletConfig();
  if (!config) throw notConfigured("deployment");
  return config;
}

function owner(actor: Actor) {
  return mnemonicToAccount(readSecretFile("MNEMONIC_PATH"), { addressIndex: OWNER_INDEX[actor] });
}

function ownerWallet(actor: Actor) {
  return createWalletClient({ account: owner(actor), chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
}

/** The SDK defaults are mainnet addresses, so all four are required. Values: spike/README.md, "Fuji addresses". */
function accountContracts() {
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
  const signer = ownerWallet(actor);
  const { moduleAddress, ...account } = accountContracts();
  const ecdsa = await createECDSAOwnershipValidationModule({ signer, moduleAddress } as never);
  const client = await createSmartAccountClient({
    signer,
    chainId: chain.id,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0],
    bundlerUrl: process.env.BUNDLER_URL ?? `https://bundler.0xgasless.com/${chain.id}`,
    paymasterUrl,
    index: 0,
    ...account,
    defaultValidationModule: ecdsa,
    activeValidationModule: ecdsa,
  } as never);

  const computed = (await client.getAccountAddress()) as Address;
  if (!isAddressEqual(computed, requireConfig()[actor])) {
    throw new Refused("wrong_owner", "La clave del dueño no corresponde a esta cuenta.", 503);
  }
  return client;
}

/** Runs SDK work with the keyed URL in scope. SDK errors can quote that URL and refusals are readable, so all are redacted. */
async function withPaymaster<T>(run: (paymasterUrl: string) => Promise<T>): Promise<T> {
  const key = readSecretFile("ZEROXGASLESS_KEY_PATH");
  try {
    return await run(`https://paymaster.0xgasless.com/v1/${chain.id}/rpc/${key}`);
  } catch (error) {
    if (error instanceof Refused) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Refused("sponsor_failed", `El patrocinio rechazó la operación: ${message.replaceAll(key, "<key>").slice(0, 300)}`, 502);
  }
}

async function sendSponsored(actor: "seller" | "buyer", calls: Call[], paymasterUrl: string) {
  const client = await freshClient(actor, paymasterUrl);
  const transactions = calls.map((call) => ({ to: call.to, data: call.data, value: 0n }));
  // calculateGasLimits stays unset: false estimates first, which fails with AA21 on an unfunded account.
  const response = await client.sendTransaction(transactions as never, SPONSORED as never);
  if (response.error) throw new Error(`bundler: ${response.error.message}`);

  const { receipt, success } = await response.wait();
  // success is the string "true" or "false", so a plain truthiness check would pass a failed operation.
  if (String(success) !== "true") throw new Error(`Transacción revertida: ${receipt.transactionHash}`);
  return { hash: receipt.transactionHash as Hash, userOpHash: response.userOpHash as Hash };
}

async function signDigest(actor: "seller" | "buyer", digest: Hash, paymasterUrl: string) {
  // SignatureChecker has no ERC-6492 support, so the account must exist before its signature is any use.
  const address = requireConfig()[actor];
  if (!(await publicClient.getCode({ address }))) await sendSponsored(actor, [{ to: address, data: "0x" }], paymasterUrl);

  const client = await freshClient(actor, paymasterUrl);
  // The 0x prefix matters: without it the SDK signs the text and verification fails.
  const signature = (await client.signMessage(digest)) as Hex;
  if (signature.endsWith(ERC6492_SUFFIX)) throw new Error("La cuenta todavía no está desplegada.");
  return signature;
}

function sponsoredActor(value: unknown): "seller" | "buyer" {
  if (value === "seller" || value === "buyer") return value;
  throw new Refused("sponsor_actor", "Esta cuenta no tiene patrocinio.", 403);
}

function parseCall(raw: unknown): Call {
  const { to, data } = (raw ?? {}) as { to?: unknown; data?: unknown };
  if (typeof to !== "string" || !isAddress(to) || typeof data !== "string" || !data.startsWith("0x")) {
    throw new Refused("malformed", "La llamada está mal formada.", 400);
  }
  return { to, data: data as Hex };
}

/** This route signs and spends sponsorship, so it runs only the calls the wallet makes, and nothing else. */
function assertWalletCall(call: Call, allowed: readonly string[]) {
  const { settlement, usdc } = requireConfig();
  const refused = new Refused("call_not_allowed", "El patrocinio no cubre esta operación.", 403);
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

type SponsorRequest = { action?: unknown; actor?: unknown; calls?: unknown; call?: unknown; digest?: unknown };

/** The server half of the Fuji Sponsor: signing needs the mnemonic and the paymaster key, which stay here. */
export async function runSponsorRequest(body: SponsorRequest): Promise<object> {
  if (chainName === "local") throw new Refused("not_on_local", "En la red local el patrocinio es simulado.", 404);

  if (body.action === "sendCalls") {
    const actor = sponsoredActor(body.actor);
    if (!Array.isArray(body.calls) || body.calls.length === 0) throw new Refused("malformed", "Faltan las llamadas.", 400);
    const calls = body.calls.map(parseCall);
    calls.forEach((call) => assertWalletCall(call, ["approve", "fill", "cancel"]));
    return withPaymaster((paymasterUrl) => sendSponsored(actor, calls, paymasterUrl));
  }

  if (body.action === "signDigest") {
    const actor = sponsoredActor(body.actor);
    if (typeof body.digest !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(body.digest)) throw new Refused("malformed", "El digest no es válido.", 400);
    const digest = body.digest as Hash;
    return { signature: await withPaymaster((paymasterUrl) => signDigest(actor, digest, paymasterUrl)) };
  }

  if (body.action === "direct") {
    // The refusal demo: the unverified EOA pays its own gas, so no paymaster is involved.
    if (body.actor !== "unverified") throw new Refused("sponsor_actor", "Solo la cuenta sin verificar usa esta vía.", 403);
    const call = parseCall(body.call);
    assertWalletCall(call, ["fill"]);
    const wallet = ownerWallet("unverified");
    if (!isAddressEqual(wallet.account.address, requireConfig().unverified)) {
      throw new Refused("wrong_owner", "La clave del dueño no corresponde a esta cuenta.", 503);
    }
    return sendFrom(wallet, call);
  }

  throw new Refused("malformed", "Acción desconocida.", 400);
}
