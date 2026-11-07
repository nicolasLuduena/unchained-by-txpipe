import "server-only";
import { isAddressEqual, isAddress, type Address } from "viem";
import { logRefusal, Refused } from "@/lib/orders/service";
import { walletConfig } from "@/lib/wallet/deployment";

/** SPONSORED mode needs only this. Anything else is refused, so the route cannot spend credit on other work. */
const ALLOWED_METHOD = "pm_sponsorUserOperation";

function rpcError(id: unknown, status: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code: -32000, message } }, { status });
}

function refuse(id: unknown, refused: Refused) {
  logRefusal("paymaster", refused);
  return rpcError(id, refused.status, refused.message);
}

/** The paymaster URL embeds the key, and upstream errors can quote it. */
function redact(text: string, url: string) {
  const key = url.split("/").pop();
  const withoutUrl = text.replaceAll(url, "<paymaster>");
  return key ? withoutUrl.replaceAll(key, "<key>") : withoutUrl;
}

function isDemoAccount(sender: unknown): sender is Address {
  const config = walletConfig();
  if (!config || typeof sender !== "string" || !isAddress(sender)) return false;
  return isAddressEqual(sender, config.seller) || isAddressEqual(sender, config.buyer);
}

/**
 * Same-origin stand-in for the paymaster, so the browser signs while the keyed URL stays on the server.
 * It forwards one method for the demo's own accounts and nothing else.
 */
export async function forwardToPaymaster(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { id?: unknown; method?: unknown; params?: unknown[] } | null;
  const id = body?.id;

  if (body?.method !== ALLOWED_METHOD) {
    return refuse(id, new Refused("paymaster_method", "El patrocinio no admite este método.", 403));
  }
  const sender = (body.params?.[0] as { sender?: unknown } | undefined)?.sender;
  if (!isDemoAccount(sender)) {
    return refuse(id, new Refused("paymaster_sender", "Esta cuenta no tiene patrocinio.", 403));
  }

  const url = process.env.PAYMASTER_URL;
  if (!url) return rpcError(id, 503, "El patrocinio todavía no está configurado.");

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return new Response(redact(await upstream.text(), url), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // The fetch error can quote the URL, so it is not logged.
    return rpcError(id, 502, "El patrocinio no respondió.");
  }
}
