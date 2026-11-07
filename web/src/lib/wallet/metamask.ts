import { toHex } from "viem";
import { chain } from "@/lib/chain";

/** The EIP-1193 surface the wallet uses. No connector library: this is all of it. */
export type InjectedProvider = {
  isMetaMask?: boolean;
  providers?: InjectedProvider[];
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, listener: (...args: never[]) => void): void;
  removeListener?(event: string, listener: (...args: never[]) => void): void;
};

const CHAIN_HEX = toHex(chain.id);
const CHAIN_NOT_ADDED = 4902;

/** MetaMask if there is one. With several wallets installed, `window.ethereum` can be any of them. */
export function injectedProvider(): InjectedProvider | null {
  const { ethereum } = window as unknown as { ethereum?: InjectedProvider };
  if (!ethereum) return null;
  return ethereum.providers?.find((p) => p.isMetaMask) ?? ethereum;
}

export function isOnChain(chainId: unknown): boolean {
  return typeof chainId === "string" && BigInt(chainId) === BigInt(chain.id);
}

function notAdded(error: unknown): boolean {
  const { code, data } = error as { code?: number; data?: { originalError?: { code?: number } } };
  return code === CHAIN_NOT_ADDED || data?.originalError?.code === CHAIN_NOT_ADDED;
}

/** Switches to Fuji, adding it first if this MetaMask has never seen it. */
export async function switchToChain(provider: InjectedProvider): Promise<void> {
  const switchChain = () => provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  try {
    await switchChain();
  } catch (error) {
    if (!notAdded(error)) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : undefined,
        },
      ],
    });
    await switchChain();
  }
}
