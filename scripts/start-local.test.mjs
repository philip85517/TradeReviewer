import { describe, expect, test } from "vitest";

import {
  buildStartEnvironment,
  buildVinextArguments,
  isMainModule,
  resolveExtraCaCertificates,
} from "./start-local.mjs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("local server TLS environment", () => {
  test("starts the development server through the same TLS-aware launcher", () => {
    expect(buildVinextArguments(["--dev", "--host", "127.0.0.1"])).toEqual([
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      "3022",
    ]);
  });

  test("keeps an explicitly configured CA bundle", () => {
    expect(
      resolveExtraCaCertificates({
        env: { NODE_EXTRA_CA_CERTS: "/custom/ca.pem" },
        exists: () => false,
      }),
    ).toBe("/custom/ca.pem");
  });

  test("selects the first existing system CA bundle", () => {
    expect(
      resolveExtraCaCertificates({
        env: {},
        exists: (path) => path === "/etc/ssl/cert.pem",
      }),
    ).toBe("/etc/ssl/cert.pem");
  });

  test("does not disable TLS when no system CA bundle is available", () => {
    expect(
      buildStartEnvironment({
        env: { PATH: "/usr/bin" },
        exists: () => false,
        cwd: "/workspace/tradereview",
      }),
    ).toEqual({
      PATH: "/usr/bin",
      TRADEREVIEW_DB_PATH: "/workspace/tradereview/.data/tradereview.sqlite",
    });
  });

  test("keeps an explicitly configured database path", () => {
    expect(
      buildStartEnvironment({
        env: {
          PATH: "/usr/bin",
          TRADEREVIEW_DB_PATH: "/var/lib/tradereview/tradereview.sqlite",
        },
        exists: () => false,
        cwd: "/workspace/tradereview",
      }),
    ).toEqual({
      PATH: "/usr/bin",
      TRADEREVIEW_DB_PATH: "/var/lib/tradereview/tradereview.sqlite",
    });
  });

  test("uses the shared runtime config for database and fixed port defaults", () => {
    const directory = mkdtempSync(join(tmpdir(), "trade-review-runtime-"));
    const databasePath = join(directory, "tradereview.sqlite");
    const configPath = join(directory, "runtime.json");
    writeFileSync(configPath, JSON.stringify({ databasePath, port: 3123, hostname: "127.0.0.1" }));
    writeFileSync(databasePath, "");

    expect(buildStartEnvironment({
      env: { NODE_ENV: "development", TRADEREVIEW_RUNTIME_CONFIG: configPath },
      exists: (path) => path === configPath || path === databasePath,
      cwd: "/workspace/tradereview",
    })).toMatchObject({ TRADEREVIEW_DB_PATH: databasePath });
    expect(buildVinextArguments([], {
      env: { NODE_ENV: "development", TRADEREVIEW_RUNTIME_CONFIG: configPath },
      exists: () => false,
      cwd: "/workspace/tradereview",
    })).toEqual(["start", "--hostname", "127.0.0.1", "--port", "3123"]);
  });

  test("keeps an explicit port supplied by the caller", () => {
    expect(buildVinextArguments(["--dev", "--port", "3025"], {
      env: { NODE_ENV: "test" },
      exists: () => false,
      cwd: "/workspace/tradereview",
    })).toEqual(["dev", "--port", "3025", "--hostname", "127.0.0.1"]);
  });

  test("fails clearly for malformed explicit runtime config", () => {
    expect(() => buildStartEnvironment({
      env: { TRADEREVIEW_RUNTIME_CONFIG: "/tmp/malformed-runtime.json" },
      readFile: () => "{",
      exists: () => true,
    })).toThrow(/runtime config/i);
  });

  test("refuses to launch with a missing configured main database", () => {
    expect(() => buildStartEnvironment({
      env: { NODE_ENV: "development", TRADEREVIEW_RUNTIME_CONFIG: "/tmp/runtime.json" },
      readFile: () => JSON.stringify({ databasePath: "/tmp/missing-tradereview.sqlite" }),
      exists: (path) => path === "/tmp/runtime.json",
    })).toThrow(/does not exist/i);
  });

  test("keeps unsafe database paths rejected before normalization", () => {
    for (const databasePath of ["/", "/tmp/../unsafe.sqlite", "/tmp/tradereview.sqlite/"]) {
      expect(() => buildStartEnvironment({
        env: { TRADEREVIEW_RUNTIME_CONFIG: "/tmp/runtime.json" },
        readFile: () => JSON.stringify({ databasePath }),
        exists: () => true,
      })).toThrow(/unsafe/i);
    }
  });

  test("recognizes a Unicode launcher path as the main module", () => {
    const directory = mkdtempSync(join(tmpdir(), "tradereview-启动-"));
    const launcherPath = join(directory, "start-local.mjs");
    try {
      expect(isMainModule(`file://${launcherPath}`, launcherPath)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
