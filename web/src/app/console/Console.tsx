"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { AssetRow, Hash, Notice, Stamp, Tabs } from "@/design";
import { chainName, deployment, explorerUrl } from "@/lib/chain";
import type { FeedEntry } from "@/lib/console/feed";
import { units, usdc } from "@/lib/console/format";
import { isRole, ROLE_LABEL, ROLES, type Role, type RoleAddresses } from "@/lib/console/roles";
import { LogScanner } from "@/lib/console/scan";
import { readConsole, type ConsoleState } from "@/lib/console/state";
import { ActionPanel } from "./ActionPanel";
import { ComplianceFeed } from "./ComplianceFeed";
import { HoldersTable } from "./HoldersTable";
import { TokenSummary } from "./TokenSummary";

const POLL_MS = 3000;
const CAVEAT = "Atestaciones de demostración en Fuji, sin verificación de identidad.";

function useRoleFromHash(): Role {
  const [role, setRole] = useState<Role>("emisor");
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      if (isRole(hash)) setRole(hash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return role;
}

/** Polls the chain. The scanner lives across polls, so each one reads only the new blocks. */
function useConsoleState() {
  const [roles, setRoles] = useState<RoleAddresses | null>(null);
  const [state, setState] = useState<ConsoleState | null>(null);
  const [failed, setFailed] = useState(false);
  const scanner = useRef<LogScanner | null>(null);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (!roles || running.current) return;
    running.current = true;
    scanner.current ??= new LogScanner();
    try {
      setState(await readConsole(scanner.current, roles));
      setFailed(false);
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      running.current = false;
    }
  }, [roles]);

  useEffect(() => {
    fetch("/console/api")
      .then((response) => response.json())
      .then((body: { roles: RoleAddresses }) => setRoles(body.roles))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { roles, state, failed, refresh };
}

function businessStamp(read: boolean | null | undefined) {
  if (read === undefined) return <Stamp status="pending">Leyendo KUMPLY</Stamp>;
  if (read === null) return <Stamp status="pending">KUMPLY sin respuesta</Stamp>;
  return read ? <Stamp status="verified">Empresa</Stamp> : <Stamp status="blocked">Sin atestación de empresa</Stamp>;
}

export function Console() {
  const role = useRoleFromHash();
  const { roles, state, failed, refresh } = useConsoleState();
  const [selected, setSelected] = useState<Address | null>(null);
  const [refusals, setRefusals] = useState<FeedEntry[]>([]);
  const seenTokens = useRef<number | null>(null);

  const tokens = useMemo(() => state?.tokens ?? [], [state]);
  const token = tokens.find((t) => t.address === selected) ?? tokens[0] ?? null;
  const address = roles?.[role] ?? null;

  // A token registered from this console becomes the working token.
  useEffect(() => {
    if (!state) return;
    if (seenTokens.current !== null && tokens.length > seenTokens.current) setSelected(tokens[tokens.length - 1].address);
    seenTokens.current = tokens.length;
  }, [state, tokens]);

  const feed = useMemo(
    () => [...(state?.feed ?? []), ...refusals].sort((a, b) => b.at - a.at || b.order - a.order),
    [state, refusals],
  );

  const addRefusal = useCallback((entry: FeedEntry) => setRefusals((list) => [...list, entry]), []);

  if (!deployment?.contracts?.HandoffRegistry) {
    return (
      <main className="desk">
        <h1 className="t-display-l">Consola del emisor y PSAV</h1>
        <Notice status="pending" word="Sin despliegue">
          No hay deployments/{chainName}.json. Desplegá los contratos y reiniciá la app.
        </Notice>
      </main>
    );
  }

  return (
    <main className="desk">
      <header className="desk__head">
        <img className="desk__logo" src="/design/logos/handoff-lockup-horizontal.svg" alt="Handoff" />
        <h1 className="t-display-l">Consola del emisor y PSAV</h1>
      </header>

      <section className="desk__role" aria-label="Rol">
        <Tabs
          ariaLabel="Rol que opera"
          className="desk__tabs"
          items={ROLES.map((r) => ({ label: ROLE_LABEL[r], href: `#${r}`, current: r === role }))}
        />
        <span className="desk__who">
          <span className="t-field-label">Dirección</span>
          {address ? <Hash value={address} href={explorerUrl("address", address)} /> : <span className="t-caption">Sin clave configurada</span>}
        </span>
        <span className="desk__who">
          <span className="t-field-label">KUMPLY isBusiness</span>
          {businessStamp(state?.business[role])}
        </span>
        <span className="desk__sync t-caption">
          {state ? `Bloque ${units(state.head)}, leído hasta ${units(state.scannedTo)}` : "Leyendo la cadena"}
        </span>
      </section>

      <p className="caveat">
        {CAVEAT}
        {chainName === "local" ? " Cadena local: el SDK de KUMPLY lee el stub de atestaciones." : ""}
      </p>

      {failed ? (
        <Notice status="pending" word="Sin conexión">
          El RPC no respondió. Reintentamos en cada lectura y lo ya leído se conserva.
        </Notice>
      ) : null}

      <div className="desk__columns">
        <ActionPanel
          key={token?.address ?? "sin-token"}
          role={role}
          address={address}
          token={token}
          store={token?.attesters[0] ?? (deployment.contracts.AttestationStore as Address | undefined) ?? null}
          business={state ? state.business[role] : null}
          onSent={refresh}
          onRefusal={addRefusal}
        />

        <div className="desk__main">
          <section className="desk__section">
            <h2 className="t-title">Tokens</h2>
            {tokens.length === 0 ? (
              <p className="t-caption">{state ? "Todavía no hay tokens en el registro. Registrá el primero como emisor." : "Leyendo el registro."}</p>
            ) : (
              <div className="desk__tokens">
                {tokens.map((t) => (
                  <AssetRow
                    key={t.address}
                    name={t.name}
                    meta={`${t.symbol}, ${units(t.totalSupply)} de ${units(t.authorizedSupply)} unidades`}
                    price={usdc(t.band.price)}
                    status={t.paused ? "blocked" : t.address === token?.address ? "verified" : undefined}
                    className={t.address === token?.address ? "desk__token--current" : undefined}
                    onClick={() => setSelected(t.address)}
                  />
                ))}
              </div>
            )}
          </section>

          {token ? <TokenSummary token={token} /> : null}
          {token ? <HoldersTable token={token} /> : null}
          <ComplianceFeed entries={feed} venueRouteUp={state?.venueRouteUp ?? false} />
        </div>
      </div>
    </main>
  );
}
