import { describe, expect, it, vi } from "vitest";

import { CASH_SETTINGS_KEY, type CashBaselineState } from "../../../lib/cash/cash-model";
import type { StoredInstrument } from "../../../lib/storage/sqlite-contracts";
import type { TradeExecution } from "../../../lib/trades/types";
import { createCashHandlers, type CashReadStore } from "./route";

const baseline: CashBaselineState = {
  version: 1,
  records: [{
    id: "cash:live:account-a:CNY",
    scope: { nature: "live", simulationRunId: null },
    accountId: "account-a",
    currency: "CNY",
    balance: "100000",
    asOf: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
  }],
};

const instruments: StoredInstrument[] = [{
  id: "CN:STOCK",
  symbol: "STOCK",
  name: "股票",
  market: "CN-SH",
  currency: "CNY",
  metadata: {
    market: "CN-SH",
    symbol: "STOCK",
    name: "股票",
    assetType: "stock",
    source: "statement",
    confidence: "statement",
    resolvedAt: "2026-09-01T00:00:00.000Z",
  },
}];

function execution(id: string, side: "buy" | "sell", amount: string, date = "2026-09-26"): TradeExecution {
  return {
    id,
    accountId: "account-a",
    accountLabel: "账户 A",
    instrument: { id: "CN:STOCK", symbol: "STOCK", name: "股票", market: "CN-SH", currency: "CNY" },
    side,
    executedAt: `${date}T03:00:00.000Z`,
    quantity: "1",
    price: amount,
    fee: "0",
    source: {
      platform: "test",
      row: 1,
      tradeNature: "live",
      tradingDate: date,
      feeStatus: "reported",
      settlement: { currency: "CNY", quantity: "1", grossAmount: amount, netAmount: "", fees: {} },
    },
  };
}

const fx = {
  id: "boc:test",
  baseCurrency: "CNY" as const,
  source: "BOC" as const,
  publishedAt: "2026-09-26T00:00:00.000Z",
  publishedAtByCurrency: { USD: "2026-09-26T00:00:00.000Z", HKD: "2026-09-26T00:00:00.000Z" },
  fetchedAt: "2026-09-26T00:00:00.000Z",
  rates: { USD: "7", HKD: "0.9" },
  lastAttemptDay: "2026-09-26",
  status: "complete" as const,
  error: null,
};

function memoryStore(overrides: Partial<CashReadStore> = {}): CashReadStore & { settings: Record<string, unknown> } {
  let settings: Record<string, unknown> = { [CASH_SETTINGS_KEY]: baseline, "trading-room.fx": fx };
  const store: CashReadStore = {
    getSettings: vi.fn(() => settings),
    putSettings: vi.fn((next) => { settings = { ...settings, ...next }; }),
    getExecutions: vi.fn(() => [execution("buy", "buy", "30000", "2026-09-02"), execution("sell", "sell", "32000")]),
    getInstruments: vi.fn(() => instruments),
    ...overrides,
  };
  return { ...store, get settings() { return settings; } };
}

describe("/api/trading-room/cash", () => {
  it("reads real executions, baselines, metadata, and FX in one persisted calculation path", async () => {
    const store = memoryStore();
    const { GET } = createCashHandlers(store);

    const response = await GET(new Request("http://localhost/api/trading-room/cash?nature=live&today=2026-09-26&targetCurrency=CNY"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as {
      cashTotal: { originalByCurrency: Record<string, string>; converted: string | null };
      todayProceeds: { originalByCurrency: Record<string, string> };
      todayProceedsStatus: string;
    };
    expect(body.cashTotal.originalByCurrency).toEqual({ CNY: "102000" });
    expect(body.cashTotal.converted).toBe("102000");
    expect(body.todayProceeds.originalByCurrency).toEqual({ CNY: "32000" });
    expect(body.todayProceedsStatus).toBe("available");
    expect(store.getExecutions).toHaveBeenCalledOnce();
    expect(store.getInstruments).toHaveBeenCalledOnce();
  });

  it("does not read another simulation run and accepts the canonical whole-account scope", async () => {
    const store = memoryStore({
      getExecutions: vi.fn(() => [execution("live", "sell", "10")]),
    });
    const { GET } = createCashHandlers(store);
    expect((await GET(new Request("http://localhost/api/trading-room/cash"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/trading-room/cash?nature=simulation"))).status).toBe(200);
    expect((await GET(new Request("http://localhost/api/trading-room/cash?nature=simulation&accountId=legacy-account"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/trading-room/cash?nature=live&simulationRunId=run-a"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/trading-room/cash?nature=live&targetCurrency=USD"))).status).toBe(400);
  });

  it("maps malformed dates and storage failures to stable errors", async () => {
    const store = memoryStore();
    const { GET } = createCashHandlers(store);
    expect((await GET(new Request("http://localhost/api/trading-room/cash?nature=live&today=2026-09-99"))).status).toBe(400);

    const failing = memoryStore();
    vi.mocked(failing.getSettings).mockImplementation(() => { throw new Error("db unavailable"); });
    expect((await createCashHandlers(failing).GET(new Request("http://localhost/api/trading-room/cash?nature=live"))).status).toBe(503);
  });
});
