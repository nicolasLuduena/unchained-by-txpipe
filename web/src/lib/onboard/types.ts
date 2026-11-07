import type { Address, Hash } from "viem";

/** What the visitor's MetaMask signs to prove it owns the address. It asks for a demo, so it says there is no identity check. */
export function onboardMessage(owner: Address, chainId: number): string {
  return `Handoff: I request a demo verification, with no identity check.\nOwner: ${owner}\nNetwork: ${chainId}`;
}

/** How far one owner's onboarding got. Written after every step, so a retry resumes instead of repeating. */
export type OnboardRecord = {
  owner: Address;
  smartAccount: Address;
  deployTx?: Hash;
  attestTx?: Hash;
  mintTx?: Hash;
  usdcTx?: Hash;
  /** The seller had too little USDC to share. The holder can still sell. */
  usdcSkipped?: boolean;
  done: boolean;
};

/** Everything the browser needs to build the same SDK client the server computed the address with. */
export type AccountView = {
  owner: Address;
  smartAccount: Address;
  contracts: { factoryAddress: string; implementationAddress: string; defaultFallbackHandler: string; moduleAddress: string };
  bundlerUrl: string;
  record: OnboardRecord | null;
};
