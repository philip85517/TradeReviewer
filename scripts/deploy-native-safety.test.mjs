import { mkdtemp, mkdir, readFile, readlink, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { runNativeDeployment } from "./deploy-native.mjs";
import { acquireDeploymentLock } from "./deploy.mjs";

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "tradereview-native-safety-")));
  const targetDir = join(root, "target");
  const sourceDir = join(root, "source");
  const oldRelease = join(targetDir, "app", "releases", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await mkdir(oldRelease, { recursive: true });
  await mkdir(join(sourceDir, ".git"), { recursive: true });
  await mkdir(join(targetDir, "config"), { recursive: true });
  await writeFile(join(targetDir, "config", "runtime.json"), JSON.stringify({
    databasePath: join(root, "database.sqlite"), hostname: "127.0.0.1", port: 4321,
  }));
  await writeFile(join(targetDir, "config", ".env"), "RELEASES_TO_KEEP=1\n");
  await mkdir(join(targetDir, "ops"), { recursive: true });
  await writeFile(join(targetDir, "ops", "deploy-native.mjs"), "toolkit sentinel\n");
  await writeFile(join(root, "database.sqlite"), "sqlite sentinel");
  await writeFile(join(sourceDir, "package.json"), JSON.stringify({ version: "1.2.3" }));
  await symlink(join("releases", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), join(targetDir, "app", "current"));
  return { root, targetDir, sourceDir, oldRelease };
}

function dependencies(fixture, runtime) {
  return {
    runtimeFactory: () => runtime,
    resolveReleaseSource: async () => ({ commit: "a".repeat(40), requestedRef: "current", branch: "main", resolvedRef: "HEAD" }),
    createSourceSnapshot: async ({ destinationDir }) => {
      await writeFile(join(destinationDir, "package.json"), "{}");
      return destinationDir;
    },
  };
}

async function deploy(fixture, runtime, extra = {}) {
  return runNativeDeployment({ mode: "deploy", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir, ...extra }, dependencies(fixture, runtime));
}

