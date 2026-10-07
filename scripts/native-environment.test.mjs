import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import process from "node:process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assertNativeEnvironment, nativeEnvironmentProfilePath } from "./native-environment.mjs";

const nativeProfile = JSON.parse(readFileSync(nativeEnvironmentProfilePath(), "utf8"));
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function runBootstrap(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function bootstrapFixture(profile) {
  const root = await mkdtemp(join(tmpdir(), "tradereview-native-node-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "conf"), { recursive: true });
    const source = join(repositoryRoot, "scripts", "native-node.sh");
    const bootstrap = join(root, "scripts", "native-node.sh");
    await cp(source, bootstrap);
    await chmod(bootstrap, 0o755);
    await writeFile(join(root, "conf", "native-environment.json"), JSON.stringify(profile));
    return { root, bootstrap };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function ambientNodeWrapper(root) {
  const ambient = join(root, "ambient");
  const log = join(root, "ambient.log");
  await mkdir(ambient, { recursive: true });
  const wrapper = join(ambient, "node");
  await writeFile(wrapper, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$BOOTSTRAP_AMBIENT_LOG\"\nexec \"$BOOTSTRAP_REAL_NODE\" \"$@\"\n");
  await chmod(wrapper, 0o755);
  return { ambient, log };
}

test("native shell bootstrap uses the configured runtime for SQL, execPath, and quoted args", async () => {
  const fixture = await bootstrapFixture({ nodeVersion: nativeProfile.nodeVersion, sqliteVersion: nativeProfile.sqliteVersion, nodeExecutable: nativeProfile.nodeExecutable });
  try {
    const ambient = await ambientNodeWrapper(fixture.root);
    const script = "const { DatabaseSync } = await import('node:sqlite'); const db = new DatabaseSync(':memory:'); process.stdout.write(JSON.stringify({ execPath: process.execPath, sqliteVersion: db.prepare('SELECT sqlite_version() AS version').get().version, args: process.argv.slice(1) })); db.close();";
    const args = ["--input-type=module", "-e", script, "arg with spaces", "quote'arg", "$HOME", "--configured-sentinel"];
    const result = await runBootstrap(fixture.bootstrap, args, { cwd: fixture.root, env: { ...process.env, PATH: `${ambient.ambient}:${process.env.PATH ?? ""}`, BOOTSTRAP_AMBIENT_LOG: ambient.log, BOOTSTRAP_REAL_NODE: process.execPath } });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { execPath: nativeProfile.nodeExecutable, sqliteVersion: nativeProfile.sqliteVersion, args: args.slice(3) });
    const ambientCalls = await readFile(ambient.log, "utf8");
    assert.doesNotMatch(ambientCalls, /configured-sentinel/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("native shell bootstrap rejects a missing configured runtime without PATH fallback", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "tradereview-native-node-missing-"));
  let fixture;
  try {
    const ambient = await ambientNodeWrapper(fixtureRoot);
    fixture = await bootstrapFixture({ nodeVersion: process.versions.node, sqliteVersion: nativeProfile.sqliteVersion, nodeExecutable: join(fixtureRoot, "missing-node") });
    const result = await runBootstrap(fixture.bootstrap, ["-e", "process.stdout.write('ambient fallback')", "--ambient-fallback-sentinel"], { cwd: fixture.root, env: { ...process.env, PATH: `${ambient.ambient}:${process.env.PATH ?? ""}`, BOOTSTRAP_AMBIENT_LOG: ambient.log, BOOTSTRAP_REAL_NODE: process.execPath } });
    assert.notEqual(result.code, 0);
    const ambientCalls = await readFile(ambient.log, "utf8");
    assert.doesNotMatch(ambientCalls, /ambient-fallback-sentinel/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
    if (fixture) await rm(fixture.root, { recursive: true, force: true });
  }
});

test("accepts the pinned native runtime and reports measured values", () => {
  const result = assertNativeEnvironment({
    versions: { node: nativeProfile.nodeVersion, sqlite: nativeProfile.sqliteVersion },
    execPath: nativeProfile.nodeExecutable,
    getSqliteVersion: () => nativeProfile.sqliteVersion,
  });
  assert.deepEqual(result, {
    nodeVersion: nativeProfile.nodeVersion,
    sqliteVersion: nativeProfile.sqliteVersion,
    nodeExecutable: nativeProfile.nodeExecutable,
  });
});

test("rejects a runtime mismatch synchronously", () => {
  assert.throws(() => assertNativeEnvironment({ versions: { node: "25.0.0", sqlite: nativeProfile.sqliteVersion }, execPath: nativeProfile.nodeExecutable, getSqliteVersion: () => nativeProfile.sqliteVersion }), (error) => error instanceof Error && error.message.includes(`Node.js ${nativeProfile.nodeVersion} is required`));
  assert.throws(() => assertNativeEnvironment({ versions: { node: nativeProfile.nodeVersion, sqlite: nativeProfile.sqliteVersion }, execPath: nativeProfile.nodeExecutable, getSqliteVersion: () => "3.52.0" }), (error) => error instanceof Error && error.message.includes(`SQLite ${nativeProfile.sqliteVersion} is required`));
  assert.throws(() => assertNativeEnvironment({ versions: { node: nativeProfile.nodeVersion, sqlite: nativeProfile.sqliteVersion }, execPath: "/bad/node", getSqliteVersion: () => nativeProfile.sqliteVersion }), /executable/);
});

test("rejects a profile that matches build metadata but mismatches the live SQLite engine", () => {
  const root = mkdtempSync(join(tmpdir(), "tradereview-native-engine-"));
  const profile = join(root, "profile.json");
  const database = new DatabaseSync(":memory:");
  try {
    const liveSqliteVersion = database.prepare("SELECT sqlite_version() AS version").get().version;
    assert.notEqual(liveSqliteVersion, "0.0.0");
    writeFileSync(profile, JSON.stringify({
      nodeVersion: process.versions.node,
      sqliteVersion: "0.0.0",
      nodeExecutable: process.execPath,
    }));
    assert.throws(() => assertNativeEnvironment({
      profilePath: profile,
      versions: { node: process.versions.node, sqlite: "0.0.0" },
      execPath: process.execPath,
    }), /SQLite 0\.0\.0/);
  } finally {
    database.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects missing and malformed profiles without fallback values", () => {
  const root = mkdtempSync(join(tmpdir(), "tradereview-native-profile-"));
  try {
    assert.throws(() => assertNativeEnvironment({ profilePath: join(root, "missing.json") }), /cannot read profile/i);
    const profile = join(root, "profile.json");
    writeFileSync(profile, JSON.stringify({ nodeVersion: "26.0.0", sqliteVersion: "3.53.0" }));
    assert.throws(() => assertNativeEnvironment({ profilePath: profile }), /nodeExecutable is required/i);
    writeFileSync(profile, "[");
    assert.throws(() => assertNativeEnvironment({ profilePath: profile }), /cannot read profile/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("source profile matches the pinned Node and built-in SQLite versions", () => {
  const result = assertNativeEnvironment();
  assert.equal(result.nodeVersion, "26.0.0");
  assert.equal(result.sqliteVersion, "3.53.0");
});
