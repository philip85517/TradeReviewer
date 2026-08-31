import { EventEmitter } from "node:events";
import type {
  ChildProcess,
  SpawnOptionsWithoutStdio,
} from "node:child_process";
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

describe("runTigerBars", () => {
  beforeEach(() => {
    process.env.TIGER_OPENAPI_CONFIG = "/tmp/tiger.properties";
  });

  afterEach(() => {
    if (originalTigerConfig === undefined) {
      delete process.env.TIGER_OPENAPI_CONFIG;
      return;
    }
    process.env.TIGER_OPENAPI_CONFIG = originalTigerConfig;
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
});
