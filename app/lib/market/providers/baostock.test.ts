import { describe, expect, it, vi } from "vitest";

import {
  BaoStockClientError,
  type BaoStockHistoryClient,
  type BaoStockHistoryResponse,
} from "../baostock-client";
import type { IntradayCandleRequest } from "../contracts";
import { MarketDataProviderError } from "./errors";
import { BaoStockProvider, parseBaoStockIntraday } from "./baostock";

const fields = [
  "date",
  "time",
  "code",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "amount",
  "adjustflag",
];

function record(
  code: string,
  time: string,
  close = "18.0200",
  adjustflag = "3",
) {
  return [
    "2023-06-20",
    time,
    code,
    "17.8500",
    "18.4000",
    "17.6800",
    close,
    "8922397",
    "159759899.0000",
    adjustflag,
  ];
}

function history(
  records: string[][],
  overrides: Partial<BaoStockHistoryResponse> = {},
): BaoStockHistoryResponse {
  return {
    code: "sz.000519",
    fields,
    records,
    pages: 1,
    truncated: false,
    ...overrides,
  };
}

function request(
  overrides: Partial<IntradayCandleRequest> = {},
): IntradayCandleRequest {
  return {
    instrumentId: "CN-SZ:000519",
    symbol: "000519",
    market: "CN-SZ",
    interval: "1h",
    startTime: "2023-06-20T01:00:00.000Z",
    endTime: "2023-06-20T07:00:00.000Z",
    ...overrides,
  };
}

function clientReturning(response: BaoStockHistoryResponse): BaoStockHistoryClient {
  return {
    queryHistoryKDataPlus: vi.fn(async () => response),
  };
}

describe("BaoStock provider", () => {
  it("supports only CN-SH/CN-SZ and rejects daily or 15m requests", async () => {
    const provider = new BaoStockProvider({
      client: clientReturning(history([])),
    });
    expect(provider.supports("CN-SH")).toBe(true);
    expect(provider.supports("CN-SZ")).toBe(true);
    expect(provider.supports("HK")).toBe(false);
    expect(provider.supports("US")).toBe(false);

    await expect(provider.fetchDaily({
      instrumentId: "CN-SZ:000519",
      symbol: "000519",
      market: "CN-SZ",
      startDate: "2023-06-20",
      endDate: "2023-06-20",
    })).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "no-data",
      }),
    );
    await expect(provider.fetchIntraday(request({ interval: "15m" }))).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "no-data",
      }),
    );
  });

  it("queries unadjusted hourly bars and maps BaoStock close times to session starts", async () => {
    const client = clientReturning(history([
      record("sz.000519", "20230620103000000", "18.0200"),
      record("sz.000519", "20230620113000000", "18.1600"),
      record("sz.000519", "20230620140000000", "18.1600"),
      record("sz.000519", "20230620150000000", "18.0900"),
    ]));
    const signal = new AbortController().signal;
    const provider = new BaoStockProvider({ client, signal });

    const result = await provider.fetchIntraday(request());

    expect(client.queryHistoryKDataPlus).toHaveBeenCalledWith({
      code: "sz.000519",
      startDate: "2023-06-20",
      endDate: "2023-06-20",
      frequency: "60",
      adjustflag: "3",
      signal,
    });
    expect(result).toMatchObject({
      provider: "baostock",
      providerSymbol: "sz.000519",
      interval: "1h",
      warnings: [],
      candles: [
        {
          timestamp: "2023-06-20T01:30:00.000Z",
          knowledgeAt: "2023-06-20T02:30:00.000Z",
          close: "18.0200",
        },
        {
          timestamp: "2023-06-20T02:30:00.000Z",
          knowledgeAt: "2023-06-20T03:30:00.000Z",
          close: "18.1600",
        },
        {
          timestamp: "2023-06-20T05:00:00.000Z",
          knowledgeAt: "2023-06-20T06:00:00.000Z",
          close: "18.1600",
        },
        {
          timestamp: "2023-06-20T06:00:00.000Z",
          knowledgeAt: "2023-06-20T07:00:00.000Z",
          close: "18.0900",
        },
      ],
    });
  });

  it("keeps a response truncation warning so the caller can retry the missing history", async () => {
    const provider = new BaoStockProvider({
      client: clientReturning(
        history([record("sh.600519", "20230620103000000")], {
          code: "sh.600519",
          truncated: true,
        }),
      ),
    });
    const result = await provider.fetchIntraday(request({
      instrumentId: "CN-SH:600519",
      symbol: "600519",
      market: "CN-SH",
    }));
    expect(result.provider).toBe("baostock");
    expect(result.warnings).toEqual(["provider-history-limit"]);
  });

  it("maps transport failures to provider errors and preserves cancellation", async () => {
    const timeoutClient: BaoStockHistoryClient = {
      queryHistoryKDataPlus: vi.fn(async () => {
        throw new BaoStockClientError("timeout", "BaoStock 请求超过截止时间");
      }),
    };
    await expect(
      new BaoStockProvider({ client: timeoutClient }).fetchIntraday(request()),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataProviderError>>({
        code: "source-timeout",
      }),
    );

    const abortClient: BaoStockHistoryClient = {
      queryHistoryKDataPlus: vi.fn(async () => {
        throw new BaoStockClientError("aborted", "请求已取消");
      }),
    };
    await expect(
      new BaoStockProvider({ client: abortClient }).fetchIntraday(request()),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects changed identity, adjusted data, and cross-session close times", () => {
    expect(() =>
      parseBaoStockIntraday(
        history([record("sh.600519", "20230620103000000")]),
        "sz.000519",
      ),
    ).toThrow("标的不匹配");
    expect(() =>
      parseBaoStockIntraday(
        history([record("sz.000519", "20230620103000000", "18.0200", "2")]),
        "sz.000519",
      ),
    ).toThrow("不复权");
    expect(() =>
      parseBaoStockIntraday(
        history([record("sz.000519", "20230620120000000")]),
        "sz.000519",
      ),
    ).toThrow("交易时段");
  });
});
