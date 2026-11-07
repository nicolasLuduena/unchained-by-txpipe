import { erc20Abi, type Address, type Hash } from "viem";
import { handoffRegistryAbi } from "@/lib/abi";
import { publicClient } from "@/lib/chain";
import { bandLimits } from "./band";
import type { WalletConfig } from "./deployment";

export type Snapshot = {
  tokenName: string;
  tokenSymbol: string;
  tokens: bigint;
  usdc: bigint;
  reference: bigint;
  low: bigint;
  high: bigint;
  blocked: boolean;
  paused: boolean;
  depositRef: string;
  cnvAuthRef: string;
  issuanceDocHash: Hash;
};

/** One holder's view of the token, read straight from the chain. */
export async function readSnapshot(config: WalletConfig, account: Address): Promise<Snapshot> {
  const registry = { address: config.registry, abi: handoffRegistryAbi } as const;
  const token = { address: config.token, abi: erc20Abi } as const;
  const [tokenName, tokenSymbol, tokens, usdc, band, info, blocked] = await Promise.all([
    publicClient.readContract({ ...token, functionName: "name" }),
    publicClient.readContract({ ...token, functionName: "symbol" }),
    publicClient.readContract({ ...token, functionName: "balanceOf", args: [account] }),
    publicClient.readContract({ address: config.usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
    publicClient.readContract({ ...registry, functionName: "band", args: [config.token] }),
    publicClient.readContract({ ...registry, functionName: "tokenInfo", args: [config.token] }),
    publicClient.readContract({ ...registry, functionName: "isBlocked", args: [config.token, account] }),
  ]);
  return {
    tokenName,
    tokenSymbol,
    tokens,
    usdc,
    reference: band.price,
    ...bandLimits(band, info.floor),
    blocked,
    paused: info.paused,
    depositRef: info.depositRef,
    cnvAuthRef: info.cnvAuthRef,
    issuanceDocHash: info.issuanceDocHash,
  };
}
