import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const base = ".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/";
const dataBase = ".scratch/homepage-v25-implementation/evidence/P2/data/";
const node = "/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node";
const shaBuffer = buffer => createHash("sha256").update(buffer).digest("hex");
const fileRecord = path => ({ bytes: statSync(path).size, sha256: shaBuffer(readFileSync(path)) });
const json = name => JSON.parse(readFileSync(base + name, "utf8"));
const productExpected = {
  "app/lib/reviews/homepage-v25-performance.ts": "637f07933247a6d4dbcea5336e946e68b98e3ff5fe7ddc39e24ff194d79e8c4b",
  "app/lib/reviews/homepage-v25-performance.test.ts": "f6d26840afd1a5bbc3dacf1151a05c6e947b14e20df4ffd31c8b91c95f04e683",
  "app/lib/replay/position-ledger.ts": "f46564c0ac473d78859f31c057ade82c3dc78852de8f55cfb04eee6e46927126",
  "app/lib/replay/position-ledger.test.ts": "21ed853ab8f64526c8faea4b369eda2f70328fb805bdea98fa87e8f801732ea9",
};
const products = Object.fromEntries(Object.entries(productExpected).map(([path, expected]) => {
  const record = fileRecord(path);
  if (record.sha256 !== expected) throw new Error(`Frozen product changed: ${path}`);
  return [path, record];
}));
const prefixProof = (snapshot, current, bytes, expected) => {
  const before = readFileSync(base + snapshot), after = readFileSync(current);
  const unchanged = before.length === bytes && after.subarray(0, before.length).equals(before);
  if (!unchanged || shaBuffer(before) !== expected) throw new Error(`Accepted test prefix changed: ${current}`);
  return { snapshot, current, bytes, sha256: shaBuffer(before), unchanged };
};
const acceptedPrefixes = [
  prefixProof("F3-test.snapshot.ts", "app/lib/reviews/homepage-v25-performance.test.ts", 50705, "cbe5cb601126413a11183ff5af265f94f620e9b3acec19cc01144e0f92195cf7"),
  prefixProof("canonical-original-test.snapshot.ts", "app/lib/replay/position-ledger.test.ts", 32966, "67d6d0c33d741398bfa070f69dca5ec829833452edf14e21d1a792ec804d6aef"),
];
const contractPath = dataBase + "PRE-DISPATCH-CONTRACT.md";
const contract = fileRecord(contractPath);
if (contract.sha256 !== "a882d59c3d6b2ed532250b207897bf0166e560426e58d6797e586faa28e7618a") throw new Error("Approved P2 contract changed");

const samples = [1, 2, 3].map(number => {
  const stem = `benchmark-v3-rounds-final-${number}`;
  const measurement = json(`${stem}.json`), exit = json(`${stem}-exit.json`);
  if (exit.code !== 0 || exit.timeout || !measurement.all365OraclesMatch) throw new Error(`Unexpected final sample state: ${stem}`);
  return { measurement: `${stem}.json`, log: `${stem}.log`, exitEvidence: `${stem}-exit.json`, ...measurement, exit };
});
const multi = json("41-final-multimarket.json");
const late = json("42-final-late-refund.json");
const logs = [
  { command: `${node} node_modules/vitest/vitest.mjs run --config ${base}vitest.config.ts`, log: "37-fee-boundaries-green.log", recordedExit: 0, files: 1, testsPassed: 138, scope: "F source tests including unchanged original 100" },
  { command: `${node} node_modules/typescript/bin/tsc --project ${base}canonical-tsconfig.json --noEmit`, log: "38-final-tsc.log", recordedExit: 0, scope: "strict owned four-file tsc; empty log" },
  { command: `${node} node_modules/eslint/bin/eslint.js ${Object.keys(productExpected).join(" ")}`, log: "39-final-lint.log", recordedExit: 0, scope: "owned four-file eslint; empty log" },
  { command: `${node} node_modules/vitest/vitest.mjs run --config ${base}final-regressions.vitest.config.ts`, log: "40-final-regressions.log", recordedExit: 0, files: 20, testsPassed: 403, scope: "targeted accepted F/canonical/IPO/episode/library/evidence/calendar/holdings neighborhood" },
  { command: `${node} node_modules/vitest/vitest.mjs run --config ${base}final-variants.vitest.config.ts`, log: "43-final-variants.log", recordedExit: 0, files: 1, testsPassed: 2, scope: "finite numerical probes and measurement; does NOT assert multi-market latency target" },
];
for (const check of logs) {
  const contents = readFileSync(base + check.log, "utf8");
  if (check.testsPassed && !contents.includes(`${check.testsPassed} passed`)) throw new Error(`Missing passing count in ${check.log}`);
  if (!check.testsPassed && contents.trim()) throw new Error(`Unexpected diagnostics in ${check.log}`);
}

