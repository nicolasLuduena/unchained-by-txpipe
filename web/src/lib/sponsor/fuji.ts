import { createECDSAOwnershipValidationModule, createSmartAccountClient, PaymasterMode } from "@0xgasless/smart-account";
import { isAddressEqual, type Address, type Hash, type Hex } from "viem";
import { publicClient } from "@/lib/chain";
import { walletConfig } from "@/lib/wallet/deployment";
import type { Actor, Call, Sponsor } from "./index";
import { ownerWallet } from "./owner-keys";

/** Fuji overrides from spike/README.md. The SDK defaults are mainnet addresses. */
const FUJI_ACCOUNT = {
  chainId: 43113,
  factoryAddress: "0xF0b3f5146c2725e36d78F5029bc560eDfc67ADe0",
  implementationAddress: "0x8aF33bE7af021A6075aeB19b076fC75Bfbd2c5c3",
  defaultFallbackHandler: "0xdA62055b0730d1d0621aD0A446DcD6057a6d951E",
  ecdsaModule: "0xcfb0BA514aa398085D63eC70cfEa6EC7f1094E8F",
} as const;

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
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? publicClient.chain.rpcUrls.default.http[0];
  const ecdsa = await createECDSAOwnershipValidationModule({ signer, moduleAddress: FUJI_ACCOUNT.ecdsaModule } as never);
  const client = await createSmartAccountClient({
    signer,
    chainId: FUJI_ACCOUNT.chainId,
    rpcUrl,
    bundlerUrl: BUNDLER_URL,
    // Same-origin route: the keyed paymaster URL stays on the server.
    paymasterUrl: `${window.location.origin}/api/venue/paymaster`,
    index: 0,
    factoryAddress: FUJI_ACCOUNT.factoryAddress,
    implementationAddress: FUJI_ACCOUNT.implementationAddress,
    defaultFallbackHandler: FUJI_ACCOUNT.defaultFallbackHandler,
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
