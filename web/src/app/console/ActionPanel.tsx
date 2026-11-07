"use client";

import { useState } from "react";
import type { Address } from "viem";
import { Button, Hash, Notice, TextField } from "@/design";
import { explorerUrl } from "@/lib/chain";
import { ACTIONS, fieldError, type ActionContext, type ActionDef, type Values } from "@/lib/console/actions";
import type { FeedEntry } from "@/lib/console/feed";
import { reasonText } from "@/lib/console/reasons";
import type { Role, SendResult } from "@/lib/console/roles";
import type { TokenView } from "@/lib/console/state";

type PanelProps = {
  role: Role;
  address: Address | null;
  token: TokenView | null;
  store: Address | null;
  business: boolean | null;
  onSent: () => void;
  onRefusal: (entry: FeedEntry) => void;
};

async function send(role: Role, action: ActionDef, values: Values, ctx: ActionContext): Promise<SendResult> {
  try {
    const response = await fetch("/console/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, call: { fn: action.fn, args: action.args(values, ctx) } }),
    });
    return (await response.json()) as SendResult;
  } catch {
    return { ok: false, code: "RouteUnavailable" };
  }
}

function Result({ result }: { result: SendResult }) {
  if (result.ok) {
    return (
      <Notice status="sold" word="Listo">
        Confirmado en el bloque {result.block}. <Hash value={result.hash} href={explorerUrl("tx", result.hash)} />
      </Notice>
    );
  }
  return (
    <Notice status="blocked" word="Rechazado">
      {reasonText(result.code)} <code className="desk__code">{result.code}</code>{" "}
      {result.hash ? <Hash value={result.hash} href={explorerUrl("tx", result.hash)} /> : null}
    </Notice>
  );
}

function ActionForm({ action, ctx, props }: { action: ActionDef; ctx: ActionContext; props: PanelProps }) {
  const { role, address, business, onSent, onRefusal } = props;
  const fields = action.fields(ctx);
  const [values, setValues] = useState<Values>(() => Object.fromEntries(fields.map((f) => [f.name, f.initial ?? ""])));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // The PSAV acts as a venue, which the contract checks itself. Everyone else needs the business read.
  const gated = action.gated && role !== "psav";
  const refusedBySdk = gated && business !== true;
  const sdkCode = business === null ? "BusinessReadFailed" : "NotBusiness";

  function logRefusal(code: string, hash?: string) {
    const at = Math.floor(Date.now() / 1000);
    onRefusal({
      id: `consola:${at}:${action.id}:${Math.random()}`,
      at,
      order: at * 1000,
      event: "Rechazado",
      status: "blocked",
      asset: ctx.token?.name ?? "Sin token",
      from: address ?? "-",
      fromRole: "Cuenta",
      price: "-",
      unit: " ",
      hash,
      code,
      detail: `${action.title} desde esta consola. Se conserva hasta recargar la página.`,
    });
  }

  function invalid(): boolean {
    const next = Object.fromEntries(fields.map((f) => [f.name, fieldError(f, values[f.name])]));
    setErrors(next);
    return Object.values(next).some(Boolean);
  }

  async function submit(onChainAnyway: boolean) {
    if (invalid()) return;
    if (refusedBySdk && !onChainAnyway) {
      logRefusal(sdkCode);
      setResult({ ok: false, code: sdkCode });
      return;
    }
    setBusy(true);
    const sent = await send(role, action, values, ctx);
    setBusy(false);
    setResult(sent);
    if (sent.ok) onSent();
    else logRefusal(sent.code, sent.hash);
  }

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  return (
    <div className="desk__form">
      {refusedBySdk ? (
        <Notice status="blocked" word="Rechazado">
          {reasonText(sdkCode)} <code className="desk__code">isBusiness = {business === null ? "sin dato" : "false"}</code>
        </Notice>
      ) : null}
      {action.id === "plataforma" && ctx.token ? (
        <p className="t-caption">{ctx.token.venues.length} de 5 plataformas. El contrato no admite una sexta.</p>
      ) : null}
      {fields.map((field) =>
        field.kind === "flag" ? (
          <label className="desk__flag" key={field.name}>
            <input
              type="checkbox"
              checked={values[field.name] === "1"}
              onChange={(event) => set(field.name, event.target.checked ? "1" : "")}
            />
            <span>
              {field.label}
              <span className="desk__flaghelp t-caption">{field.help}</span>
            </span>
          </label>
        ) : (
          <TextField
            key={field.name}
            label={field.label}
            value={values[field.name]}
            help={field.help}
            error={errors[field.name]}
            inputMode={field.kind === "whole" ? "numeric" : field.kind === "usdc" ? "decimal" : "text"}
            onChange={(event) => set(field.name, event.target.value)}
          />
        ),
      )}
      <div className="desk__buttons">
        <Button variant={action.danger ? "danger" : "primary"} busy={busy} onClick={() => submit(false)}>
          {action.label(ctx, values)}
        </Button>
        {refusedBySdk ? (
          <Button variant="ghost" busy={busy} onClick={() => submit(true)}>
            Probar en la cadena
          </Button>
        ) : null}
      </div>
      {result ? <Result result={result} /> : null}
    </div>
  );
}

export function ActionPanel(props: PanelProps) {
  const { role, token, store } = props;
  const ctx: ActionContext = { token, store };
  const actions = ACTIONS.filter((action) => action.roles.includes(role));

  return (
    <section className="desk__section desk__actions">
      <h2 className="t-title">Acciones</h2>
      <div className="desk__accordion">
        {actions.map((action) => (
          <details className="desk__action" name="acciones" key={action.id}>
            <summary>
              <span className="t-label">{action.title}</span>
              <span className="t-caption">{action.who}</span>
            </summary>
            {action.needsToken && !token ? (
              <p className="t-caption desk__empty">Elegí o registrá un token primero.</p>
            ) : (
              // Keyed by token so its defaults follow the selection; registering must survive the switch it causes.
              <ActionForm key={action.needsToken ? token?.address : action.id} action={action} ctx={ctx} props={props} />
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
