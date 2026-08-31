import { mkdtempSync, writeFileSync } from "node:fs";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  parseTigerProperties,
  readTigerOpenApiConfig,
} from "./tiger-config";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "tiger-config-test-"));
  tempDirs.push(dir);
  return dir;
}

describe("parseTigerProperties", () => {
  it("reports presence flags without exposing secrets", () => {
    expect(
      parseTigerProperties(
        [
          "private_key_pk1=pk1-secret",
          "private_key_pk8=pk8-secret",
          "tiger_id=123",
          "account=acct",
          "license=TBSG",
          "env=PRO",
        ].join("\n"),
      ),
    ).toEqual({
      hasPrivateKeyPk1: true,
      hasPrivateKeyPk8: true,
      hasTigerId: true,
      hasAccount: true,
      hasLicense: true,
      hasEnv: true,
    });

    expect(
      parseTigerProperties("tiger_id=123\naccount=acct\nprivate_key_pk8=key"),
    ).toMatchObject({ hasPrivateKeyPk8: true, hasPrivateKeyPk1: false });

    expect(
      JSON.stringify(
        parseTigerProperties("account=acct\nprivate_key_pk1=secret"),
      ),
    ).not.toContain("secret");
  });

  it("treats empty values and comments as absent", () => {
    expect(
      parseTigerProperties(
        [
          "# comment",
          "; comment",
          "tiger_id = 123",
          "account=",
          "private_key_pk1 =   ",
          "private_key_pk8=value=with=equals",
          "",
        ].join("\n"),
      ),
    ).toEqual({
      hasPrivateKeyPk1: false,
      hasPrivateKeyPk8: true,
      hasTigerId: true,
      hasAccount: false,
      hasLicense: false,
      hasEnv: false,
    });
  });
});

describe("readTigerOpenApiConfig", () => {
  it("returns undefined when the environment variable is absent", () => {
    expect(readTigerOpenApiConfig({})).toBeUndefined();
  });

  it("returns undefined when the configured path is missing", () => {
    expect(
      readTigerOpenApiConfig({
        TIGER_OPENAPI_CONFIG: join(tmpdir(), "definitely-missing.properties"),
      }),
    ).toBeUndefined();
  });

  it("returns undefined when required Tiger credentials are incomplete", () => {
    const dir = createTempDir();
    const configPath = join(dir, "tiger.properties");
    writeFileSync(configPath, "tiger_id=123\naccount=acct\n", "utf8");

    expect(
      readTigerOpenApiConfig({
        TIGER_OPENAPI_CONFIG: configPath,
      }),
    ).toBeUndefined();
  });

  it("returns a resolved path and non-sensitive capability flags for a valid file", () => {
    const dir = createTempDir();
    const nestedDir = join(dir, "configs");
    mkdirSync(nestedDir);
    const configPath = join(nestedDir, "tiger.properties");
    writeFileSync(
      configPath,
      [
        "private_key_pk8=pk8-secret",
        "tiger_id=123",
        "account=acct",
        "license=TBSG",
        "env=PRO",
      ].join("\n"),
      "utf8",
    );

    const result = readTigerOpenApiConfig({
      TIGER_OPENAPI_CONFIG: configPath,
    });

    expect(result).toEqual({
      configPath: resolve(configPath),
      hasPrivateKeyPk1: false,
      hasPrivateKeyPk8: true,
      hasTigerId: true,
      hasAccount: true,
      hasLicense: true,
      hasEnv: true,
    });
    expect(JSON.stringify(result)).not.toContain("pk8-secret");
    expect(JSON.stringify(result)).not.toContain("acct");
  });
});
