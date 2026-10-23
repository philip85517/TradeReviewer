import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const evidence = ".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer";
const label = process.argv[2];
const expectedHost = process.argv[3];
const expectedWorkspace = process.argv[4];
if (!label || !/^[a-z0-9-]+$/.test(label) || !expectedHost || !expectedWorkspace) {
  throw new Error("usage: fixed-node run-frozen-recheck.mjs label expected-host-sha expected-workspace-sha");
}
const files = [
  "app/components/homepage-v25/use-homepage-host.ts",
  "app/components/homepage-v25/session-model.ts",
  "app/components/homepage-v25/home-surface.tsx",
  "app/components/homepage-v25/holdings-model.ts",
  "app/components/homepage-v25/fx-adapter.ts",
  "app/components/trade-review-workspace.tsx",
  "app/lib/reviews/homepage-v25-state.ts",
  `${evidence}/host-peer.test.tsx`,
  `${evidence}/frozen-old-peer.test.tsx`,
  `${evidence}/owned-read-recheck.test.tsx`,
  `${evidence}/frozen-recheck.vitest.config.ts`,
];
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const capture = () => Object.fromEntries(files.map(file => [file, digest(fs.readFileSync(file))]));
const before = capture();
if (before[files[0]] !== expectedHost || before[files[5]] !== expectedWorkspace) throw new Error("owner freeze fingerprint mismatch; did not run");
if (before[files[7]] !== before[files[8]]) throw new Error("old peer copy differs from the preserved original");
const manifestPath = `${evidence}/${label}-manifest.json`;
const logPath = `${evidence}/${label}.log`;
const sourceDir = `${evidence}/${label}-source`;
if (fs.existsSync(manifestPath) || fs.existsSync(logPath) || fs.existsSync(sourceDir)) throw new Error("evidence label already exists");
fs.mkdirSync(sourceDir);
for (const file of files) fs.writeFileSync(path.join(sourceDir, file.replaceAll("/", "__") + ".txt"), fs.readFileSync(file));
const startedAt = new Date().toISOString();
const command = ["node_modules/vitest/vitest.mjs", "run", "--config", `${evidence}/frozen-recheck.vitest.config.ts`];
const run = spawnSync(process.execPath, command, { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
fs.writeFileSync(logPath, (run.stdout ?? "") + (run.stderr ?? ""));
const after = capture();
const stable = files.every(file => before[file] === after[file]);
fs.writeFileSync(manifestPath, JSON.stringify({
  startedAt, completedAt: new Date().toISOString(), cwd: process.cwd(), node: process.execPath, nodeVersion: process.version,
  command: [process.execPath, ...command], expectedHost, expectedWorkspace, before, after, stable,
  exitCode: run.status, signal: run.signal, error: run.error ? String(run.error) : null,
}, null, 2) + "\n");
process.stdout.write(JSON.stringify({ manifestPath, logPath, exitCode: run.status, stable }) + "\n");
process.exitCode = stable ? (run.status ?? 1) : 2;
