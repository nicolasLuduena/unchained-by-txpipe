import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/** Any username. Both sides are hashed first, so the compare is constant-time whatever the length. */
function authorized(header: string | null, password: string) {
  const [scheme, encoded] = header?.split(" ") ?? [];
  if (scheme?.toLowerCase() !== "basic" || !encoded) return false;
  const credentials = Buffer.from(encoded, "base64").toString("utf8");
  const offered = credentials.slice(credentials.indexOf(":") + 1);
  return credentials.includes(":") && timingSafeEqual(digest(offered), digest(password));
}

/** The demo's password gate. No matcher, so it covers every page, API route and asset. Unset, it lets all through. */
export function proxy(request: NextRequest) {
  const password = process.env.DEMO_PASSWORD;
  if (!password || authorized(request.headers.get("authorization"), password)) return NextResponse.next();
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Handoff", charset="UTF-8"' } });
}
