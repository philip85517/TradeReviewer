import { describe, expect, it } from "vitest";

import {
  CHINA_MERCHANTS_CODE_ONLY,
  CHINA_MERCHANTS_CROSS_PAGE,
  CHINA_MERCHANTS_EMPTY_FEES,
  CHINA_MERCHANTS_IDENTICAL_FILLS,
  CHINA_MERCHANTS_INVALID_DATE,
  CHINA_MERCHANTS_OTHER_ACCOUNT,
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
        sourceAssetType: "unknown",
      },
      {
        market: "CN-SH",
        symbol: "518880",
        sourceName: "红利ETF",
        sourceAssetType: "etf",
      },
      {
        market: "CN-SH",
        symbol: "600938",
        sourceName: "招商银行",
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

  it("keeps a code-only execution for automatic name enrichment", () => {
    const result = parseChinaMerchantsPages(
      CHINA_MERCHANTS_CODE_ONLY,
      options,
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      instrument: {
        symbol: "600036",
        name: "名称待行情源补充",
      },
    });
    expect(result.candidates).toEqual([
      {
        market: "CN-SH",
        symbol: "600036",
        sourceName: undefined,
        sourceAssetType: "stock",
      },
    ]);
  });

  it("reads each fee column without shifting later balances into blanks", () => {
    const result = parseChinaMerchantsPages(
      CHINA_MERCHANTS_EMPTY_FEES,
      options,
    );

    expect(result.records.map((record) => record.fee)).toEqual(["3", "5", "4"]);
  });

  it("reuses the table layout on a headerless continuation page", () => {
    const result = parseChinaMerchantsPages(
      CHINA_MERCHANTS_CROSS_PAGE,
      options,
    );

    expect(result.records.map((record) => record.source.page)).toEqual([2, 3]);
    expect(result.records.map((record) => record.source.sourceOrder)).toEqual([
      0, 1,
    ]);
    expect(result.records.map((record) => record.fee)).toEqual(["6.2", "5"]);
  });

  it("derives one stable masked account ID per statement account", () => {
    const first = parseChinaMerchantsPages(CHINA_MERCHANTS_PAGES, options);
    const repeated = parseChinaMerchantsPages(
      CHINA_MERCHANTS_PAGES,
      options,
    );
    const other = parseChinaMerchantsPages(
      CHINA_MERCHANTS_OTHER_ACCOUNT,
      options,
    );
    const accountIds = new Set(
      first.records.map((record) => record.accountId),
    );

    expect(accountIds.size).toBe(1);
    expect(first.records[0]?.accountId).toMatch(
      /^china-merchants:[0-9a-f]{16}$/,
    );
    expect(first.records[0]?.accountId).toBe(
      repeated.records[0]?.accountId,
    );
    expect(first.records[0]?.accountId).not.toBe(
      other.records[0]?.accountId,
    );
    expect(first.records[0]?.accountId).not.toContain("0000000001");
  });

  it("rejects a syntactically valid but impossible calendar date", () => {
    const result = parseChinaMerchantsPages(
      CHINA_MERCHANTS_INVALID_DATE,
      options,
    );

    expect(result.records).toHaveLength(0);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid-china-merchants-trade-row",
        instrumentSymbol: "600938",
      }),
    ]);
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
