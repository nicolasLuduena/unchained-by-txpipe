import "server-only";
import { logRefusal, Refused } from "./service";
import { OPERATED_BY } from "./types";

function respond(body: object, status = 200) {
  return Response.json({ operatedBy: OPERATED_BY, ...body }, { status, headers: { "X-Operated-By": OPERATED_BY } });
}

/** Runs a venue route: labels the response as the PSAV's and logs every refusal. */
export async function venueRoute(route: string, run: () => Promise<object>): Promise<Response> {
  try {
    return respond(await run());
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
