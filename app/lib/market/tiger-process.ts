import {
  spawn as defaultSpawn,
  type SpawnOptionsWithoutStdio,
} from "node:child_process";
import * as path from "node:path";
import type { Readable, Writable } from "node:stream";

import { MarketDataProviderError } from "./providers/errors";

export type TigerBarRequest = {
  symbol: string;
  period: "day" | "60min";
  beginTime: string;
  endTime: string;
};

export type TigerBar = {
  symbol: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type SpawnFunction = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => TigerChildProcess;

export type TigerProcessOptions = {
  spawn?: SpawnFunction;
  pythonCommand?: string;
  helperPath?: string;
  timeoutMs?: number;
};

type TigerReadable = Readable & {
  setEncoding(encoding: BufferEncoding): TigerReadable;
};

type TigerChildProcess = {
  stdout: TigerReadable;
  stderr: TigerReadable;
  stdin: Writable;
  kill(): boolean;
  on(event: "error", listener: (error: Error) => void): TigerChildProcess;
  on(
    event: "close",
    listener: (code: number | null) => void,
  ): TigerChildProcess;
  removeAllListeners(): TigerChildProcess;
};

type TigerProcessResult =
  | { ok: true; bars: TigerBar[] }
  | { ok: false; error: MarketDataProviderError };

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_HELPER_PATH = path.resolve(
  process.cwd(),
  "scripts/tiger-market-data.py",
);

function unavailableError(message = "Tiger OpenAPI 行情暂时不可用") {
  return new MarketDataProviderError("source-unavailable", message);
}

function invalidResponseError() {
  return new MarketDataProviderError(
    "invalid-response",
    "Tiger OpenAPI 行情返回格式异常",
  );
}

function timeoutError() {
  return new MarketDataProviderError(
    "source-timeout",
    "Tiger OpenAPI 行情响应超时",
  );
}

function isTigerBar(value: unknown): value is TigerBar {
  if (!value || typeof value !== "object") {
    return false;
  }

  const bar = value as Record<string, unknown>;
  return (
    typeof bar.symbol === "string" &&
    typeof bar.time === "number" &&
    Number.isFinite(bar.time) &&
    typeof bar.open === "number" &&
    Number.isFinite(bar.open) &&
    typeof bar.high === "number" &&
    Number.isFinite(bar.high) &&
    typeof bar.low === "number" &&
    Number.isFinite(bar.low) &&
    typeof bar.close === "number" &&
    Number.isFinite(bar.close) &&
    typeof bar.volume === "number" &&
    Number.isFinite(bar.volume)
  );
}

function parseTigerBars(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw invalidResponseError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw invalidResponseError();
  }

  if (!parsed || typeof parsed !== "object") {
    throw invalidResponseError();
  }

  const bars = (parsed as { bars?: unknown }).bars;
  if (!Array.isArray(bars) || !bars.every(isTigerBar)) {
    throw invalidResponseError();
  }

  return bars;
}

export async function runTigerBars(
  request: TigerBarRequest,
  options: TigerProcessOptions = {},
): Promise<TigerBar[]> {
  const configPath = process.env.TIGER_OPENAPI_CONFIG?.trim();
  if (!configPath) {
    throw unavailableError();
  }

  const spawn = options.spawn ?? defaultSpawn;
  const pythonCommand = options.pythonCommand ?? "python3";
  const helperPath = options.helperPath ?? DEFAULT_HELPER_PATH;
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  return await new Promise<TigerBar[]>((resolve, reject) => {
    let child: TigerChildProcess;
    try {
      child = spawn(pythonCommand, ["-u", helperPath], {
        env: {
          ...process.env,
          TIGER_OPENAPI_CONFIG: configPath,
        },
        stdio: "pipe",
      });
    } catch {
      reject(unavailableError("tiger SDK 未安装或不可用"));
      return;
    }

    let settled = false;
    let stdout = "";
    let stderr = "";
    const finish = (result: TigerProcessResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      child.stdout.removeAllListeners();
      child.stderr.removeAllListeners();
      child.removeAllListeners();
      if ("error" in result) {
        reject(result.error);
        return;
      }
      resolve(result.bars);
    };

    const timeout = setTimeout(() => {
      child.kill();
      finish({ ok: false, error: timeoutError() });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", () => {
      finish({ ok: false, error: unavailableError("tiger SDK 未安装或不可用") });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        void stderr;
        finish({ ok: false, error: unavailableError() });
        return;
      }

      try {
        finish({ ok: true, bars: parseTigerBars(stdout) });
      } catch (error) {
        finish({
          ok: false,
          error:
            error instanceof MarketDataProviderError
              ? error
              : invalidResponseError(),
        });
      }
    });

    child.stdin.on("error", () => {
      finish({ ok: false, error: unavailableError() });
    });
    child.stdin.end(`${JSON.stringify(request)}\n`);
  });
}
