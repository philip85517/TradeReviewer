import { DatabaseSync, backup as sqliteBackup } from "node:sqlite";
import { execFileSync, spawn } from "node:child_process";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEBUG_HOSTNAME = "127.0.0.1";
export const DEBUG_PORT = 3333;
export const DEBUG_DATABASE_NAME = ".data/tradereview-test.sqlite";

function fail(message) { throw new Error(`Cannot start debug server: ${message}`); }

function projectRoot() { return resolve(dirname(fileURLToPath(import.meta.url)), ".."); }

function rejectRedirects(argv, env) {
  const forbidden = /^(?:--?(?:port|host|hostname|db|database|database-path|source|runtime-config)(?:=|$)|--dev=.*)/;
  const badArg = argv.find((arg) => forbidden.test(arg));
  if (badArg) fail(`standard debug launcher does not accept redirecting flag ${badArg}`);
  for (const name of ["TRADEREVIEW_DB_PATH", "TRADEREVIEW_RUNTIME_CONFIG"]) {
    if (env[name]?.trim()) fail(`standard debug launcher does not accept ${name}; use the lower-level launcher for isolated tests`);
  }
}

function readProductionConfig(root, read = readFileSync) {
  const path = join(root, "conf", "runtime.json");
  let parsed;
  try { parsed = JSON.parse(read(path, "utf8")); } catch (error) { fail(`cannot read production runtime config ${path}: ${error.message}`); }
  if (!parsed || typeof parsed.databasePath !== "string" || !isAbsolute(parsed.databasePath)) fail("conf/runtime.json must contain an absolute databasePath");
  return { path, databasePath: resolve(parsed.databasePath) };
}

function targetPath(root) { return resolve(root, DEBUG_DATABASE_NAME); }

function lsofHas(args) {
  try { execFileSync("lsof", ["-nP", "-t", ...args], { stdio: "ignore" }); return true; }
  catch (error) { if (error?.status === 1) return false; throw new Error(`lsof safety check failed: ${error.message}`); }
}

function defaultPortOccupied(port, hostname) {
  return lsofHas([`-iTCP:${port}`, "-sTCP:LISTEN"]);
}

function defaultPathOpen(path) { return lsofHas(["--", path]); }

function sameFile(a, b, fs = {}) {
  const lstat = fs.lstat ?? lstatSync;
  const stat = fs.stat ?? statSync;
  const realpath = fs.realpath ?? realpathSync;
  let sa, sb;
  try { sa = lstat(a); sb = lstat(b); } catch { return false; }
  if (sa.isSymbolicLink() || sb.isSymbolicLink()) return true;
  if (sa.dev === sb.dev && sa.ino === sb.ino) return true;
  try { return realpath(a) === realpath(b); } catch { return false; }
}

function rejectSymlinkComponents(path, fs = {}) {
  const lstat = fs.lstat ?? lstatSync;
  const parts = resolve(path).split("/");
  let current = "/";
  for (const part of parts.slice(1)) {
    if (!part) continue;
    current = join(current, part);
    // macOS exposes /var as a compatibility symlink to /private/var; this OS alias
    // is safe and must not mask checks on project-owned descendants.
    if (current === "/var") continue;
    try { if (lstat(current).isSymbolicLink()) fail(`unsafe symlink path component: ${current}`); }
    catch (error) { if (error.code !== "ENOENT") throw error; break; }
  }
}

function sidecarPaths(path) { return [`${path}-wal`, `${path}-shm`]; }

