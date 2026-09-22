import { describe, expect, test } from "vitest";

import { resolveRuntimeConfig } from "./runtime-config.mjs";

const projectDatabasePath = "/Users/zhoulin/projects/交易空间/database/TradingReview/tradereview.sqlite";

function configOptions({ cwd, env = {}, files = {} }) {
  return {
    cwd,
    env,
    exists: (path) => Object.hasOwn(files, path),
    readFile: (path) => files[path],
  };
}

describe("runtime config resolution", () => {
test("two project roots with the versioned config resolve to the same physical database", () => {
  const files = {
    "/worktree-a/conf/runtime.json": JSON.stringify({ databasePath: projectDatabasePath }),
    "/worktree-b/conf/runtime.json": JSON.stringify({ databasePath: projectDatabasePath }),
  };

  const first = resolveRuntimeConfig(configOptions({ cwd: "/worktree-a", env: { NODE_ENV: "development" }, files }));
  const second = resolveRuntimeConfig(configOptions({ cwd: "/worktree-b", env: { NODE_ENV: "development" }, files }));

  expect(first.databasePath).toBe(projectDatabasePath);
  expect(second.databasePath).toBe(projectDatabasePath);
  expect(first.databasePath).toBe(second.databasePath);
});

test("project config takes precedence over machine config", () => {
  const machinePath = "/machine/tradereview.sqlite";
  const result = resolveRuntimeConfig(configOptions({
    cwd: "/project",
    env: { NODE_ENV: "development", HOME: "/home/test" },
    files: {
      "/project/conf/runtime.json": JSON.stringify({ databasePath: projectDatabasePath }),
      "/home/test/.config/tradereview/runtime.json": JSON.stringify({ databasePath: machinePath }),
    },
  }));

  expect(result.databasePath).toBe(projectDatabasePath);
  expect(result.configPath).toBe("/project/conf/runtime.json");
});

test("test mode skips implicit project and machine config", () => {
  const result = resolveRuntimeConfig(configOptions({
    cwd: "/project",
    env: { NODE_ENV: "test", HOME: "/home/test" },
    files: {
      "/project/conf/runtime.json": JSON.stringify({ databasePath: projectDatabasePath }),
      "/home/test/.config/tradereview/runtime.json": JSON.stringify({ databasePath: "/machine/tradereview.sqlite" }),
    },
  }));

  expect(result.databasePath).toBe("/project/.data/tradereview.sqlite");
  expect(result.databasePathSource).toBe("fallback");
});

test("explicit settings override implicit project config", () => {
  const explicitPath = "/isolated/test.sqlite";
  const result = resolveRuntimeConfig(configOptions({
    cwd: "/project",
    env: { NODE_ENV: "development", TRADEREVIEW_DB_PATH: explicitPath },
    files: { "/project/conf/runtime.json": JSON.stringify({ databasePath: projectDatabasePath }) },
  }));

  expect(result.databasePath).toBe(explicitPath);
  expect(result.databasePathSource).toBe("environment");
});

test("malformed project config fails without falling back", () => {
  expect(() => resolveRuntimeConfig(configOptions({
      cwd: "/project",
      env: { NODE_ENV: "development", HOME: "/home/test" },
      files: {
        "/project/conf/runtime.json": "{",
        "/home/test/.config/tradereview/runtime.json": JSON.stringify({ databasePath: "/machine/tradereview.sqlite" }),
      },
    }))).toThrow(
    /cannot parse.*\/project\/conf\/runtime\.json/i,
  );
});

test("explicit config remains available in test mode", () => {
  const result = resolveRuntimeConfig(configOptions({
    cwd: "/project",
    env: { NODE_ENV: "test", TRADEREVIEW_RUNTIME_CONFIG: "/tmp/test-runtime.json" },
    files: { "/tmp/test-runtime.json": JSON.stringify({ databasePath: "/isolated/test.sqlite" }) },
  }));

  expect(result.databasePath).toBe("/isolated/test.sqlite");
  expect(result.configPath).toBe("/tmp/test-runtime.json");
});
});
