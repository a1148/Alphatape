import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function applyFile(file: string) {
  const text = readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
}

export function loadEnvFile() {
  const starts = [process.cwd(), fileURLToPath(new URL("../../..", import.meta.url))];
  const seen = new Set<string>();
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 6; i++) {
      if (seen.has(dir)) break;
      seen.add(dir);
      const file = join(dir, ".env");
      if (existsSync(file)) applyFile(file);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
}

loadEnvFile();
