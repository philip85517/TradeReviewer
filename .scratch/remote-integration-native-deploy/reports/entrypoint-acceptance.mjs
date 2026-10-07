import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, rm, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { beginNativeToolkitTransaction } from "../../../scripts/deploy-native-toolkit.mjs";

const run = promisify(execFile);
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const profile = JSON.parse(await readFile(join(repo, "conf/native-environment.json"), "utf8"));
const env = { ...process.env, PATH: "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" };
delete env.TRADEREVIEW_DB_PATH;
delete env.TRADEREVIEW_RUNTIME_CONFIG;
const parent = await realpath(await mkdtemp(join(tmpdir(), "tradereview-entrypoint-acceptance-")));
const target = join(parent, "target with spaces 交易");
const records = {};
const sqlProbe = "const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');process.stdout.write(JSON.stringify({node:process.versions.node,execPath:process.execPath,sqlite:db.prepare('SELECT sqlite_version() AS v').get().v}));db.close();";
function verifyRuntime(value) {
  assert.equal(value.node, profile.nodeVersion);
  assert.equal(value.execPath, profile.nodeExecutable);
  assert.equal(value.sqlite, profile.sqliteVersion);
}
try {
  records.ambient = JSON.parse((await run("node", ["--input-type=module", "-e", sqlProbe], { env })).stdout);
  records.source = JSON.parse((await run(join(repo, "scripts/native-node.sh"), ["--input-type=module", "-e", sqlProbe], { env })).stdout);
  verifyRuntime(records.source);
  await mkdir(join(target, "config"), { recursive: true });
  await mkdir(join(target, "app/releases"), { recursive: true });
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const databasePath = join(target, "fixture.sqlite");
  // Status validates this owned ordinary file; it never opens the business database.
  await writeFile(databasePath, "", { mode: 0o600 });
  await writeFile(join(target, "config/runtime.json"), JSON.stringify({ databasePath, port, hostname: "127.0.0.1" }));
  const toolkit = await beginNativeToolkitTransaction({ targetDir: target });
  await toolkit.discard();
  records.installed = JSON.parse((await run(join(target, "ops/native-node.sh"), ["--input-type=module", "-e", sqlProbe], { env })).stdout);
  verifyRuntime(records.installed);
  for (const [name, cwd, args] of [["sourceMake", repo, ["--silent", "deploy-status", `DEPLOY_ROOT=${target}`]], ["installedMake", target, ["--silent", "deploy-status"]]]) {
    const value = JSON.parse((await run("make", args, { cwd, env })).stdout);
    assert.equal(value.targetDir, target);
    assert.equal(value.toolingRuntime.nodeExecutable, profile.nodeExecutable);
    assert.equal(value.toolingRuntime.sqliteVersion, profile.sqliteVersion);
    assert.equal(value.activeRelease, null);
    assert.equal(value.observed, null);
    records[name] = value;
  }
  const release = join(target, "app/current");
  await mkdir(release);
  await writeFile(join(release, "package.json"), JSON.stringify({ scripts: { start: "node probe.mjs" } }));
  await writeFile(join(release, "probe.mjs"), `${sqlProbe.replace("process.stdout.write(JSON.stringify(", "process.stdout.write('LAUNCHER_PROBE='+JSON.stringify(")}process.stdout.write('\\n');process.exit(23);`);
  let launcher;
  try { await run(join(target, "ops/start-native.command"), [], { env: { ...env, TRADEREVIEW_DB_PATH: "/must-not-open-business-db" } }); }
  catch (error) { launcher = error; }
  assert.equal(launcher?.code, 23, launcher?.stderr);
  records.launcher = JSON.parse(launcher.stdout.split("LAUNCHER_PROBE=")[1].trim());
  verifyRuntime(records.launcher);
  records.launcherExit = launcher.code;
  records.scope = "Owned temporary target, empty fixture file, free port inspected only, SQL probes only in memory; no services started and no business DB opened. Existing services unchanged.";
  await writeFile(new URL("entrypoint-acceptance.json", import.meta.url), JSON.stringify(records, null, 2) + "\n");
  process.stdout.write("PASS: source and installed bootstrap, source and installed make status, installed launcher and exit propagation\n");
} finally {
  await rm(parent, { recursive: true, force: true });
}
