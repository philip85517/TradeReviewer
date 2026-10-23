import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const variant = process.env.P4_VARIANT;
if (variant !== "baseline" && variant !== "candidate") throw new Error("P4_VARIANT must be baseline or candidate");
const substitutions = new Map([
  [resolve("app/lib/replay/position-ledger.ts"), resolve(".scratch/homepage-v25-implementation/evidence/P4/seam/input-position-ledger.ts")],
  [resolve("app/lib/reviews/homepage-v25-performance.ts"), resolve(".scratch/homepage-v25-implementation/evidence/P4/seam/input-homepage-v25-performance.ts")],
]);
export default defineConfig({
  plugins: [{ name: "paired-accepted-ledger-and-F-only", enforce: "pre", transform(code, id) {
    const snapshot = substitutions.get(id.split("?")[0]);
    return variant === "baseline" && snapshot ? { code: readFileSync(snapshot, "utf8"), map: null } : undefined;
  } }],
  test: { environment: "node", maxWorkers: 1, cache: false, include: [".scratch/homepage-v25-implementation/evidence/P4/seam/candidate2/paired-benchmark.test.ts"] },
});
