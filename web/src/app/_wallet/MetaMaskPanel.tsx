"use client";

import { Button, Hash as HashText, Notice } from "@/design";
import { explorerUrl } from "@/lib/chain";
import type { MetaMask } from "./useMetaMask";
import type { Wallet } from "./useWallet";

/** Everything before there is a smart account to show: no MetaMask, not connected, or on another network. */
export function MetaMaskConnect({ metamask }: { metamask: MetaMask }) {
  const { status, connect, connecting } = metamask;
  return (
    <section className="wallet-stack">
      <h2 className="t-title">My wallet</h2>
      {status === "missing" && <Notice status="pending">We could not find MetaMask in this browser. Install it to use your own wallet, or view the demo with the other accounts.</Notice>}
      {(status === "detecting" || status === "loading") && <Notice status="pending">Looking for your smart account.</Notice>}
      {status === "disconnected" && (
        <>
          <p className="caveat">Your MetaMask account owns a smart account on Fuji. You sign, and you pay no gas.</p>
          <Button variant="primary" size="lg" busy={connecting.busy} onClick={connect}>
            Connect MetaMask
          </Button>
        </>
      )}
      {status === "wrong-chain" && (
        <>
          <Notice status="pending">MetaMask is on another network.</Notice>
          <Button variant="primary" size="lg" busy={connecting.busy} onClick={connect}>
            Switch to Avalanche Fuji
          </Button>
        </>
      )}
      {connecting.error && (
        <Notice status="blocked" word="Refused">
          {connecting.error}
        </Notice>
      )}
    </section>
  );
}

/** The connected account: who owns it, what the SDK pre-check says, and the way to get past it in this demo. */
export function MetaMaskPanel({ metamask, wallet }: { metamask: MetaMask; wallet: Wallet }) {
  const { account, verify, verifying } = metamask;
  if (!account) return null;
  const { owner, smartAccount, record } = account;

  return (
    <section className="wallet-stack">
      <div className="wallet-doc">
        <span className="t-field-label">Owner, in MetaMask</span>
        <HashText value={owner} href={explorerUrl("address", owner)} />
      </div>
      <div className="wallet-doc">
        <span className="t-field-label">Your smart account</span>
        <HashText value={smartAccount} href={explorerUrl("address", smartAccount)} />
      </div>

      {(wallet.precheck === "blocked" || (record && !record.done)) && (
        <>
          <Notice status="blocked">Verify this account first. The KUMPLY SDK check blocks it until it has an attestation.</Notice>
          <Button className="wallet-long-button" variant="primary" busy={verifying.busy} onClick={() => verify(wallet.refresh)}>
            Get a demo verification (no identity check)
          </Button>
          <p className="caveat">This is a demo attestation with no identity check. It comes from a demo instance of the KUMPLY contract, not KUMPLY's official store. You receive 5 demo tokens and, if any is left, USDC 5.</p>
        </>
      )}
      {verifying.error && (
        <Notice status="blocked" word="Refused">
          {verifying.error}
        </Notice>
      )}
      {record?.done && wallet.precheck === "passed" && (
        <Notice status="verified" word="Ready">
          {record.usdcSkipped ? "You received a demo verification and 5 tokens." : "You received a demo verification, 5 tokens and USDC 5."}
        </Notice>
      )}
      {record?.usdcSkipped && <Notice status="pending">The demo USDC ran out, so you did not receive any. You can still sell your tokens.</Notice>}
    </section>
  );
}
