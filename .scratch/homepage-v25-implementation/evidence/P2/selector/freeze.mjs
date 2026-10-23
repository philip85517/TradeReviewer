import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../../../../", import.meta.url);
const sourceFiles = [
  "app/components/homepage-v25/period-selector.tsx",
  "app/components/homepage-v25/period-selector.css",
  "app/components/homepage-v25/period-selector.test.tsx",
];
const evidenceFiles = [
  "visual-contract.md", "tsconfig.selector.json", "REPORT.md", "red-missing-component.log",
  "red-behavior.log", "green-attempt-1.log", "green-final.log", "typecheck.log", "lint.log", "css-parse.log",
];
const fingerprint = url => {
  const bytes = readFileSync(url);
  return { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
};
const runtime = "/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node";
const manifest = {
  generatedAt: new Date().toISOString(),
  root: fileURLToPath(root),
  task: "P2 controlled period selector isolated leaf; formal P2 remains0/3",
  model: "gpt-6.1-sol / ultra",
  source: Object.fromEntries(sourceFiles.map(file => [file, fingerprint(new URL(file, root))])),
  evidence: Object.fromEntries(evidenceFiles.map(file => [file, fingerprint(new URL(file, import.meta.url))])),
  results: { targeted: "PASS30/30", typecheckExit: 0, lintExit: 0, cssParseExit: 0,
    browser: "NOT VERIFIED", independentVisual: "NOT VERIFIED", integratedE2E: "NOT VERIFIED",
    persistence: "NOT APPLICABLE to read-only controlled leaf", formalP2: "0/3; prior FAIL unchanged" },
  commands: {
    targeted: `${runtime} node_modules/vitest/vitest.mjs run app/components/homepage-v25/period-selector.test.tsx --maxWorkers=1`,
    typecheck: `${runtime} node_modules/typescript/bin/tsc --project .scratch/homepage-v25-implementation/evidence/P2/selector/tsconfig.selector.json`,
    lint: `${runtime} node_modules/eslint/bin/eslint.js app/components/homepage-v25/period-selector.tsx app/components/homepage-v25/period-selector.test.tsx`,
  },
};
writeFileSync(new URL("freeze.json", import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(manifest.source, null, 2)}\n`);
