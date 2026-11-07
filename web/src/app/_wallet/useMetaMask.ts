"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress, stringToHex, type Address, type Hex } from "viem";
import { chain } from "@/lib/chain";
import { onboarding } from "@/lib/onboard/client";
import { onboardMessage, type AccountView, type OnboardRecord } from "@/lib/onboard/types";
import { setMetaMaskSession } from "@/lib/sponsor/metamask";
import { injectedProvider, isOnChain, switchToChain, type InjectedProvider } from "@/lib/wallet/metamask";
import { useAction } from "./useWallet";

export type MetaMaskStatus = "detecting" | "missing" | "disconnected" | "wrong-chain" | "loading" | "ready";

/** The visitor's MetaMask: its owner address, the network it is on, and the smart account that owner controls. */
export function useMetaMask() {
  const [provider, setProvider] = useState<InjectedProvider | null | undefined>(undefined);
  const [owner, setOwner] = useState<Address | null>(null);
  const [onChain, setOnChain] = useState(false);
  const [account, setAccount] = useState<AccountView | null>(null);
  const connecting = useAction();
  const verifying = useAction();

  useEffect(() => {
    const found = injectedProvider();
    setProvider(found);
    if (!found) return;

    const onAccounts = (accounts: string[]) => setOwner(accounts[0] ? getAddress(accounts[0]) : null);
    const onChainChanged = (chainId: string) => setOnChain(isOnChain(chainId));
    // Silent: eth_accounts opens no prompt, so a visitor who connected before just comes back connected.
    found.request({ method: "eth_accounts" }).then((accounts) => onAccounts(accounts as string[])).catch(() => onAccounts([]));
    found.request({ method: "eth_chainId" }).then((id) => onChainChanged(id as string)).catch(() => setOnChain(false));
    found.on?.("accountsChanged", onAccounts);
    found.on?.("chainChanged", onChainChanged);
    return () => {
      found.removeListener?.("accountsChanged", onAccounts);
      found.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  const { run: runConnecting } = connecting;
  useEffect(() => {
    setAccount(null);
    setMetaMaskSession(null);
    if (!provider || !owner || !onChain) return;
    let live = true;
    runConnecting(async () => {
      const view = await onboarding.account(owner);
      if (!live) return;
      setMetaMaskSession({ provider, account: view });
      setAccount(view);
    });
    return () => {
      live = false;
    };
    // runConnecting changes every render; the inputs that matter are these three.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, owner, onChain]);

  const connect = useCallback(() => {
    if (!provider) return;
    return connecting.run(async () => {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      await switchToChain(provider);
      setOwner(getAddress(accounts[0]));
      setOnChain(true);
    });
  }, [provider, connecting]);

  /** Signs the ownership message and asks for the demo verification. `done` runs once the account is ready to use. */
  function verify(done: () => void) {
    if (!provider || !owner) return;
    return verifying.run(async () => {
      const message = stringToHex(onboardMessage(owner, chain.id));
      const signature = (await provider.request({ method: "personal_sign", params: [message, owner] })) as Hex;
      const record: OnboardRecord = await onboarding.request(owner, signature);
      setAccount((a) => {
        if (!a) return a;
        const next = { ...a, record };
        setMetaMaskSession({ provider, account: next });
        return next;
      });
      done();
    });
  }

  const status: MetaMaskStatus =
    provider === undefined ? "detecting" : provider === null ? "missing" : !owner ? "disconnected" : !onChain ? "wrong-chain" : account ? "ready" : "loading";

  return { status, owner, account, connect, connecting, verify, verifying };
}

export type MetaMask = ReturnType<typeof useMetaMask>;
