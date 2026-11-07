import { chainRoute, sharedLogs } from "@/lib/console/shared";

/** The chain events every screen shares, scanned once on the server from the deployment's start block. */
export function GET() {
  return chainRoute(sharedLogs);
}