function rejectHardlink(path, fs = {}) {
  try { if ((fs.lstat ?? lstatSync)(path).nlink > 1) fail(`unsafe hard-linked database path: ${path}`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

export function resolveDebugPaths(options = {}) {
  const root = resolve(options.root ?? projectRoot());
  const source = readProductionConfig(root, options.readFile ?? readFileSync).databasePath;
  const target = targetPath(root);
  return { root, source, target, lockPath: `${target}.debug.lock`, hostname: DEBUG_HOSTNAME, port: DEBUG_PORT };
}

export function assertDebugPreflight(paths, options = {}) {
  const fs = options.fs ?? {};
  rejectSymlinkComponents(paths.source, fs);
  rejectSymlinkComponents(paths.target, fs);
  for (const sidecar of [...sidecarPaths(paths.source), ...sidecarPaths(paths.target)]) { rejectSymlinkComponents(sidecar, fs); rejectHardlink(sidecar, fs); }
  const sourceExists = (options.exists ?? existsSync)(paths.source);
  if (!sourceExists) fail(`configured production database does not exist: ${paths.source}`);
  const sourceStat = (fs.lstat ?? lstatSync)(paths.source);
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) fail("configured production database must be a regular file");
  if (sourceStat.nlink > 1) fail("configured production database must not be hard-linked");
  if (sameFile(paths.source, paths.target, fs)) fail("source and fixed debug database alias each other");
  try {
    const targetStat = (fs.lstat ?? lstatSync)(paths.target);
    if (targetStat.isSymbolicLink()) fail("fixed debug database must not be a symlink");
    if (!targetStat.isFile()) fail("fixed debug database path is not a regular file");
    if (targetStat.nlink > 1) fail("fixed debug database must not be hard-linked");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const targetPath of [paths.target, ...sidecarPaths(paths.target)]) {
    if ((options.isOpen ?? defaultPathOpen)(targetPath)) fail(`fixed debug database path is already open: ${targetPath}`);
  }
  if ((options.isPortOccupied ?? defaultPortOccupied)(paths.port, paths.hostname)) fail(`port ${paths.port} is already occupied`);
}

export function acquireDebugLock(lockPath, options = {}) {
  const open = options.open ?? openSync;
  mkdirSync(dirname(lockPath), { recursive: true });
  let fd;
  try { fd = open(lockPath, "wx", 0o600); } catch (error) { if (error.code === "EEXIST") fail("another debug launcher is already preparing or serving this worktree"); throw error; }
  try { fsyncSync(fd); } catch {}
  let released = false;
  return { fd, release() { if (released) return; released = true; try { closeSync(fd); } finally { try { rmSync(lockPath, { force: true }); } catch {} } } };
}

export async function prepareDebugDatabase(paths, options = {}) {
  assertDebugPreflight(paths, options);
  const lock = options.lock ?? acquireDebugLock(paths.lockPath, options);
  const temporary = `${paths.target}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const openDatabase = options.openDatabase ?? ((path, opts) => new DatabaseSync(path, opts));
  try {
    if (options.signal?.aborted) fail("startup cancelled");
    assertDebugPreflight(paths, options);
    mkdirSync(dirname(paths.target), { recursive: true });
    const sourceDb = openDatabase(paths.source, { readOnly: true });
    let backupPromise;
    try {
      backupPromise = Promise.resolve((options.backup ?? sqliteBackup)(sourceDb, temporary));
      if (options.signal) {
        options.signal.addEventListener("abort", () => { backupPromise.finally(() => { try { rmSync(temporary, { force: true }); } catch {} }).catch(() => {}); }, { once: true });
        await Promise.race([backupPromise, new Promise((_, reject) => options.signal.addEventListener("abort", () => reject(new Error("startup cancelled")), { once: true }))]);
      } else await backupPromise;
    } finally { sourceDb.close(); }
    const checked = openDatabase(temporary, { readOnly: true });
    try {
      const row = checked.prepare("PRAGMA quick_check").get();
      const result = row && Object.values(row)[0];
      if (result !== "ok") fail(`SQLite quick_check failed: ${result ?? "unknown result"}`);
    } finally { checked.close(); }
    if (options.signal?.aborted) fail("startup cancelled");
    assertDebugPreflight(paths, options);
    const quarantined = [];
    let published = false;
    const rename = options.rename ?? renameSync;
    const remove = options.remove ?? rmSync;
    try {
      for (const sidecar of sidecarPaths(paths.target)) {
        if (existsSync(sidecar)) {
          const quarantine = `${sidecar}.quarantine-${process.pid}-${Date.now()}`;
          rename(sidecar, quarantine); quarantined.push([sidecar, quarantine]);
        }
      }
      rename(temporary, paths.target);
      published = true;
      for (const [, quarantine] of quarantined) remove(quarantine, { force: true });
    } catch (error) {
      if (!published) for (const [sidecar, quarantine] of quarantined.reverse()) { try { if (existsSync(quarantine)) rename(quarantine, sidecar); } catch {} }
      throw error;
    }
    return lock;
  } catch (error) {
    try { rmSync(temporary, { force: true }); } catch {}
    lock.release();
    throw error;
  }
}

async function loadNativeAssertion() {
  try { return (await import("./native-environment.mjs")).assertNativeEnvironment; }
  catch (error) { fail(`native environment assertion unavailable: ${error.message}`); }
}

export async function startDebugServer(options = {}) {
  const argv = options.argv ?? process.argv.slice(2);
  const env = options.env ?? process.env;
  rejectRedirects(argv, env);
  const assertNative = options.assertNativeEnvironment ?? await loadNativeAssertion();
  assertNative(options.nativeOptions ?? {});
  const controller = new AbortController();
  let child;
  let shutdown;
  const earlySignals = ["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => {
    const handler = () => { controller.abort(); if (shutdown) shutdown(1); else if (child) { try { if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal); else child.kill(signal); } catch {} } };
    process.on(signal, handler); return [signal, handler];
  });
  let paths;
  let lock;
  try { paths = resolveDebugPaths(options); lock = await prepareDebugDatabase(paths, { ...options, signal: controller.signal }); }
  catch (error) { for (const [name, handler] of earlySignals) process.off(name, handler); throw error; }
  const nodeDir = dirname(process.execPath);
  const childEnv = { ...env, PATH: `${nodeDir}:${join(paths.root, "node_modules", ".bin")}:${env.PATH ?? ""}`, TRADEREVIEW_DB_PATH: paths.target };
  try {
    child = (options.spawn ?? spawn)(process.execPath, [join(paths.root, "scripts", "start-local.mjs"), "--dev", "--hostname", DEBUG_HOSTNAME, "--port", String(DEBUG_PORT)], { cwd: paths.root, env: childEnv, stdio: "inherit", detached: process.platform !== "win32" });
  } catch (error) { for (const [name, handler] of earlySignals) process.off(name, handler); lock.release(); throw error; }
  let done = false;
  const killTree = (signal) => { try { if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal); else child.kill(signal); } catch {} };
  const waitForGone = async () => {
    if (process.platform === "win32" || !child.pid) return true;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try { process.kill(-child.pid, 0); } catch (error) { if (error.code === "ESRCH") return true; }
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    return false;
  };
  const finish = async (code = 1) => { if (done) return; done = true; for (const [name, handler] of earlySignals) process.off(name, handler); killTree("SIGTERM"); await new Promise((resolveWait) => setTimeout(resolveWait, 100)); killTree("SIGKILL"); const gone = await waitForGone(); if (gone) { lock.release(); process.exitCode = code; } else { console.error("Cannot prove debug child process group exited; retaining debug lock for safety"); process.exitCode = 1; } };
  shutdown = finish;
  const signals = earlySignals;
  child.once("error", (error) => { console.error(`无法启动本地服务：${error.message}`); finish(1); });
  child.once("close", (code, signal) => { for (const [name, handler] of signals) process.off(name, handler); finish(signal ? 1 : (code ?? 1)); });
  return { child, lock, paths };
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) startDebugServer().catch((error) => { console.error(error.message); process.exitCode = 1; });
