import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createECDSAOwnershipValidationModule, createSmartAccountClient } from "@0xgasless/smart-account";
import { config as loadEnv } from "dotenv";
import { mnemonicToAccount } from "viem/accounts";

export const SPIKE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(SPIKE_DIR, ".env") });

/** Every Fuji address the spike touches. Source: core 1.3.0 AVALANCHE_FUJI, spec, KUMPLY SDK README. */
export const FUJI = {
  chainId: 43113,
  rpcUrl: process.env.FUJI_RPC_URL ?? "https://api.avax-test.network/ext/bc/C/rpc",
  bundlerUrl: "https://bundler.0xgasless.com/43113",
  entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  verifyingPaymaster: "0xC68dAd686fcAe526dB286d84E1Fc8aDdc7b2FE98",
  factory: "0xF0b3f5146c2725e36d78F5029bc560eDfc67ADe0",
  implementation: "0x8aF33bE7af021A6075aeB19b076fC75Bfbd2c5c3",
  fallbackHandler: "0xdA62055b0730d1d0621aD0A446DcD6057a6d951E",
  ecdsaModule: "0xcfb0BA514aa398085D63eC70cfEa6EC7f1094E8F",
  kumplyStore: "0xa3Bc5564A18e107807aF41fF2a5215Db050b22dD",
  usdc: "0x5425890298aed601595a70AB815c96711a31Bc65",
} as const;

/** Mnemonic address index per demo role. Smart accounts are SDK index 0 of owners 3 and 4. */
export const ROLE = { deployer: 0, issuer: 1, unverified: 2, sellerOwner: 3, buyerOwner: 4, venuePsav: 5, venueOrderKey: 6 } as const;

/** Reads the team key from ZEROXGASLESS_KEY_PATH at runtime. Never log the returned URL: it embeds the key. */
export function teamPaymasterUrl() {
  const key = readFileSync(requireEnv("ZEROXGASLESS_KEY_PATH"), "utf8").trim();
  return { url: `https://paymaster.0xgasless.com/v1/43113/rpc/${key}`, redact: (text: string) => text.replaceAll(key, "<key>") };
}

/** The Fuji overrides. Omitting defaultValidationModule silently wraps signatures with the mainnet module. */
export async function fujiSmartAccount(signer: any, opts: { rpcUrl?: string; paymasterUrl?: string; bundlerUrl?: string; index?: number } = {}) {
  const rpcUrl = opts.rpcUrl ?? FUJI.rpcUrl;
  const moduleSigner = signer?.type === "local" ? await asWalletClient(signer, rpcUrl) : signer;
  const ecdsa = await createECDSAOwnershipValidationModule({ signer: moduleSigner, moduleAddress: FUJI.ecdsaModule });
  return createSmartAccountClient({
    signer: moduleSigner,
    chainId: FUJI.chainId,
    rpcUrl,
    bundlerUrl: opts.bundlerUrl ?? FUJI.bundlerUrl,
    paymasterUrl: opts.paymasterUrl,
    index: opts.index ?? 0,
    factoryAddress: FUJI.factory,
    implementationAddress: FUJI.implementation,
    defaultFallbackHandler: FUJI.fallbackHandler,
    defaultValidationModule: ecdsa,
    activeValidationModule: ecdsa,
  } as any);
}

async function asWalletClient(account: any, rpcUrl: string) {
  const { createWalletClient, http } = await import("viem");
  const { avalancheFuji } = await import("viem/chains");
  return createWalletClient({ account, chain: avalancheFuji, transport: http(rpcUrl) });
}

/** Reads the mnemonic from MNEMONIC_PATH at runtime. The phrase is never logged or returned. */
export function ownerFromMnemonic(addressIndex: number) {
  const path = process.env.MNEMONIC_PATH;
  if (!path) throw new Error("MNEMONIC_PATH is not set. See spike/.env.example.");
  return mnemonicToAccount(readFileSync(path, "utf8").trim(), { addressIndex });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. See spike/.env.example.`);
  return value;
}
