import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseBrokerStatement } from "./dispatcher";
import { detectTradingViewSimulationCsv } from "./tradingview-simulation";

const projectRoot = process.cwd();
const childHelperPath = resolve(
  projectRoot,
  "app/lib/import/__fixtures__/dispatcher-child.mjs",
);

const TRADINGVIEW_HEADERS = [
  "交易编号", "类型", "日期和时间", "信号", "价格 CNY", "大小（数量）", "大小（价值）",
  "净损益 CNY", "回报 %", "手续费 CNY", "有利波动 CNY", "有利波动 %", "不利波动 CNY",
  "不利波动 %", "累计损益 CNY", "累计损益 %", "持续时间（K线）",
].join(",");

const BOM_TRADINGVIEW_CSV = [
  `${"\uFEFF"}${TRADINGVIEW_HEADERS}`,
  ["1", "多头出场", "2021-03-31", "Close", "8.75", "10000", "95500", "-8000", "-8.38", "0", "6300", "6.60", "-8000", "-8.38", "-8000", "-0.80", "28"].join(","),
  ["1", "多头进场", "2021-02-19", "Buy", "9.55", "10000", "95500", "-8000", "-8.38", "0", "6300", "6.60", "-8000", "-8.38", "-8000", "-0.80", "28"].join(","),
].join("\n");

type ChildResult = {
  after?: { broker: string; records: number; blocked: boolean };
  elapsedMs: number;
  killed: boolean;
  ready: boolean;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
};

function runIsolatedDispatcher(timeoutAfterReadyMs = 1_500): Promise<ChildResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [childHelperPath], {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let ready = false;
    let killed = false;
    let parseTimer: ReturnType<typeof setTimeout> | undefined;
    const startupTimer = setTimeout(() => {
      if (!ready && !killed) {
        killed = true;
        child.kill("SIGKILL");
      }
    }, 6_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (!ready && stdout.includes("READY\n")) {
        ready = true;
        parseTimer = setTimeout(() => {
          if (!killed) {
            killed = true;
            child.kill("SIGKILL");
          }
        }, timeoutAfterReadyMs);
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("close", (_code, signal) => {
      clearTimeout(startupTimer);
      if (parseTimer) clearTimeout(parseTimer);
      const afterLine = stdout.match(/AFTER_DISPATCH:(\{.*\})/u)?.[1];
      resolve({
        after: afterLine ? JSON.parse(afterLine) : undefined,
        elapsedMs: Date.now() - startedAt,
        killed,
        ready,
        signal,
        stderr,
        stdout,
      });
    });
  });
}

describe("binary dispatcher import boundary", () => {
  it("returns a Futu record for the IWM XLSX before the child deadline", async () => {
    const result = await runIsolatedDispatcher();

    expect(result.killed).toBe(false);
    expect(result.after).toEqual({
      broker: "futu",
      records: 1,
      blocked: false,
    });
  });

  it("keeps UTF-8 BOM and Chinese TradingView CSV detection", async () => {
    const result = await parseBrokerStatement(
      new File(
        [new TextEncoder().encode(BOM_TRADINGVIEW_CSV)],
        "回放交易_SSE_600330_bom.csv",
      ),
    );

    expect(result).toMatchObject({
      broker: "tradingview",
      blocked: false,
    });
    expect(result.records).toHaveLength(2);
  });

  it.each([
    ["ZIP", Uint8Array.from([0x50, 0x4b, 0x03, 0x04])],
    ["OLE", Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
    ["PDF", Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])],
    ["control byte", Uint8Array.from([0x74, 0x72, 0x00, 0x61, 0x64, 0x65])],
    ["invalid UTF-8", Uint8Array.from([0xc3, 0x28])],
  ] as const)("skips %s input before the CSV string reader", (_label, bytes) => {
    expect(detectTradingViewSimulationCsv(bytes)).toEqual({
      matched: false,
      confidence: 0,
    });
  });
});