test("does not stop an active service whose PID is reused with a new start time", async () => {
  const f = await fixture();
  let inspectCalls = 0;
  let stopCalls = 0;
  const runtime = {
    inspect: async () => { inspectCalls += 1; return inspectCalls === 1
      ? { pid: 700, startTime: "started-before-build", cwd: f.oldRelease, command: "node start-local.mjs" }
      : { pid: 700, startTime: "different-process", cwd: f.oldRelease, command: "node start-local.mjs" }; },
    build: async () => undefined,
    stop: async () => { stopCalls += 1; },
  };
  await assert.rejects(deploy(f, runtime), /Active service changed during build/);
  assert.equal(stopCalls, 0, "PID reuse must never stop the replacement process");
  assert.equal(await readlink(join(f.targetDir, "app", "current")), join("releases", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
  await rm(f.root, { recursive: true, force: true });
});

test("does not stop an unexpected listener that appears during a build", async () => {
  const f = await fixture();
  let inspections = 0;
  let stopCalls = 0;
  const runtime = {
    inspect: async () => {
      inspections += 1;
      return inspections === 1 ? null : { pid: 799, startTime: "foreign", cwd: join(f.root, "foreign"), command: "python foreign.py" };
    },
    build: async () => undefined,
    stop: async () => { stopCalls += 1; },
  };
  await assert.rejects(deploy(f, runtime), /Unexpected native listener|foreign|listener/i);
  assert.equal(stopCalls, 0);
  await rm(f.root, { recursive: true, force: true });
});

test("an unhealthy A-to-B release recovers the old service", async () => {
  const f = await fixture();
  const starts = [];
  const stops = [];
  const waits = [];
  const runtime = {
    inspect: async () => ({ pid: 701, startTime: "old", cwd: f.oldRelease, command: "node start-local.mjs" }),
    build: async () => undefined,
    stop: async (service) => { stops.push(service.cwd); },
    start: async (releaseDir) => { starts.push(resolve(releaseDir)); return { pid: 702, startTime: String(starts.length), cwd: resolve(releaseDir), command: "node start-local.mjs" }; },
    waitHealthy: async (releaseDir) => { waits.push(resolve(releaseDir)); if (waits.length === 1) throw new Error("candidate unhealthy"); return { pid: 703, cwd: resolve(releaseDir), command: "node start-local.mjs" }; },
  };
  await assert.rejects(deploy(f, runtime), /candidate unhealthy/);
  assert.equal(starts.length, 2);
  assert.equal(starts[1], f.oldRelease);
  assert.deepEqual(stops, [f.oldRelease, starts[0]]);
  assert.deepEqual(waits, [starts[0], f.oldRelease]);
  assert.equal(await readlink(join(f.targetDir, "app", "current")), join("releases", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
  await rm(f.root, { recursive: true, force: true });
});

test("preserves the candidate release when old-service recovery fails", async () => {
  const f = await fixture();
  let candidate;
  let starts = 0;
  const runtime = {
    inspect: async () => ({ pid: 704, startTime: "old", cwd: f.oldRelease, command: "node start-local.mjs" }),
    build: async () => undefined,
    stop: async () => undefined,
    start: async (releaseDir) => {
      starts += 1;
      if (starts === 1) { candidate = resolve(releaseDir); return { pid: 705, startTime: "candidate", cwd: candidate, command: "node start-local.mjs" }; }
      throw new Error("old service recovery failed");
    },
    waitHealthy: async () => { throw new Error("candidate unhealthy"); },
  };
  await assert.rejects(deploy(f, runtime), /recovery failed/);
  assert.ok(candidate);
  assert.ok((await readdir(join(f.targetDir, "app", "releases"))).some((name) => join(f.targetDir, "app", "releases", name) === candidate));
  await rm(f.root, { recursive: true, force: true });
});

test("post-publication failure recovers service and toolkit while the deployment lock is held", async () => {
  const f = await fixture();
  try {
    let active = { pid: 706, startTime: "old", cwd: f.oldRelease, command: "node start-local.mjs" };
    const stops = [];
    const starts = [];
    const assertLocked = () => assert.rejects(acquireDeploymentLock(f.targetDir), /already running|lock|busy|locked/i);
    const runtime = {
      inspect: async () => active,
      build: async () => undefined,
      stop: async (handle) => { await assertLocked(); stops.push(handle); active = null; },
      start: async (releaseDir) => {
        await assertLocked();
        starts.push(releaseDir);
        // The launcher wrapper and listener have distinct process identities.
        const wrapper = { pid: 707 + starts.length * 2, startTime: `wrapper-${starts.length}`, cwd: resolve(releaseDir) };
        active = { pid: wrapper.pid + 1, startTime: `child-${starts.length}`, cwd: wrapper.cwd };
        return wrapper;
      },
      waitHealthy: async () => active,
    };
    await assert.rejects(deploy(f, runtime), /RELEASES_TO_KEEP|integer/);
    assert.equal(await readlink(join(f.targetDir, "app", "current")), join("releases", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
    assert.equal(await readFile(join(f.targetDir, "ops", "deploy-native.mjs"), "utf8"), "toolkit sentinel\n");
    assert.equal(stops.length, 2);
    assert.equal(stops[1].pid, 709, "recovery stops the original wrapper after checking its distinct child listener");
    assert.equal(starts.length, 2);
    assert.equal(active.cwd, f.oldRelease);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test("down and rollback refuse a held deployment lock before inspecting", async () => {
  const f = await fixture();
  const release = await acquireDeploymentLock(f.targetDir);
  let inspected = 0;
  try {
    for (const mode of ["down", "rollback"]) {
      await assert.rejects(runNativeDeployment({ mode, targetDir: f.targetDir }, {
        runtimeFactory: () => ({ inspect: async () => { inspected += 1; return null; } }),
      }), /already running|lock|busy|locked/i);
    }
    assert.equal(inspected, 0);
  } finally { await release(); await rm(f.root, { recursive: true, force: true }); }
});
