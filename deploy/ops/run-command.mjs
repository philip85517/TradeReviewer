#!/usr/bin/env node

import { spawn } from "node:child_process";

const [timeoutText, command, ...args] = process.argv.slice(2);
const timeoutMs = Number(timeoutText);

if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !command) {
  process.stderr.write("usage: run-command.mjs TIMEOUT_MS COMMAND [ARG ...]\n");
  process.exit(2);
}

const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit",
  detached: process.platform !== "win32",
});
let timedOut = false;
let killTimer;

function signalChild(signal) {
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

const timeout = setTimeout(() => {
  timedOut = true;
  process.stderr.write(`command timed out after ${timeoutMs}ms: ${command}\n`);
  signalChild("SIGTERM");
  killTimer = setTimeout(() => signalChild("SIGKILL"), 2_000);
}, timeoutMs);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => signalChild(signal));
}

child.on("error", (error) => {
  clearTimeout(timeout);
  if (killTimer) clearTimeout(killTimer);
  process.stderr.write(`${error.message}\n`);
  process.exit(127);
});

child.on("close", (code, signal) => {
  clearTimeout(timeout);
  if (timedOut) {
    if (killTimer) clearTimeout(killTimer);
    signalChild("SIGKILL");
    process.exit(124);
  }
  if (killTimer) clearTimeout(killTimer);
  if (signal) process.exit(128);
  process.exit(code ?? 1);
});
