import "server-only";
import { readFileSync } from "node:fs";

/**
 * Reads a secret from its env variable, or else from the file `<name>_PATH` names. Vercel has no files, so
 * it sets the value; a local run keeps the secret in its own file. The contents never reach a log or an error.
 */
export function readSecret(name: "MNEMONIC" | "ZEROXGASLESS_KEY"): string | null {
  const value = process.env[name]?.trim();
  if (value) return value;
  const path = process.env[`${name}_PATH`];
  if (!path) return null;
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}
