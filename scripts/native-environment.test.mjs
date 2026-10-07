import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { assertNativeEnvironment } from "./native-environment.mjs";

test("accepts the pinned native runtime and reports measured values", () => {
  const result = assertNativeEnvironment({
    versions: { node: "26.0.0", sqlite: "3.53.0" },
    execPath: "/usr/local/Cellar/node/26.0.0/bin/node",
  });
  assert.deepEqual(result, {
    nodeVersion: "26.0.0",
    sqliteVersion: "3.53.0",
    nodeExecutable: "/usr/local/Cellar/node/26.0.0/bin/node",
  });
});

test("rejects a runtime mismatch synchronously", () => {
  assert.throws(() => assertNativeEnvironment({ versions: { node: "25.0.0", sqlite: "3.53.0" }, execPath: "/bad/node" }), /Node\.js 26\.0\.0/);
  assert.throws(() => assertNativeEnvironment({ versions: { node: "26.0.0", sqlite: "3.52.0" }, execPath: "/bad/node" }), /SQLite 3\.53\.0/);
  assert.throws(() => assertNativeEnvironment({ versions: { node: "26.0.0", sqlite: "3.53.0" }, execPath: "/bad/node" }), /executable/);
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
