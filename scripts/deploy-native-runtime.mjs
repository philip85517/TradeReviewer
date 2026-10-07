import { spawn } from "node:child_process";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, realpathSync } from "node:fs";
import { appendFile as appendFileAsync } from "node:fs/promises";
import { isIP } from "node:net";
import { basename, delimiter, dirname, isAbsolute, join, resolve, sep } from "node:path";
import process from "node:process";
import { assertNativeEnvironment } from "./native-environment.mjs";

const DEFAULT_COMMAND_TIMEOUT = 10 * 60 * 1000;
const POLL_INTERVAL = 50;
const OVERRIDE_VARS = ["TRADEREVIEW_DB_PATH", "TRADEREVIEW_RUNTIME_CONFIG", "TRADEREVIEW_PORT", "PORT", "HOST", "HOSTNAME"];

function fail(message) { throw new Error(`Invalid native runtime: ${message}`); }

function validateRuntimeConfig(config) {
  if (!config || typeof config !== "object") fail("runtimeConfig is required");
  const { databasePath, port, hostname, configPath } = config;
  if (typeof databasePath !== "string" || !isAbsolute(databasePath) || databasePath.includes("\0") || databasePath === dirname(databasePath) || databasePath.endsWith(sep) || databasePath.split(sep).includes("..")) fail("databasePath must be a safe absolute path");
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail("port must be between 1 and 65535");
  if (typeof hostname !== "string" || !hostname.trim() || hostname.includes("\0") || (isIP(hostname) !== 4 && isIP(hostname) !== 6 && hostname !== "localhost")) fail("hostname must be loopback");
  if (isIP(hostname) && !["127.0.0.1", "::1"].includes(hostname)) fail("hostname must be loopback");
  if (configPath !== undefined && (typeof configPath !== "string" || !isAbsolute(configPath) || configPath.includes("\0"))) fail("configPath must be absolute");
  return { databasePath: resolve(databasePath), port, hostname: hostname.trim(), configPath };
}

function decodeEscapedPath(value) {
  return value.replace(/((?:\\x[0-9a-f]{2})+)/gi, (group) => {
    const bytes = group.match(/[0-9a-f]{2}/gi).map((hex) => Number.parseInt(hex, 16));
    return Buffer.from(bytes).toString("utf8");
  });
}

function physical(path) {
  try { return realpathSync.native(path); } catch { try { return resolve(path); } catch { return path; } }
}

function makeEnvironment({ env, runtime, binDir, targetDir, nodeExecutable = process.execPath }) {
  const result = { ...env };
  for (const key of OVERRIDE_VARS) delete result[key];
  result.NODE_ENV = "production";
  result.TRADEREVIEW_DB_PATH = runtime.databasePath;
  const bin = join(binDir, "node_modules", ".bin");
  result.PATH = `${dirname(nodeExecutable)}${delimiter}${bin}${delimiter}${result.PATH || ""}`;
  result.WRANGLER_LOG_PATH = join(targetDir, "logs", "wrangler.log");
  return result;
}

function defaultCommandRunner(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { ...options, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = ""; let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; child.kill("SIGTERM"); reject(new Error(`${command} ${args.join(" ")} timed out`)); } }, options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => { clearTimeout(timer); if (!settled) { settled = true; reject(error); } });
    child.once("close", (code, signal) => { clearTimeout(timer); if (settled) return; settled = true; resolvePromise({ code: code ?? 1, signal, stdout, stderr }); });
  });
}

function commandResult(result) {
  return result?.then ? result : Promise.resolve(result);
}

