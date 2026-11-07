"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { AssetRow, Hash, Notice, Ribbons, Stamp, Tabs } from "@/design";
import { parseBig } from "@/lib/big-json";
import { chainName, deployment, explorerUrl, networkLabel } from "@/lib/chain";
import type { FeedEntry } from "@/lib/console/feed";
import { units, usdc } from "@/lib/console/format";
import { isRole, ROLE_LABEL, ROLES, type Role, type RoleAddresses } from "@/lib/console/roles";
import type { ConsoleState } from "@/lib/console/state";
import { ActionPanel } from "./ActionPanel";
import { ComplianceFeed } from "./ComplianceFeed";
import { HoldersTable } from "./HoldersTable";
import { TokenSummary } from "./TokenSummary";

const POLL_MS = chainName === "local" ? 3000 : 5000;
const SYNCED_BLOCKS = 100n;
const CAVEAT = "Demo attestations on Fuji, no identity verification.";

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

/** Polls the server's shared reading, which keeps its scan across polls and across screens. */
function useConsoleState() {
  const [roles, setRoles] = useState<RoleAddresses | null>(null);
  const [state, setState] = useState<ConsoleState | null>(null);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  const refresh = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const response = await fetch("/console/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error(`console state: ${response.status}`);
      setState(parseBig<ConsoleState>(await response.text()));
      setFailed(false);
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      running.current = false;
    }
  }, []);

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
  if (read === undefined) return <Stamp status="pending">Reading</Stamp>;
  if (read === null) return <Stamp status="pending">No response</Stamp>;
  return read ? <Stamp status="verified">Business</Stamp> : <Stamp status="blocked">No attestation</Stamp>;
}

/** The sync line only earns its place while the scan is catching up. */
function behind(state: ConsoleState | null) {
  return !state || state.head - state.scannedTo > SYNCED_BLOCKS;
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
        <h1 className="t-display-l">Issuer and PSAV console</h1>
        <Notice status="pending" word="No deployment">
          There is no deployments/{chainName}.json. Deploy the contracts and restart the app.
        </Notice>
      </main>
    );
  }

  return (
    <main className="desk">
      <Ribbons className="desk__ribbons" />
      <header className="desk__head">
        <span className="desk__brand">
          <img className="desk__logo" src="/design/logos/handoff-mark.svg" alt="" />
          Handoff
        </span>
        <h1 className="t-display-l">Issuer and PSAV console</h1>
        <p className="desk__lede">Register tokens, set the price band and follow every order, sale and refusal. The PSAV, a licensed virtual asset provider, runs the venue.</p>
      </header>

      {failed ? (
        <Notice className="desk__offline" status="pending" word="Offline">
          The RPC did not respond. We retry on every read and keep what we already have.
        </Notice>
      ) : null}

      <div className="desk__columns">
        <aside className="desk__rail">
          <section className="desk__role" aria-label="Role">
            <span className="t-field-label">Acting as</span>
            <Tabs
              ariaLabel="Acting role"
              className="hf-tabs--rail"
              items={ROLES.map((r) => ({ label: ROLE_LABEL[r], href: `#${r}`, current: r === role }))}
            />
          </section>
          <div className="desk__who">
            <span className="t-field-label">This role's address</span>
            {address ? <Hash value={address} href={explorerUrl("address", address)} /> : <span className="t-caption">No key configured</span>}
          </div>
          {role !== "psav" && state?.business[role] !== true && (
            <div className="desk__who">
              <span className="t-field-label">Verified business</span>
              {businessStamp(state?.business[role])}
              <span className="desk__note">With no business attestation, the SDK check (isBusiness) stops the action before it is sent.</span>
            </div>
          )}
          {behind(state) && (
            <span className="desk__note">
              {state ? `Reading ${networkLabel}: block ${units(state.scannedTo)} of ${units(state.head)}` : `Reading ${networkLabel}`}
            </span>
          )}
          <p className="caveat desk__caveat">
            {CAVEAT}
            {" "}
            {chainName === "local"
              ? "Local network: the KUMPLY SDK reads a test stub."
              : "The KUMPLY SDK reads a demo instance of the KUMPLY contract, with no identity verification. It is not KUMPLY's official store."}
          </p>
        </aside>

        <ActionPanel
          key={role}
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
              <p className="t-caption">{state ? "No tokens in the registry yet. Register the first one as issuer." : "Reading the registry."}</p>
            ) : (
              <div className="desk__tokens">
                {tokens.map((t) => (
                  <AssetRow
                    key={t.address}
                    name={t.name}
                    meta={`${t.symbol}, ${units(t.totalSupply)} of ${units(t.authorizedSupply)} units${t.paused ? ", paused" : ""}`}
                    price={usdc(t.band.price)}
                    className={t.address === token?.address ? "desk__token--current" : undefined}
                    onClick={() => setSelected(t.address)}
                  />
                ))}
              </div>
            )}
          </section>

          {token ? <TokenSummary token={token} /> : null}
          {token ? <HoldersTable token={token} /> : null}
          <ComplianceFeed entries={feed} />
        </div>
      </div>
    </main>
  );
}
