import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const base = ".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/";
const started = Date.now();
const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", `${base}performance-v2.config.ts`], { stdio: "inherit", detached: true });
let stopped = false;
const timer = setInterval(() => {
  let progress;
  try { progress = JSON.parse(readFileSync(`${base}08-performance-v2.json`, "utf8")); } catch { /* before probe writes */ }
  const batchOverBudget = progress?.stage === "batch" && Date.now() - progress.stageStartedAt > 15000;
  if (!stopped && (batchOverBudget || Date.now() - started > 120000)) {
    stopped = true;
    writeFileSync(`${base}08-watchdog.json`, JSON.stringify({ reason: batchOverBudget ? "batch exceeded independent 15s wall bound; engineering cold goal is 2s" : "total subprocess exceeded independent 120s wall bound", elapsedMs: Date.now() - started, progress }, null, 2));
    process.kill(-child.pid, "SIGTERM");
  }
}, 100);
child.on("exit", (code, signal) => { clearInterval(timer); process.exitCode = stopped ? 124 : code ?? (signal ? 1 : 0); });
