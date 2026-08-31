import { EventEmitter } from "node:events";
import type {
  ChildProcess,
  SpawnOptionsWithoutStdio,
} from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PassThrough, Writable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MarketDataProviderError } from "./providers/errors";
import { runTigerBars } from "./tiger-process";

type TigerBarRequest = {
  symbol: string;
  period: "day" | "60min";
  beginTime: string;
  endTime: string;
};

class FakeStdin extends Writable {
  data = "";

  override _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.data += chunk.toString();
    callback();
  }
}

const originalTigerConfig = process.env.TIGER_OPENAPI_CONFIG;
const originalPythonPath = process.env.PYTHONPATH;
const tempDirs: string[] = [];

type FakeChildProcess = ChildProcess & {
  stdout: PassThrough;
  stderr: PassThrough;
  stdin: FakeStdin;
};

function createFakeChild() {
  const child = new EventEmitter() as FakeChildProcess;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new FakeStdin();
  child.kill = () => true;
  return child;
}

function sampleRequest(): TigerBarRequest {
  return {
    symbol: "HK00700",
    period: "day",
    beginTime: "2026-08-01 09:30:00",
    endTime: "2026-08-31 16:00:00",
  };
}

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), "tiger-process-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeTigerSdkStub(rootDir: string) {
  const tigeropenDir = join(rootDir, "tigeropen");
  const quoteDir = join(tigeropenDir, "quote");
  mkdirSync(quoteDir, { recursive: true });
  writeFileSync(join(tigeropenDir, "__init__.py"), "", "utf8");
  writeFileSync(join(quoteDir, "__init__.py"), "", "utf8");
  writeFileSync(
    join(tigeropenDir, "tiger_open_config.py"),
    [
      "class TigerOpenClientConfig:",
      "    def __init__(self, props_path=None):",
      "        self.props_path = props_path",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(quoteDir, "quote_client.py"),
    [
      "class QuoteClient:",
      "    def __init__(self, client_config):",
      "        self.client_config = client_config",
      "",
      "    def get_bars(self, *args, **kwargs):",
      "        return None",
    ].join("\n"),
    "utf8",
  );
}

function writeConfig(dir: string, contents: string) {
  const configPath = join(dir, "tiger.properties");
  writeFileSync(configPath, contents, "utf8");
  return configPath;
}

