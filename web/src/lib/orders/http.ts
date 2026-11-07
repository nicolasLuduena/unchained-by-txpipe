import "server-only";
import { logRefusal, Refused } from "./service";
import { OPERATED_BY } from "./types";

function respond(body: object, status = 200, headers: HeadersInit = {}) {
  return Response.json({ operatedBy: OPERATED_BY, ...body }, { status, headers: { "X-Operated-By": OPERATED_BY, ...headers } });
}

/**
 * For Vercel's CDN only, so browsers still ask every time. Viewers polling the same list share one read of the store.
 * One second, because the wallet polls every 15: a list older than that could hide a new order until the next poll.
 */
const SHARED_LIST = { "Vercel-CDN-Cache-Control": "max-age=1" };

/** Runs a venue route: labels the response as the PSAV's and logs every refusal. Only a successful list is shared. */
export async function venueRoute(route: string, run: () => Promise<object>, cache: "shared" | "none" = "none"): Promise<Response> {
  try {
    return respond(await run(), 200, cache === "shared" ? SHARED_LIST : {});
  } catch (error) {
    if (error instanceof Refused) {
      await logRefusal(route, error).catch((failure: unknown) => console.error("refusal not logged", failure));
      return respond({ error: { code: error.code, reason: error.message } }, error.status);
    }
    console.error(`venue route ${route} failed`, error);
    return respond({ error: { code: "unavailable", reason: "The order service could not respond." } }, 502);
  }
}

export async function readJson<T extends object>(request: Request): Promise<T> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) throw new Refused("malformed", "The request body is not JSON.", 400);
  return body as T;
}
