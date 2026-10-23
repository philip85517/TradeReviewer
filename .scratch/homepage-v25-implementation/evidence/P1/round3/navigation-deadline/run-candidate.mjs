import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const [label, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? "") || !args.length) throw new Error("label and exact Node arguments required");
const node = "/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node";
const evidence = resolve(".scratch/homepage-v25-implementation/evidence/P1/round3/navigation-deadline");
const red = JSON.parse(readFileSync(resolve(evidence, "01-absolute-deadline-red.json"), "utf8"));
const paths = Object.keys(red.after);
const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const manifest = () => Object.fromEntries(paths.map(path => [path, hash(path)]));
const before = manifest();
// The independently owned Surface may change in parallel. Our only product
// mutation is host; all original tests, S and session stay byte-identical.
for (const path of paths) {
  if (path.endsWith("/use-homepage-host.ts") || path.endsWith("/home-surface.tsx")) continue;
  if (before[path] !== red.after[path]) throw new Error(`Protected input drift: ${path}`);
}
const startedAt = new Date().toISOString();
const result = spawnSync(node, args, { cwd: process.cwd(), encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const after = manifest();
writeFileSync(resolve(evidence, `${label}.log`), log, { flag: "wx" });
const record = { startedAt, endedAt: new Date().toISOString(), node, args,
  runnerNode: process.version, platform: process.platform, architecture: process.arch,
  exitCode: result.status, signal: result.signal, error: result.error?.message ?? null,
  before, after, inputsUnchanged: JSON.stringify(before) === JSON.stringify(after),
};
writeFileSync(resolve(evidence, `${label}.json`), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
process.stdout.write(JSON.stringify({ label, ...record, before: undefined, after: undefined, logTail: log.slice(-2200) }, null, 2) + "\n");
process.exitCode = result.status ?? 1;
