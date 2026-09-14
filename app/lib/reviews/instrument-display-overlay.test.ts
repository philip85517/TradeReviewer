import { describe, expect, it } from "vitest";

import { buildInstrumentTradeSummaries } from "../trades/instruments";
import type { TradeExecution } from "../trades/types";
import {
  localizedInstrumentOverlay,
  overlayStoredInstrumentMetadata,
} from "./instrument-display-overlay";

function execution(): TradeExecution {
  return {
    id: "fill-1",
    source: { platform: "fixture", row: 1 },
    accountId: "acct-1",
    accountLabel: "主账户",
    instrument: {
      id: "US:SNDK",
      symbol: "SNDK",
      name: "SanDisk Corporation",
      market: "US",
      currency: "USD",
    },
    side: "buy",
    executedAt: "2026-01-01T01:00:00Z",
    quantity: "1",
    price: "1",
    fee: "0",
  };
}

describe("instrument display overlay", () => {
  it("projects cached localized metadata onto summaries without mutating executions", () => {
    const records = [execution()];
    const summaries = buildInstrumentTradeSummaries(records);
    const localizedName = {
      name: "闪迪",
      locale: "zh-CN" as const,
      source: "tencent",
      resolvedAt: "2026-09-12T00:00:00.000Z",
    };
    const projected = overlayStoredInstrumentMetadata(summaries, [{
      ...summaries[0].instrument,
      localizedName,
    }]);

    expect(projected[0].instrument.localizedName).toEqual(localizedName);
    expect(projected[0].instrument.name).toBe("SanDisk Corporation");
    expect(records[0].instrument).not.toHaveProperty("localizedName");
  });

  it("updates the local cached projection after a successful refresh", () => {
    const instrument = { ...execution().instrument };
    const localizedName = {
      name: "闪迪",
      locale: "zh-CN" as const,
      source: "tencent",
      resolvedAt: "2026-09-12T00:00:00.000Z",
    };
    const projected = localizedInstrumentOverlay(instrument, { localizedName });
    expect(projected.localizedName).toEqual(localizedName);
    expect(projected.name).toBe("SanDisk Corporation");
  });
});
