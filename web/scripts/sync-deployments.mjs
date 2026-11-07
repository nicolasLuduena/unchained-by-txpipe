// Copies deployments/*.json into web/deployments, the only place next.config.ts reads. Run by predev and
// prebuild. The copy is committed, so a build that only has web/ keeps the last one: commit it after a redeploy.
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(web, "..", "deployments");

if (existsSync(source)) {
  cpSync(source, join(web, "deployments"), { recursive: true });
  console.log("sync-deployments: copied");
} else {
  console.log("sync-deployments: no deployments/ here, keeping the committed copy");
}
