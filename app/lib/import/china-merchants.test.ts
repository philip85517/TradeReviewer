import { describe, expect, it } from "vitest";

import {
  CHINA_MERCHANTS_IDENTICAL_FILLS,
  CHINA_MERCHANTS_PAGES,
  NON_CHINA_MERCHANTS_PAGES,
} from "./__fixtures__/china-merchants-pages";
import {
  ChinaMerchantsStatementParser,
  detectChinaMerchantsStatement,
  parseChinaMerchantsPages,
} from "./china-merchants";

const options = {
  fileName: "招商证券.pdf",
  fileFingerprint: "cms-fixture",
};

describe("China Merchants Securities PDF import", () => {
  it("requires the broker, flow section, and supported table header", () => {
    expect(detectChinaMerchantsStatement(CHINA_MERCHANTS_PAGES)).toMatchObject({
      matched: true,
      confidence: 1,
    });
    expect(
      detectChinaMerchantsStatement(NON_CHINA_MERCHANTS_PAGES),
    ).toMatchObject({
      matched: false,
      diagnostics: [
        expect.objectContaining({ code: "unsupported-china-merchants-layout" }),
      ],
    });
  });

  it("keeps stock and ETF executions and categorizes excluded flows", () => {
    const result = parseChinaMerchantsPages(CHINA_MERCHANTS_PAGES, options);

    expect(result.broker).toBe("china-merchants");
    expect(result.records.map((record) => record.instrument.symbol)).toEqual([
      "700",
      "518880",
      "600938",
      "518880",
      "600938",
    ]);
    expect(result.records.map((record) => record.side)).toEqual([
      "buy",
      "buy",
      "buy",
      "sell",
      "sell",
    ]);
    expect(result.candidates).toEqual([
      {
        market: "HK",
        symbol: "700",
        sourceName: "匿名港股",
        sourceAssetType: "stock",
      },
      {
        market: "CN-SH",
        symbol: "518880",
        sourceName: "黄金ETF",
        sourceAssetType: "etf",
      },
      {
        market: "CN-SH",
        symbol: "600938",
        sourceName: "匿名能源",
        sourceAssetType: "stock",
      },
    ]);
    expect(result.exclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "bond", count: 1 }),
        expect.objectContaining({ category: "repo", count: 2 }),
        expect.objectContaining({ category: "cash", count: 2 }),
        expect.objectContaining({ category: "corporate-action", count: 1 }),
        expect.objectContaining({ category: "subscription", count: 1 }),
        expect.objectContaining({ category: "fund", count: 1 }),
      ]),
    );
  });

  it("marks missing times as date-only and preserves physical source order", () => {
    const result = parseChinaMerchantsPages(CHINA_MERCHANTS_PAGES, options);

    expect(result.records[0]).toMatchObject({
      executedAt: "2025-01-02T07:00:00.000Z",
      quantity: "100",
      price: "300",
      fee: "6",
      source: {
        platform: "china-merchants",
        page: 2,
        sourceOrder: 0,
        timePrecision: "date-only",
        sourceTimestampText: "20250102",
        sourceTimezone: "Asia/Shanghai",
      },
    });
    expect(result.records.slice(0, 3).map((record) => record.source.sourceOrder))
      .toEqual([0, 1, 2]);
    expect(result.records[1]?.executedAt).toBe(result.records[2]?.executedAt);
  });

  it("preserves legitimate identical fills as separate executions", () => {
    const result = parseChinaMerchantsPages(
      CHINA_MERCHANTS_IDENTICAL_FILLS,
      options,
    );

    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.id).not.toBe(result.records[1]?.id);
  });

  it("exposes an async parser adapter for content dispatch", async () => {
    const parser = new ChinaMerchantsStatementParser(
      async () => CHINA_MERCHANTS_PAGES,
    );
    const input = { ...options, bytes: new Uint8Array([1, 2, 3]) };

    await expect(parser.detect(input)).resolves.toMatchObject({
      matched: true,
    });
    await expect(parser.parse(input)).resolves.toMatchObject({
      broker: "china-merchants",
      blocked: false,
    });
  });
});
