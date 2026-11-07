import type { Address } from "viem";
import { deployment } from "@/lib/chain";

type ContractName = "HandoffRegistry" | "HandoffSettlement" | "USDC" | "AttestationStore" | "DemoToken";
type ActorName = "owner" | "seller" | "buyer" | "issuer" | "unverified" | "venue" | "orderKey";

/**
 * deployments/<chain>.json. Every key is optional: fuji.json has no DemoToken and holds only the owner
 * under actors until the issuer registers, so nothing here may assume a key exists.
 */
type HandoffDeployment = {
  chainId?: number;
  contracts?: Partial<Record<ContractName, Address>>;
  actors?: Partial<Record<ActorName, Address>>;
  startBlock?: number;
};

const handoff = deployment as HandoffDeployment | null;

export type CoreContracts ={ registry: Address; settlement: Address };

/** What the venue routes need. Null until the core contracts are deployed. */
export function coreContracts(): CoreContracts | null {
  const registry = handoff?.contracts?.HandoffRegistry;
  const settlement = handoff?.contracts?.HandoffSettlement;
  return registry && settlement ? { registry, settlement } : null;
}

export type WalletConfig = CoreContracts & {
  usdc: Address;
  attestationStore: Address;
  token: Address;
  venue: Address;
  seller: Address;
  buyer: Address;
  unverified: Address;
};

/** What the wallet screen needs. Null until the issuer has registered a token and the actors are known. */
export function walletConfig(): WalletConfig | null {
  const core = coreContracts();
  const { USDC: usdc, AttestationStore: attestationStore, DemoToken: token } = handoff?.contracts ?? {};
  const { venue, seller, buyer, unverified } = handoff?.actors ?? {};
  if (!core || !usdc || !attestationStore || !token || !venue || !seller || !buyer || !unverified) return null;
  return { ...core, usdc, attestationStore, token, venue, seller, buyer, unverified };
}
