import { mkdtemp, mkdir, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { realpathSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { nativeStatus, parseArgs, runNativeDeployment } from "./deploy-native.mjs";
import { acquireDeploymentLock } from "./deploy.mjs";

async function targetFixture() {
  const root = await mkdtemp(join(tmpdir(), "tradereview-native-cli-"));
  const targetDir = join(root, "target");
  const sourceDir = join(root, "source");
  await mkdir(join(targetDir, "config"), { recursive: true });
  await mkdir(join(targetDir, "app", "releases"), { recursive: true });
  await mkdir(join(sourceDir, ".git"), { recursive: true });
  await writeFile(join(targetDir, "config", "runtime.json"), JSON.stringify({
    databasePath: join(root, "database.sqlite"),
    hostname: "127.0.0.1",
    port: 4321,
  }));
  await writeFile(join(root, "database.sqlite"), "sqlite sentinel");
  await writeFile(join(sourceDir, "package.json"), JSON.stringify({ version: "1.2.3" }));
  return { root, targetDir, sourceDir };
}

describe("native deployment CLI", () => {
  test("parses ref and dry-run options", () => {
    assert.deepEqual(parseArgs(["--mode=deploy", "--source", "/repo", "--target=/target", "--ref", "master", "--dry-run"]), { mode: "deploy", sourceDir: "/repo", targetDir: "/target", ref: "master", dryRun: true });
  });

  test("dry-run reports selected source and leaves target unchanged", async () => {
    const fixture = await targetFixture();
    const before = await readdir(fixture.targetDir, { recursive: true });
    const result = await runNativeDeployment(
      { mode: "deploy", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir, ref: "current", dryRun: true },
      {
        resolveReleaseSource: async () => ({ commit: "a".repeat(40), requestedRef: "current", branch: "main", resolvedRef: "HEAD" }),
        createSourceSnapshot: async () => fixture.sourceDir,
      },
    );
    assert.deepEqual({ dryRun: result.dryRun, sourceSHA: result.sourceSHA, port: result.port }, { dryRun: true, sourceSHA: "a".repeat(40), port: 4321 });
    assert.deepEqual(await readdir(fixture.targetDir, { recursive: true }), before);
  });

  test("rejects a runtime mismatch before source resolution or target filesystem writes", async () => {
    const fixture = await targetFixture();
    let resolved = false;
    const before = await readdir(fixture.targetDir, { recursive: true });
    await assert.rejects(runNativeDeployment({ mode: "deploy", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir }, {
      nativeEnvironmentOptions: { versions: { node: "25.0.0", sqlite: "3.53.0" }, execPath: "/wrong/node" },
      resolveReleaseSource: async () => { resolved = true; return { commit: "a".repeat(40), requestedRef: "current", branch: "main", resolvedRef: "HEAD" }; },
    }), /Node\.js 26\.0\.0/);
    assert.equal(resolved, false);
    assert.deepEqual(await readdir(fixture.targetDir, { recursive: true }), before);
  });

  test("status marks a foreign listener runtime unknown and preserves legacy metadata unknown", async () => {
    const fixture = await targetFixture();
    const release = join(fixture.targetDir, "app", "releases", "legacy");
    await mkdir(release, { recursive: true });
    await writeFile(join(release, "release.json"), JSON.stringify({ accepted: true, fullcommit: "a".repeat(40) }));
    await symlink(join("releases", "legacy"), join(fixture.targetDir, "app", "current"));
    const result = await nativeStatus({ targetDir: fixture.targetDir }, {
      runtimeFactory: () => ({ inspect: async () => ({ pid: 1, cwd: release, executable: "/foreign/node" }), waitHealthy: async () => {} }),
    });
    assert.equal(result.toolingRuntime.nodeVersion, "26.0.0");
    assert.equal(result.serviceRuntime, null);
    assert.equal(result.consistent, false);
    assert.equal(result.metadata.runtime, undefined);
  });

  test("build failure keeps old service and current release", async () => {
    const fixture = await targetFixture();
    const calls = [];
    const runtime = {
      inspect: async () => null,
      build: async () => { calls.push("build"); throw new Error("build failed"); },
      start: async () => { calls.push("start"); return { pid: 12, cwd: "/candidate", command: "node candidate" }; },
      waitHealthy: async () => { calls.push("healthy"); return {}; },
      stop: async () => { calls.push("stop"); },
    };
    await assert.rejects(runNativeDeployment(
      { mode: "deploy", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
      {
        runtimeFactory: () => runtime,
        resolveReleaseSource: async () => ({ commit: "b".repeat(40), requestedRef: "current", branch: "main", resolvedRef: "HEAD" }),
        createSourceSnapshot: async ({ destinationDir }) => { await writeFile(join(destinationDir, "package.json"), "{}"); return destinationDir; },
      },
    ), /build failed/);
    assert.deepEqual(calls, ["build"]);
  });

  test("dry-run down and rollback never inspect or mutate the target", async () => {
    const fixture = await targetFixture();
    let inspected = false;
    for (const mode of ["down", "rollback"]) {
      const result = await runNativeDeployment({ mode, sourceDir: fixture.sourceDir, targetDir: fixture.targetDir, dryRun: true }, {
        runtimeFactory: () => ({ inspect: async () => { inspected = true; return null; } }),
      });
      assert.equal(result.dryRun, true);
      assert.equal(result.mode, mode);
    }
    assert.equal(inspected, false);
  });

  test("rejects malformed and symlink runtime configuration", async () => {
    const fixture = await targetFixture();
    await writeFile(join(fixture.targetDir, "config", "runtime.json"), "{}\n");
    await assert.rejects(runNativeDeployment({ mode: "down", targetDir: fixture.targetDir }), /loopback hostname/);
    await unlink(join(fixture.targetDir, "config", "runtime.json"));
    await symlink(join(fixture.sourceDir, "package.json"), join(fixture.targetDir, "config", "runtime.json"));
    await assert.rejects(runNativeDeployment({ mode: "down", targetDir: fixture.targetDir }), /regular file/);
  });

  test("refuses to stop a listener without an active release", async () => {
    const fixture = await targetFixture();
    const runtime = { inspect: async () => ({ pid: 9, cwd: join(fixture.root, "foreign"), command: "foreign" }), stop: async () => { throw new Error("must not stop"); } };
    await assert.rejects(runNativeDeployment({ mode: "down", targetDir: fixture.targetDir }, { runtimeFactory: () => runtime }), /outside active native release/);
  });

  test("rejects ambient runtime overrides for mutating modes", async () => {
    const fixture = await targetFixture();
    const previous = process.env.TRADEREVIEW_DB_PATH;
    process.env.TRADEREVIEW_DB_PATH = fixture.root;
    try { await assert.rejects(runNativeDeployment({ mode: "down", targetDir: fixture.targetDir }), /ambient runtime overrides/); }
    finally { if (previous === undefined) delete process.env.TRADEREVIEW_DB_PATH; else process.env.TRADEREVIEW_DB_PATH = previous; }
  });

  test("rejects external current and config symlinks without touching the outsider", async () => {
    const fixture = await targetFixture();
    const outsider = join(fixture.root, "outsider");
    await mkdir(join(outsider, "releases", "same"), { recursive: true });
    await symlink(join(outsider, "releases", "same"), join(fixture.targetDir, "app", "current"));
    await assert.rejects(runNativeDeployment({ mode: "down", targetDir: fixture.targetDir }), /current|active native release/);
    await unlink(join(fixture.targetDir, "app", "current"));
    await rm(join(fixture.targetDir, "config"), { recursive: true });
    await mkdir(fixture.targetDir, { recursive: true });
    await symlink(join(outsider, "runtime.json"), join(fixture.targetDir, "config"));
    await assert.rejects(runNativeDeployment({ mode: "down", targetDir: fixture.targetDir }), /runtime config ancestors/);
    assert.ok((await readdir(outsider, { recursive: true })).length > 0);
  });

  test("rejects a held deployment lock before inspecting or stopping", async () => {
    const fixture = await targetFixture();
    const release = await acquireDeploymentLock(fixture.targetDir);
    let inspected = false;
    try {
      await assert.rejects(runNativeDeployment({ mode: "down", targetDir: fixture.targetDir }, {
        runtimeFactory: () => ({ inspect: async () => { inspected = true; return null; } }),
      }), /already running|lock|busy|locked/i);
      assert.equal(inspected, false);
    } finally { await release(); }
  });

  test("rejects source and target overlap before snapshot or mutation", async () => {
    const fixture = await targetFixture();
    await assert.rejects(runNativeDeployment({ mode: "deploy", sourceDir: fixture.targetDir, targetDir: fixture.targetDir, dryRun: true }), /source and target paths/);
    await assert.rejects(runNativeDeployment({ mode: "deploy", sourceDir: join(fixture.targetDir, "app"), targetDir: fixture.targetDir, dryRun: true }), /source and target paths/);
  });

  test("rollback failure stops only its candidate handle and leaves a foreign listener alone", async () => {
    const fixture = await targetFixture();
    const releases = join(fixture.targetDir, "app", "releases");
    const physicalReleases = realpathSync.native(releases);
    for (const id of ["current", "previous"]) {
      await mkdir(join(releases, id), { recursive: true });
      await writeFile(join(releases, id, "release.json"), JSON.stringify({ accepted: true, fullcommit: "a".repeat(40), previousRelease: id === "current" ? "previous" : null }));
    }
    await symlink(join("releases", "current"), join(fixture.targetDir, "app", "current"));
    const calls = [];
    let inspections = 0;
    const candidate = { pid: 12, cwd: join(physicalReleases, "previous"), startTime: "candidate", command: "candidate" };
    const runtime = {
      inspect: async () => { inspections += 1; return inspections === 1 ? { pid: 11, cwd: join(physicalReleases, "current"), startTime: "old", command: "old" } : { pid: 99, cwd: join(fixture.root, "foreign"), startTime: "foreign", command: "foreign" }; },
      stop: async (service) => { calls.push(["stop", service]); },
      start: async (release) => { calls.push(["start", release]); return candidate; },
      waitHealthy: async (release) => { calls.push(["health", release]); if (release.endsWith("previous")) throw new Error("candidate unhealthy"); return {}; },
    };
    await assert.rejects(runNativeDeployment({ mode: "rollback", targetDir: fixture.targetDir }, { runtimeFactory: () => runtime }), /candidate unhealthy/);
    assert.equal(calls.filter(([kind]) => kind === "stop").length, 2);
    assert.equal(calls.find(([kind, value]) => kind === "stop" && value === candidate)?.[1], candidate);
    assert.equal(inspections, 1);
  });
});
