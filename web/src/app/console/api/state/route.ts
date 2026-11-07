import { chainRoute, sharedConsole } from "@/lib/console/shared";

/** What the console shows. Read on the server, so an open console does not spend the browser's RPC allowance. */
export function GET() {
  return chainRoute(sharedConsole);
}
