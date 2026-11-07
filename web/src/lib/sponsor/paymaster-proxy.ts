import "server-only";
import { getAddress, type Address } from "viem";
import { chain, chainName } from "@/lib/chain";
import { withinRate } from "@/lib/onboard/limits";
import { readSecret } from "@/lib/secrets";
import { walletConfig } from "@/lib/wallet/deployment";
import { passesPrecheck } from "@/lib/wallet/precheck";

const SPONSOR_METHOD = "pm_sponsorUserOperation";
const SENDER_CALLS_PER_MINUTE = 10;
const ALL_CALLS_PER_MINUTE = 60;
const MINUTE_MS = 60_000;

type RpcRequest = { id?: unknown; method?: unknown; params?: unknown };

function refuse(id: unknown, status: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code: -32000, message } }, { status });
}

function senderOf(params: unknown): Address | null {
  const sender = Array.isArray(params) ? (params[0] as { sender?: unknown } | undefined)?.sender : undefined;
  try {
    return getAddress(String(sender));
  } catch {
    return null;
  }
}

/**
 * The paymaster URL embeds the team key, so the browser's SDK calls this instead. It sponsors only attested
 * accounts of this deployment's store, a few times a minute each, and the key never appears in what it returns.
 */
export async function forwardToPaymaster(body: RpcRequest | null): Promise<Response> {
  const id = body?.id;
  const config = walletConfig();
  const key = readSecret("ZEROXGASLESS_KEY");
  if (chainName === "local" || !config || !key) return refuse(id, 503, "El patrocinio no está configurado.");
  if (body?.method !== SPONSOR_METHOD) return refuse(id, 403, "Este método no está permitido.");

  const sender = senderOf(body.params);
  if (!sender) return refuse(id, 400, "La operación no indica una cuenta.");
  if (!(await passesPrecheck(config.attestationStore, sender))) return refuse(id, 403, "Esta cuenta no está verificada, así que no tiene patrocinio.");
  if (!(await withinRate("paymaster:all", ALL_CALLS_PER_MINUTE, MINUTE_MS))) return refuse(id, 429, "Demasiadas operaciones. Probá en un minuto.");
  if (!(await withinRate(`paymaster:${sender}`, SENDER_CALLS_PER_MINUTE, MINUTE_MS))) return refuse(id, 429, "Demasiadas operaciones seguidas. Esperá un minuto.");

  try {
    const response = await fetch(`https://paymaster.0xgasless.com/v1/${chain.id}/rpc/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method: SPONSOR_METHOD, params: body.params }),
    });
    const text = (await response.text()).replaceAll(key, "<key>");
    return new Response(text, { status: response.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return refuse(id, 502, "El patrocinio no pudo responder.");
  }
}