const evidencePaths = readdirSync(base).sort().map(name => base + name)
  .filter(path => statSync(path).isFile() && path !== base + "freeze-manifest.json");
const externalPaths = [contractPath, dataBase + "COORDINATOR-CONTRACT-DECISIONS.md"];
const manifest = {
  status: "FROZEN; required multi-market performance MISS; NOT implementation-ready; NOT accepted; P2 0/3",
  generatedAt: new Date().toISOString(), runtime: process.version, node: process.execPath,
  allowedScope: "4 product files frozen; new P2 data evidence only after root stop; no more benchmark or repair authorization",
  products, acceptedPrefixes, approvedContract: { path: contractPath, ...contract },
  verification: logs,
  exitEvidenceNote: "recordedExit values are the actual completed tool exits; test logs are preserved verbatim. Empty tsc/lint logs contain no diagnostics. No new tests/benchmarks run to generate this manifest.",
  primaryThreeSampleWindow: { notifiedAtCST: "2026-10-23 03:11:41", endedAtCST: "2026-10-23 03:12:29", quietWindow: "root and integration paused heavy work", command: `${node} ${base}run-performance-v3.mjs final-N rounds`, samples, allSingleGroupTargetsMet: samples.every(s => s.coldGoalMet && s.repeatGoalMet), scope: "controlled explicit-live single-US-group 1866 fills x 365 endpoints; not database records" },
  longPrefix: { path: "benchmark-v3-long-prefix-final-long-prefix.json", exitEvidence: "benchmark-v3-long-prefix-final-long-prefix-exit.json", measurement: json("benchmark-v3-long-prefix-final-long-prefix.json"), scope: "additional single-group all-buy numerical/performance probe, not replacement for 3 fresh cold samples" },
  requiredMultiMarket: { path: "41-final-multimarket.json", result: "MISS", coldGoalMet: multi.coldMs <= 2000, repeatGoalMet: multi.repeats.every(r => r.ms <= 200), measurement: multi, notes: ["complete public graph not admitted under 64MiB conservative retained memo estimate", "all365 numerical oracles true does not imply engineering performance PASS", "source/index reported separately; exact rejected candidate bytes unknown", "afterSerialization heap is process heap including caller inputs, source/index, results and uncollected temporaries"] },
  lateRefund: { path: "42-final-late-refund.json", measurement: late, scope: "tiny exact attached-evidence fallback; no 1866-scale guarantee" },
  architecture: { path: "MULTIMARKET-ARCHITECTURE.md", status: "read-only proposal; no implementation; shared-graph feasibility and compact materialization <=200ms UNKNOWN", staticFieldModel: "44-retained-field-model.json" },
  preservedFailures: ["manifest.json", "report.md", "08-watchdog.json", "PERF-V3-MISS.md", "benchmark-v3-rounds-1.json", "benchmark-v3-rounds-2.json", "benchmark-v3-rounds-3.json", "benchmark-v3-rounds-candidate1.json", "benchmark-v3-rounds-candidate1-packed-array.json", "41-final-multimarket.json"],
  limits: ["root independent acceptance pending", "no UI/series/current page delivery claim", "not a production historical FX archive claim", "no further benchmark or product mutation after root stop", "no fourth hidden performance candidate"],
  files: Object.fromEntries([...Object.keys(productExpected), ...externalPaths, ...evidencePaths].map(path => [path, fileRecord(path)])),
};
writeFileSync(base + "freeze-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ status: manifest.status, products, acceptedPrefixes, evidenceFiles: evidencePaths.length, manifest: fileRecord(base + "freeze-manifest.json") }, null, 2));
