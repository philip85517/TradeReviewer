import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
const base = path.resolve(".scratch/homepage-v25-implementation/evidence/resume-2026-10-23/P1-state-peer");
const out = path.join(base, "workspace-nature-reachability-" + (process.argv[2] ?? "2"));
if (fs.existsSync(out)) throw new Error("preserve original evidence; output exists");
fs.mkdirSync(out);
const sha = x => crypto.createHash("sha256").update(x).digest("hex");
const files = ["app/lib/trades/instruments.ts", "app/lib/trades/library.ts", "app/lib/trades/types.ts", "app/lib/trades/episodes.ts", "app/lib/trades/trading-nature.ts", "app/lib/reviews/shared-scope.ts", "app/components/homepage-v25/holdings-model.ts"];
const captures = {};
const overrides = {};
for (const file of files) {
  const current = fs.readFileSync(file, "utf8");
  const frozenPath = path.join(base, "p1-round1-source", file.replaceAll("/", "__") + ".txt");
  const bytes = fs.existsSync(frozenPath) ? fs.readFileSync(frozenPath, "utf8") : current;
  const historical = spawnSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" });
  const snapshot = path.join(out, file.replaceAll("/", "__") + ".txt");
  fs.writeFileSync(snapshot, bytes);
  captures[file] = { sha256: sha(bytes), currentBefore: sha(current), headSha256: historical.status === 0 ? sha(historical.stdout) : null,
    source: fs.existsSync(frozenPath) ? "freeze1 captured bytes" : "observed source unchanged from HEAD", snapshot };
  overrides[path.resolve(file)] = bytes;
}
const configPath = path.join(out, "vitest.config.ts");
fs.writeFileSync(configPath, `import { defineConfig } from "vitest/config";\nconst overrides=${JSON.stringify(overrides)};\nexport default defineConfig({plugins:[{name:"peer-pinned-inputs",enforce:"pre",transform(code,id){const key=id.split("?")[0];if(overrides[key])return {code:overrides[key],map:null};}}],test:{environment:"node",maxWorkers:1,cache:false,include:[${JSON.stringify(path.relative(process.cwd(), path.join(base,"workspace-nature-reachability.test.ts")))}]}});\n`);
const args = ["node_modules/vitest/vitest.mjs", "run", "--config", configPath];
const start = new Date().toISOString();
const run = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 3*1024*1024 });
fs.writeFileSync(path.join(out, "run.log"), (run.stdout ?? "") + (run.stderr ?? ""));
for (const file of files) captures[file].currentAfter = sha(fs.readFileSync(file));
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ start, completed: new Date().toISOString(), command:[process.execPath,...args], node:process.version, captures,
  exitCode:run.status, scope:"pure functions only; no service, browser, network, storage or database" }, null, 2)+"\n");
process.stdout.write(JSON.stringify({ out, exitCode:run.status })+"\n");
process.exitCode = run.status ?? 1;
