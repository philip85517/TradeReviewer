import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [label, ...args] = process.argv.slice(2);
if (!label || !/^[a-z0-9-]+$/.test(label) || !args.length) throw new Error("label and exact Node arguments required");
const dir = fileURLToPath(new URL(".", import.meta.url));
if (existsSync(`${dir}${label}.log`)) throw new Error("evidence exists; choose a new label");
const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" } });
const endedAt = new Date().toISOString();
writeFileSync(`${dir}${label}.log`, result.stdout + "\n--- STDERR ---\n" + result.stderr);
writeFileSync(`${dir}${label}.status.json`, JSON.stringify({ startedAt, endedAt, node: process.execPath, nodeVersion: process.version, args, status: result.status, signal: result.signal, error: result.error?.message ?? null }, null, 2) + "\n");
console.log(JSON.stringify({ label, status: result.status, signal: result.signal, error: result.error?.message ?? null }));
console.log(result.stdout.split("\n").filter(line => /Test Files|Tests |Duration |[×✓]/.test(line)).join("\n"));
if (result.status !== 0) console.log((result.stdout + result.stderr).slice(-4000));
