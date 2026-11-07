import { createECDSAOwnershipValidationModule, createSmartAccountClient, PaymasterMode } from "@0xgasless/smart-account";
import { isAddressEqual, type Address, type Hash, type Hex } from "viem";
import { chain, publicClient } from "@/lib/chain";
import { walletConfig } from "@/lib/wallet/deployment";
import type { Actor, Call, Sponsor } from "./index";
import { ownerWallet } from "./owner-keys";

/**
 * The SDK defaults are mainnet addresses, so all four must be set. Values: spike/README.md, "Fuji addresses".
 * Each process.env read is spelled out because Next inlines NEXT_PUBLIC variables by their literal name.
 */
function accountContracts() {
  const contracts = {
    factoryAddress: process.env.NEXT_PUBLIC_AA_FACTORY,
    implementationAddress: process.env.NEXT_PUBLIC_AA_IMPLEMENTATION,
    defaultFallbackHandler: process.env.NEXT_PUBLIC_AA_FALLBACK_HANDLER,
    moduleAddress: process.env.NEXT_PUBLIC_AA_ECDSA_MODULE,
  };
  const missing = Object.entries(contracts).filter(([, value]) => !value);
  if (missing.length) throw new Error(`Falta configurar la cuenta inteligente: ${missing.map(([name]) => name).join(", ")}`);
  return contracts;
}

const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL ?? "https://bundler.0xgasless.com/43113";
const SPONSORED = { paymasterServiceData: { mode: PaymasterMode.SPONSORED } };
const ERC6492_SUFFIX = "6492".repeat(16);

function accountAddress(actor: Actor): Address {
  const config = walletConfig();
  if (!config || actor === "unverified") throw new Error("Una cuenta sin verificar no tiene patrocinio.");
  return config[actor];
}

/**
 * Always a new client. The SDK caches NOT_DEPLOYED, so one that saw the account undeployed keeps returning
 * ERC-6492 after deployment. Both validation modules must be passed: without them nothing throws, but the
 * client silently computes a different address, so the result is checked against the deployment.
 */
async function freshClient(actor: Actor) {
  const signer = ownerWallet(actor);
  const { moduleAddress, ...account } = accountContracts();
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0];
  const ecdsa = await createECDSAOwnershipValidationModule({ signer, moduleAddress } as never);
  const client = await createSmartAccountClient({
    signer,
    chainId: chain.id,
    rpcUrl,
    bundlerUrl: BUNDLER_URL,
    // Same-origin route: the keyed paymaster URL stays on the server.
    paymasterUrl: `${window.location.origin}/api/venue/paymaster`,
    index: 0,
    ...account,
    defaultValidationModule: ecdsa,
    activeValidationModule: ecdsa,
  } as never);

  const computed = (await client.getAccountAddress()) as Address;
  if (!isAddressEqual(computed, accountAddress(actor))) {
    throw new Error("Esa clave no es la del dueño de esta cuenta.");
  }
  return client;
}

async function sendSponsored(actor: Actor, calls: Call[]): Promise<{ hash: Hash; userOpHash: Hash }> {
  const client = await freshClient(actor);
  const transactions = calls.map((call) => ({ to: call.to, data: call.data, value: call.value ?? 0n }));
  // calculateGasLimits stays unset: false estimates first, which fails with AA21 on an unfunded account.
  const response = await client.sendTransaction(transactions as never, SPONSORED as never);
  if (response.error) throw new Error(`El bundler rechazó la operación: ${response.error.message}`);

  const { receipt, success } = await response.wait();
  // success is the string "true" or "false", so a plain truthiness check would pass a failed operation.
  if (String(success) !== "true") throw new Error(`Transacción revertida: ${receipt.transactionHash}`);
  return { hash: receipt.transactionHash as Hash, userOpHash: response.userOpHash as Hash };
}

/** SignatureChecker has no ERC-6492 support, so an account must exist before its signature is any use. */
async function ensureDeployed(actor: Actor) {
  const address = accountAddress(actor);
  if (await publicClient.getCode({ address })) return;
  await sendSponsored(actor, [{ to: address, data: "0x" }]);
}

export const fujiSponsor: Sponsor = {
  sendCalls(actor, calls) {
    if (calls.length === 0) throw new Error("sendCalls needs at least one call");
    return sendSponsored(actor, calls);
  },

  async signDigest(actor, digest) {
    await ensureDeployed(actor);
    const client = await freshClient(actor);
    // The 0x prefix matters: without it the SDK signs the text and verification fails.
    const signature = (await client.signMessage(digest)) as Hex;
    if (signature.endsWith(ERC6492_SUFFIX)) throw new Error("La cuenta todavía no está desplegada.");
    return signature;
  },
};