export function createNativeRuntime({ targetDir, runtimeConfig, env = process.env, healthTimeoutMs = 60000, commandRunner = defaultCommandRunner, startCommand, nativeEnvironmentOptions } = {}) {
  if (typeof targetDir !== "string" || !isAbsolute(targetDir)) fail("targetDir must be absolute");
  const target = physical(targetDir);
  const runtime = validateRuntimeConfig(runtimeConfig);
  const logsDir = join(target, "logs");
  let activeService = null;
  let measuredRuntime;

  function assertRuntime() {
    measuredRuntime ??= assertNativeEnvironment(nativeEnvironmentOptions);
    return measuredRuntime;
  }

  function npmCliPath(nodeExecutable) {
    const nodeDir = dirname(nodeExecutable);
    return join(nodeDir, "..", "libexec", "lib", "node_modules", "npm", "bin", "npm-cli.js");
  }

  function ensureLogDirectory() {
    try {
      const stat = lstatSync(logsDir);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("logs must be an ordinary directory");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      mkdirSync(logsDir, { recursive: true });
    }
  }

  function ensureLogFile(path) {
    try {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`log file must be an ordinary file: ${path}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  async function run(command, args, options = {}) {
    const { logPath, ...runnerOptions } = options;
    let result;
    try {
      result = await commandResult(commandRunner(command, args, { shell: false, ...runnerOptions }));
    } catch (error) {
      if (logPath) await appendFileAsync(logPath, `${error.message}\n`);
      throw error;
    }
    if (logPath) await appendFileAsync(logPath, `${result?.stdout || ""}${result?.stderr || ""}`);
    if (result?.code !== 0) throw new Error(`${command} ${args.join(" ")} exited ${result?.code ?? "unknown"}: ${result?.stderr || result?.stdout || ""}`.trim());
    return result;
  }

  async function processInfo(pid) {
    const result = await commandResult(commandRunner("ps", ["-p", String(pid), "-o", "pid=,ppid=,pgid=,lstart=,command="], { shell: false }));
    if (result?.code !== 0 || !result.stdout?.trim()) return null;
    const line = result.stdout.trim().split(/\r?\n/).find(Boolean)?.trim();
    const match = line?.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.{24})\s+(.+)$/);
    if (!match) return null;
    return { pid: Number(match[1]), parentPid: Number(match[2]), groupPid: Number(match[3]), startTime: match[4].trim(), command: match[5].trim() };
  }

  async function listenerPids() {
    const result = await commandResult(commandRunner("lsof", ["-nP", `-iTCP:${runtime.port}`, "-sTCP:LISTEN", "-Fp"], { shell: false }));
    if (result?.code !== 0 && !result?.stdout) {
      if (result?.stderr?.trim()) throw new Error(`Unable to inspect configured port ${runtime.port}: ${result.stderr.trim()}`);
      return [];
    }
    return [...new Set((result.stdout || "").split(/\r?\n/).filter((line) => line.startsWith("p")).map((line) => Number(line.slice(1))).filter(Number.isInteger))];
  }

  async function cwdOf(pid) {
    const result = await commandResult(commandRunner("lsof", ["-nP", "-a", "-p", String(pid), "-d", "cwd", "-Fn"], { shell: false }));
    const value = (result.stdout || "").split(/\r?\n/).find((line) => line.startsWith("n"));
    return value ? decodeEscapedPath(value.slice(1)) : null;
  }

  async function executableOf(pid) {
    const result = await commandResult(commandRunner("lsof", ["-nP", "-a", "-p", String(pid), "-d", "txt", "-Fn"], { shell: false }));
    const value = (result.stdout || "").split(/\r?\n/).find((line) => line.startsWith("n"));
    return value ? decodeEscapedPath(value.slice(1)) : null;
  }

  async function inspectDetailed() {
    const pids = await listenerPids();
    if (pids.length > 1) throw new Error(`Refusing ambiguous port ownership: ${pids.join(", ")}`);
    for (const pid of pids) {
      const [info, cwd, executable] = await Promise.all([processInfo(pid), cwdOf(pid), executableOf(pid)]);
      if (pids.length && (!info || !cwd)) throw new Error(`Unable to verify listener identity for PID ${pid}`);
      if (info && cwd) return { ...info, cwd: physical(cwd), executable: executable ? physical(executable) : null };
    }
    return null;
  }

  function publicInfo(info) { return info ? { pid: info.pid, cwd: info.cwd, command: info.command, executable: info.executable ?? null, startTime: info.startTime } : null; }

  function isOwned(info, releaseDir, service) {
    if (!info || physical(info.cwd) !== physical(releaseDir)) return false;
    if (service && info.pid !== service.pid) return false;
    // A missing start timestamp is ambiguous: PID/cwd/command can all be
    // reused by another process. Never signal a live process without a
    // verified timestamp from the owned child.
    if (service?.startTime == null || info.startTime !== service.startTime) return false;
    if (activeService?.pid === service?.pid && activeService.startTime === service.startTime) return true;
    return /(?:start-local\.mjs|vinext(?:\.cmd)?\s+(?:start|dev))/.test(info.command);
  }

  async function inspect() { return publicInfo(await inspectDetailed()); }

  async function build(releaseDir) {
    const native = assertRuntime();
    const cwd = physical(releaseDir);
    if (!existsSync(cwd)) throw new Error(`Release directory does not exist: ${releaseDir}`);
    ensureLogDirectory();
    ensureLogFile(join(logsDir, "wrangler.log"));
    const buildLog = join(logsDir, `build-${basename(cwd)}.log`);
    ensureLogFile(buildLog);
    const options = { cwd, env: makeEnvironment({ env, runtime, binDir: cwd, targetDir: target, nodeExecutable: native.nodeExecutable }), timeoutMs: DEFAULT_COMMAND_TIMEOUT, logPath: buildLog };
    const npmCli = npmCliPath(native.nodeExecutable);
    if (!existsSync(npmCli)) throw new Error(`npm CLI for pinned Node is missing: ${npmCli}`);
    await run(native.nodeExecutable, [npmCli, "ci", "--include=dev"], options);
    await run(native.nodeExecutable, [npmCli, "run", "build"], options);
  }

  async function start(releaseDir) {
    const native = assertRuntime();
    const cwd = physical(releaseDir);
    const existing = await inspectDetailed();
    if (existing) throw new Error(`Refusing to start: port ${runtime.port} is owned by a foreign or already-running listener (${existing.pid})`);
    ensureLogDirectory();
    ensureLogFile(join(logsDir, "wrangler.log"));
    const logPath = join(logsDir, `service-${runtime.port}.log`);
    ensureLogFile(logPath);
    const output = openSync(logPath, "a");
    const serviceEnv = makeEnvironment({ env, runtime, binDir: cwd, targetDir: target, nodeExecutable: native.nodeExecutable });
    const spec = { releaseDir: cwd, cwd, env: serviceEnv, hostname: runtime.hostname, port: runtime.port, command: native.nodeExecutable, args: [join(cwd, "scripts", "start-local.mjs"), "--hostname", runtime.hostname, "--port", String(runtime.port)], logPath };
    let child;
    try {
      child = startCommand ? await startCommand(spec) : spawn(spec.command, spec.args, { cwd, env: serviceEnv, detached: true, stdio: ["ignore", output, output], shell: false });
      if (!child?.pid) throw new Error("start command did not return a process");
      child.unref?.();
      closeSync(output);
      let observed = await processInfo(child.pid);
      const identityDeadline = Date.now() + 500;
      while (!observed && Date.now() < identityDeadline) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
        observed = await processInfo(child.pid);
      }
      const service = { pid: child.pid, groupPid: observed?.groupPid || child.pid, cwd, command: observed?.command || `${spec.command} ${spec.args.join(" ")}`, startTime: observed?.startTime ?? null, releaseDir: cwd };
      activeService = service;
      child.once?.("error", () => {});
      return service;
    } catch (error) {
      try { if (child?.pid) process.kill(-child.pid, "SIGTERM"); } catch {}
      throw error;
    }
  }

  async function waitHealthy(releaseDir) {
    const deadline = Date.now() + healthTimeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      const info = await inspectDetailed();
      // A status probe has no owned child handle. It may verify an already
      // running pinned listener read-only; only a runtime-owned start may
      // adopt a different listener PID through the wrapper identity proof.
      let adoptedFromVerifiedOwner = !activeService || info?.pid === activeService.pid;
      if (info && activeService && info.pid !== activeService.pid) {
        const owner = await processInfo(activeService.pid);
        const ownerCwd = owner ? await cwdOf(activeService.pid) : null;
        adoptedFromVerifiedOwner = Boolean(owner && owner.startTime === activeService.startTime && owner.groupPid === activeService.groupPid && ownerCwd && physical(ownerCwd) === physical(releaseDir));
      }
      if (info && physical(info.cwd) === physical(releaseDir) && info.executable === assertRuntime().nodeExecutable && adoptedFromVerifiedOwner && (!activeService || (info.pid === activeService.pid ? info.startTime === activeService.startTime : info.groupPid === activeService.groupPid))) {
        try {
          const base = `http://${runtime.hostname.includes(":") ? `[${runtime.hostname}]` : runtime.hostname}:${runtime.port}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), Math.max(50, Math.min(1000, deadline - Date.now())));
          let responses;
          try {
            responses = await Promise.all([fetch(`${base}/`, { signal: controller.signal }), fetch(`${base}/api/storage/status`, { signal: controller.signal })]);
          } finally { clearTimeout(timer); }
          if (responses.every((response) => response.status >= 200 && response.status < 300)) {
            if (activeService) activeService.listener = { pid: info.pid, groupPid: info.groupPid, startTime: info.startTime, cwd: info.cwd, executable: info.executable };
            return publicInfo(info);
          }
          lastError = new Error(`health endpoint returned ${responses.map((response) => response.status).join(",")}`);
        } catch (error) { lastError = error; }
      } else if (info) lastError = new Error("listener cwd does not match release");
      await new Promise((resolvePromise) => setTimeout(resolvePromise, POLL_INTERVAL));
    }
    throw new Error(`Native service health timeout: ${lastError?.message || "listener did not start"}`);
  }

  async function stop(service) {
    if (!service?.pid) throw new Error("service handle is required");
    const info = await processInfo(service.pid);
    if (!info) {
      const current = await inspectDetailed();
      if (!current) { if (activeService?.pid === service.pid) activeService = null; return; }
      if (service.startTime == null) throw new Error("Refusing to stop ambiguous process without verified start identity");
      const listener = activeService?.listener;
      const verifiedOrphan = activeService?.pid === service.pid
        && service.startTime != null
        && activeService.startTime === service.startTime
        && listener?.pid === current.pid
        && listener.startTime === current.startTime
        && listener.groupPid === current.groupPid
        && physical(listener.cwd) === physical(current.cwd)
        && listener.executable === current.executable;
      if (!verifiedOrphan) throw new Error("Refusing to stop unrelated or stale process");
      try { process.kill(-service.groupPid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
    } else {
      if (!isOwned({ ...info, cwd: await cwdOf(service.pid) }, service.cwd, service)) throw new Error("Refusing to stop unrelated or stale process");
      try { process.kill(-service.groupPid || -service.pid, "SIGTERM"); } catch (error) {
        if (error.code === "ESRCH") {
          try { process.kill(service.pid, "SIGTERM"); } catch (directError) { if (directError.code !== "ESRCH") throw directError; }
        } else throw error;
      }
    }
    const deadline = Date.now() + Math.min(healthTimeoutMs, 10000);
    while (Date.now() < deadline) {
      const current = await inspectDetailed();
      if (!current) { if (activeService?.pid === service.pid) activeService = null; return; }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, POLL_INTERVAL));
    }
    throw new Error("Timed out waiting for native service port to become free");
  }

  return { inspect, build, start, waitHealthy, stop, runtime: () => assertRuntime() };
}
