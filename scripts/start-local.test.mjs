import { describe, expect, test } from "vitest";

import {
  buildStartEnvironment,
  buildVinextArguments,
  resolveExtraCaCertificates,
} from "./start-local.mjs";

describe("local server TLS environment", () => {
  test("starts the development server through the same TLS-aware launcher", () => {
    expect(buildVinextArguments(["--dev", "--host", "127.0.0.1"])).toEqual([
      "dev",
      "--host",
      "127.0.0.1",
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
});
