import { createWalletClient, custom, isAddressEqual, type Address, type Hash, type Hex } from "viem";
import { handoffSettlementAbi } from "@/lib/abi";
import { chain, publicClient } from "@/lib/chain";
import type { AccountView } from "@/lib/onboard/types";
import { reversionDigest } from "@/lib/orders/types";
import { coreContracts } from "@/lib/wallet/deployment";
import type { InjectedProvider } from "@/lib/wallet/metamask";
import type { Call, Sponsor } from "./index";

const ERC6492_SUFFIX = "6492".repeat(16);

type Session = { provider: InjectedProvider; account: AccountView };

let session: Session | null = null;

/** Set by the wallet screen once MetaMask is connected. The sponsor below acts for this owner and nobody else. */
export function setMetaMaskSession(next: Session | null) {
  session = next;
}

function current(): Session {
  if (!session) throw new Error("Connect MetaMask first.");
  return session;
}

/**
 * The browser twin of freshClient in fuji-server.ts: same contracts, but the owner key stays in MetaMask and the
 * paymaster URL is the same-origin proxy. Always a new client: the SDK caches NOT_DEPLOYED, so one that saw the
 * account undeployed keeps returning ERC-6492 signatures afterwards.
 */
async function freshClient() {
  const { provider, account } = current();
  const { createECDSAOwnershipValidationModule, createSmartAccountClient } = await import("@0xgasless/smart-account");
  const { moduleAddress, ...contracts } = account.contracts;
  const signer = createWalletClient({ account: account.owner, chain, transport: custom(provider as never) });
  const ecdsa = await createECDSAOwnershipValidationModule({ signer, moduleAddress } as never);
  const client = await createSmartAccountClient({
    signer,
    chainId: chain.id,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? chain.rpcUrls.default.http[0],
    bundlerUrl: account.bundlerUrl,
    paymasterUrl: `${window.location.origin}/api/paymaster`,
    index: 0,
    ...contracts,
    defaultValidationModule: ecdsa,
    activeValidationModule: ecdsa,
  } as never);

  if (!isAddressEqual((await client.getAccountAddress()) as Address, account.smartAccount)) {
    throw new Error("This MetaMask account does not match this smart account.");
  }
  return client;
}

async function send(calls: Call[]) {
  const { PaymasterMode } = await import("@0xgasless/smart-account");
  const client = await freshClient();
  const transactions = calls.map(({ to, data }) => ({ to, data, value: 0n }));
  // calculateGasLimits stays unset: false estimates first, which fails with AA21 on an unfunded account.
  const response = await client.sendTransaction(transactions as never, { paymasterServiceData: { mode: PaymasterMode.SPONSORED } } as never);
  if (response.error) throw new Error(`bundler: ${response.error.message}`);

  const { receipt, success } = await response.wait();
  // success is the string "true" or "false", so a plain truthiness check would pass a failed operation.
  if (String(success) !== "true") throw new Error(`Transaction reverted: ${receipt.transactionHash}`);
  return { hash: receipt.transactionHash as Hash, userOpHash: response.userOpHash as Hash };
}

async function signDigest(digest: Hash): Promise<Hex> {
  const { smartAccount } = current().account;
  // SignatureChecker has no ERC-6492 support. The deployer normally deployed it; if it could not, this op does.
  if (!(await publicClient.getCode({ address: smartAccount }))) await send([{ to: smartAccount, data: "0x" }]);

  const client = await freshClient();
  // The 0x prefix matters: without it the SDK signs the text and verification fails.
  const signature = (await client.signMessage(digest)) as Hex;
  if (signature.endsWith(ERC6492_SUFFIX)) throw new Error("The account is not deployed yet. Try again in a moment.");
  return signature;
}

/** Same contract as the other sponsors, but every signature is a MetaMask prompt in this browser. */
export const metamaskSponsor: Sponsor = {
  sendCalls: (_actor, calls) => send(calls),

  async signOrder(_actor, order) {
    const address = coreContracts()?.settlement;
    if (!address) throw new Error("The contracts are not deployed yet.");
    return signDigest(await publicClient.readContract({ address, abi: handoffSettlementAbi, functionName: "hashOrder", args: [order] }));
  },

  signReversion: (_actor, request) => signDigest(reversionDigest(request)),
};
