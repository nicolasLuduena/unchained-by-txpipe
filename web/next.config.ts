import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

const chain = process.env.NEXT_PUBLIC_CHAIN ?? "local";

// Read once at startup and inlined, so server and client see the same deployment synchronously.
// web/deployments is the copy scripts/sync-deployments.mjs keeps, so the build needs nothing outside web/.
// Restart `pnpm dev` after a redeploy. A missing file is normal: chain.ts exposes it as null.
function readDeployment(): string {
  const file = join(__dirname, "deployments", `${chain}.json`);
  if (!existsSync(file)) return "null";
  return JSON.stringify(JSON.parse(readFileSync(file, "utf8")));
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_DEPLOYMENT: readDeployment() },
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
};

export default nextConfig;