describe("runTigerBars", () => {
  beforeEach(() => {
    process.env.TIGER_OPENAPI_CONFIG = "/tmp/tiger.properties";
    delete process.env.PYTHONPATH;
  });

  afterEach(() => {
    if (originalTigerConfig === undefined) {
      delete process.env.TIGER_OPENAPI_CONFIG;
    } else {
      process.env.TIGER_OPENAPI_CONFIG = originalTigerConfig;
    }
    if (originalPythonPath === undefined) {
      delete process.env.PYTHONPATH;
    } else {
      process.env.PYTHONPATH = originalPythonPath;
    }
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes the exact request JSON and returns parsed bars from a one-line response", async () => {
    const child = createFakeChild();
    const request = sampleRequest();
    const resultPromise = runTigerBars(request, {
      helperPath: "/tmp/tiger-market-data.py",
      pythonCommand: "python3",
      spawn(command, args, options) {
        expect(command).toBe("python3");
        expect(args).toEqual(["-u", "/tmp/tiger-market-data.py"]);
        expect(options?.env?.TIGER_OPENAPI_CONFIG).toBe("/tmp/tiger.properties");
        queueMicrotask(() => {
          child.stdout.end(
            JSON.stringify({
              bars: [
                {
                  symbol: "HK00700",
                  time: 1_756_598_400_000,
                  open: 512.5,
                  high: 520,
                  low: 510,
                  close: 518,
                  volume: 1200,
                },
              ],
            }) + "\n",
          );
          child.emit("close", 0);
        });
        return child;
      },
    });

    await expect(resultPromise).resolves.toEqual([
      {
        symbol: "HK00700",
        time: 1_756_598_400_000,
        open: 512.5,
        high: 520,
        low: 510,
        close: 518,
        volume: 1200,
      },
    ]);
    expect(child.stdin.data).toBe(`${JSON.stringify(request)}\n`);
  });

  it("maps malformed JSON output to an invalid-response error", async () => {
    const child = createFakeChild();
    const resultPromise = runTigerBars(sampleRequest(), {
      helperPath: "/tmp/tiger-market-data.py",
      spawn() {
        queueMicrotask(() => {
          child.stdout.end("{not-json}\n");
          child.emit("close", 0);
        });
        return child;
      },
    });

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "invalid-response",
        message: "Tiger OpenAPI 行情返回格式异常",
      }),
    );
  });

  it("maps a missing bars field to an invalid-response error", async () => {
    const child = createFakeChild();
    const resultPromise = runTigerBars(sampleRequest(), {
      helperPath: "/tmp/tiger-market-data.py",
      spawn() {
        queueMicrotask(() => {
          child.stdout.end(JSON.stringify({ ok: true }) + "\n");
          child.emit("close", 0);
        });
        return child;
      },
    });

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "invalid-response",
        message: "Tiger OpenAPI 行情返回格式异常",
      }),
    );
  });

  it("redacts stderr and secrets when the helper exits non-zero", async () => {
    const child = createFakeChild();
    const secret = "fixture-secret-value";
    const resultPromise = runTigerBars(sampleRequest(), {
      helperPath: "/tmp/tiger-market-data.py",
      spawn() {
        queueMicrotask(() => {
          child.stderr.end(
            `private_key_pk1=${secret}\naccount=U12345\nraw sdk boom\n`,
          );
          child.emit("close", 1);
        });
        return child;
      },
    });

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "source-unavailable",
        message: "Tiger OpenAPI 行情暂时不可用",
      }),
    );

    await resultPromise.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("private_key_pk1");
      expect(message).not.toContain("account");
      expect(message).not.toContain(secret);
      expect(message).not.toContain("raw sdk boom");
    });
  });

  it("maps helper timeouts to source-timeout and stops the child", async () => {
    const child = createFakeChild();
    let killed = false;
    child.kill = () => {
      killed = true;
      return true;
    };

    const resultPromise = runTigerBars(sampleRequest(), {
      helperPath: "/tmp/tiger-market-data.py",
      timeoutMs: 10,
      spawn() {
        return child;
      },
    });

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "source-timeout",
        message: "Tiger OpenAPI 行情响应超时",
      }),
    );
    expect(killed).toBe(true);
  });

  it("maps spawn failures to a safe unavailable error", async () => {
    const resultPromise = runTigerBars(sampleRequest(), {
      helperPath: "/tmp/tiger-market-data.py",
      spawn(
        command: string,
        args: readonly string[],
        options?: SpawnOptionsWithoutStdio,
      ) {
        void command;
        void args;
        void options;
        throw new Error("spawn python3 failed with fixture-secret-value");
      },
    });

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "source-unavailable",
        message: "tiger SDK 未安装或不可用",
      }),
    );
  });

  it("fails when tiger_id is missing from the helper config without exposing values", async () => {
    const stubDir = createTempDir();
    writeTigerSdkStub(stubDir);
    process.env.PYTHONPATH = stubDir;
    process.env.TIGER_OPENAPI_CONFIG = writeConfig(
      stubDir,
      "account=acct-123\nprivate_key_pk8=fixture-secret-value\n",
    );

    const resultPromise = runTigerBars(sampleRequest(), {
      helperPath: resolve("scripts/tiger-market-data.py"),
    });

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "source-unavailable",
        message: "Tiger OpenAPI 行情暂时不可用",
      }),
    );

    await resultPromise.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("fixture-secret-value");
      expect(message).not.toContain("acct-123");
      expect(message).not.toContain("tiger_id");
    });
  });

  it("fails when the helper config has an empty private key without exposing values", async () => {
    const stubDir = createTempDir();
    writeTigerSdkStub(stubDir);
    process.env.PYTHONPATH = stubDir;
    process.env.TIGER_OPENAPI_CONFIG = writeConfig(
      stubDir,
      "tiger_id=20150338\naccount=acct-123\nprivate_key_pk8=   \nprivate_key_pk1=\n",
    );

    const resultPromise = runTigerBars(sampleRequest(), {
      helperPath: resolve("scripts/tiger-market-data.py"),
    });

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "source-unavailable",
        message: "Tiger OpenAPI 行情暂时不可用",
      }),
    );

    await resultPromise.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("20150338");
      expect(message).not.toContain("acct-123");
      expect(message).not.toContain("private_key_pk8");
    });
  });
});
