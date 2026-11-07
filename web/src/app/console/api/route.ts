import { isRole, type RegistryCall } from "@/lib/console/roles";
import { roleAddresses, sendAs } from "@/lib/console/send-as";

/** The console's addresses. Keys stay on this side of the route. */
export async function GET() {
  return Response.json({ roles: roleAddresses() });
}

/** sendAs(role, call): the one place the console signs. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { role?: unknown; call?: RegistryCall } | null;
  if (!body || !isRole(body.role) || !body.call || !Array.isArray(body.call.args)) {
    return Response.json({ ok: false, code: "BadRequest" }, { status: 400 });
  }
  return Response.json(await sendAs(body.role, body.call));
}
