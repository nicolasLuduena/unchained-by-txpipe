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
      <h2 className="t-title">Mi billetera</h2>
      {status === "missing" && <Notice status="pending">No encontramos MetaMask en este navegador. Instalala para usar tu propia billetera, o mirá la demostración con las otras cuentas.</Notice>}
      {(status === "detecting" || status === "loading") && <Notice status="pending">Buscando tu cuenta inteligente.</Notice>}
      {status === "disconnected" && (
        <>
          <p className="caveat">Tu cuenta de MetaMask es dueña de una cuenta inteligente en Fuji. Firmás vos, y no pagás gas.</p>
          <Button variant="primary" size="lg" busy={connecting.busy} onClick={connect}>
            Conectar MetaMask
          </Button>
        </>
      )}
      {status === "wrong-chain" && (
        <>
          <Notice status="pending">MetaMask está en otra red.</Notice>
          <Button variant="primary" size="lg" busy={connecting.busy} onClick={connect}>
            Cambiar a Avalanche Fuji
          </Button>
        </>
      )}
      {connecting.error && (
        <Notice status="blocked" word="Rechazado">
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
        <span className="t-field-label">Dueña, en MetaMask</span>
        <HashText value={owner} href={explorerUrl("address", owner)} />
      </div>
      <div className="wallet-doc">
        <span className="t-field-label">Tu cuenta inteligente</span>
        <HashText value={smartAccount} href={explorerUrl("address", smartAccount)} />
      </div>

      {wallet.precheck === "blocked" && (
        <>
          <Notice status="blocked">Primero verificá esta cuenta. La comprobación del SDK de KUMPLY la bloquea hasta que tenga una atestación.</Notice>
          <Button className="wallet-long-button" variant="primary" busy={verifying.busy} onClick={() => verify(wallet.refresh)}>
            Obtener verificación de demostración (sin control de identidad)
          </Button>
          <p className="caveat">Es una atestación de demostración, sin control de identidad. La emite una instancia de demostración del contrato de KUMPLY, no su registro oficial. Recibís 5 tokens de demostración y, si queda saldo, USDC 5.</p>
        </>
      )}
      {verifying.error && (
        <Notice status="blocked" word="Rechazado">
          {verifying.error}
        </Notice>
      )}
      {record?.done && wallet.precheck === "passed" && (
        <Notice status="verified" word="Lista">
          {record.usdcSkipped ? "Recibiste una verificación de demostración y 5 tokens." : "Recibiste una verificación de demostración, 5 tokens y USDC 5."}
        </Notice>
      )}
      {record?.usdcSkipped && <Notice status="pending">Se agotaron los USDC de demostración, así que no recibiste USDC. Igual podés vender tus tokens.</Notice>}
    </section>
  );
}
