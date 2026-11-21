import { describe, expect, it } from "vitest";

import {
  CHINA_MERCHANTS_CODE_ONLY,
  CHINA_MERCHANTS_CROSS_PAGE,
  CHINA_MERCHANTS_EMPTY_FEES,
  CHINA_MERCHANTS_FIRST_SELL,
  CHINA_MERCHANTS_INCONSISTENT_SECURITY_BALANCE,
  CHINA_MERCHANTS_IDENTICAL_FILLS,
  CHINA_MERCHANTS_INVALID_DATE,
  CHINA_MERCHANTS_OTHER_ACCOUNT,
  CHINA_MERCHANTS_PAGES,
  CHINA_MERCHANTS_MISSING_SECURITY_BALANCE,
  CHINA_MERCHANTS_POSITION_EVIDENCE,
  CHINA_MERCHANTS_SHENZHEN_TYPE_BOUNDARY,
  NON_CHINA_MERCHANTS_PAGES,
} from "./__fixtures__/china-merchants-pages";
import {
  ChinaMerchantsStatementParser,
  detectChinaMerchantsStatement,
  parseChinaMerchantsPages,
} from "./china-merchants";
import { buildTradeEpisodes } from "../trades/episodes";

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

  it("turns security balances into replayable opening and closing positions", () => {
    const result = parseChinaMerchantsPages(CHINA_MERCHANTS_POSITION_EVIDENCE, options);

    expect(result.monthly).toMatchObject({
      documentId: "china-merchants:cms-fixture",
      accountId: expect.any(String),
      reviewRequired: false,
      positions: [
        expect.objectContaining({ phase: "opening", market: "CN-SH", symbol: "510300", date: "2025-01-02", quantity: "0" }),
        expect.objectContaining({ phase: "closing", market: "CN-SH", symbol: "510300", date: "2025-01-02", quantity: "1000", source: [{ page: 2, row: 216, role: "transaction-position" }] }),
        expect.objectContaining({ phase: "closing", market: "CN-SH", symbol: "510300", date: "2025-01-03", quantity: "0", source: [{ page: 2, row: 234, role: "transaction-position" }] }),
      ],
    });
    expect(result.records[0]?.source.openingPosition).toMatchObject({
      phase: "opening",
      symbol: "510300",
      quantity: "0",
    });
    expect(result.records[1]?.source.openingPosition).toMatchObject({
      phase: "closing",
      symbol: "510300",
      quantity: "1000",
    });
    expect(result.records[1]?.source.statementPositions).toHaveLength(3);
  });

  it("keeps a trade but flags missing security balance as incomplete evidence", () => {
    const result = parseChinaMerchantsPages(CHINA_MERCHANTS_MISSING_SECURITY_BALANCE, options);

    expect(result.records).toHaveLength(1);
    expect(result.monthly).toMatchObject({
      reviewRequired: true,
      incompleteInstruments: [{ market: "CN-SH", symbol: "510300" }],
      positions: [],
    });
    expect(result.monthly?.historyIncomplete).toBeUndefined();
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing-china-merchants-security-balance", instrumentSymbol: "510300" }),
    ]));
    expect(result.records[0]?.source).not.toHaveProperty("openingPosition");
  });

  it("reconstructs a first A-share sell as a long inventory close, not a short", () => {
    const result = parseChinaMerchantsPages(CHINA_MERCHANTS_FIRST_SELL, options);

    expect(result.monthly).toMatchObject({
      reviewRequired: false,
      positions: [
        expect.objectContaining({
          phase: "opening",
          market: "CN-SH",
          symbol: "513010",
          quantity: "92400",
        }),
        expect.objectContaining({
          phase: "closing",
          market: "CN-SH",
          symbol: "513010",
          quantity: "0",
        }),
      ],
    });
    expect(result.records[0]?.source.openingPosition).toMatchObject({
      phase: "opening",
      quantity: "92400",
    });

    const [episode] = buildTradeEpisodes(result.records);
    expect(episode).toMatchObject({
      direction: "long",
      status: "closed",
      openingQuantity: "92400",
      remainingQuantity: "0",
    });
  });

  it("does not convert an inconsistent A-share balance into a negative opening position", () => {
    const result = parseChinaMerchantsPages(
      CHINA_MERCHANTS_INCONSISTENT_SECURITY_BALANCE,
      options,
    );

    expect(result.monthly).toMatchObject({
      reviewRequired: true,
      incompleteInstruments: [{ market: "CN-SH", symbol: "510300" }],
      positions: [
        expect.objectContaining({ phase: "closing", quantity: "50" }),
      ],
    });
    expect(result.monthly?.historyIncomplete).toBeUndefined();
    expect(result.monthly?.positions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "opening", quantity: expect.stringMatching(/^-/) }),
      ]),
    );
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "inconsistent-china-merchants-security-balance" }),
    ]));
  });

  it("marks missing times as date-only and preserves physical source order", () => {
    const result = parseChinaMerchantsPages(CHINA_MERCHANTS_PAGES, options);

    expect(result.records[1]).toMatchObject({
      executedAt: "2025-01-03T07:00:00.000Z",
      quantity: "1000",
      price: "6.5",
      fee: "3.2",
      source: {
        platform: "china-merchants",
        page: 2,
        sourceOrder: 1,
        timePrecision: "date-only",
        sourceTimestampText: "20250103",
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

  it("does not treat historical 150xxx graded funds as Shenzhen ETFs", () => {
    const result = parseChinaMerchantsPages(
      CHINA_MERCHANTS_SHENZHEN_TYPE_BOUNDARY,
      options,
    );

    expect(result.candidates).toEqual([
      {
        market: "CN-SZ",
        symbol: "159001",
        sourceName: undefined,
        sourceAssetType: "etf",
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

// Actual p9/p11 narrow ETF geometry; account and cash balance anonymized.
const narrowEtfHeader: Array<[string, number, number]> = [
  ["发生日期 市场", 36, 74.484],
  ["币种", 122.904, 24],
  ["银行代码 证券账号", 154.356, 98.484],
  ["证券代码 证券名称", 260.292, 98.484],
  ["业务标志", 371.196, 48],
  ["发生数量 成交均价", 463.908, 98.484],
  ["成交金额", 569.844, 48],
  ["佣金 印花税 其他费", 625.296, 100.968],
  ["变动金额", 736.2, 48],
  ["资金余额 证", 794.136, 62.484],
];
const narrowEtfRows: Array<{
  date: string;
  fee: string;
  quantity: string;
  price: string;
  grossAmount: string;
  netAmount: string;
  items: Array<[string, number, number]>;
}> = [
  {
    date: "20260122",
    fee: "5.00",
    quantity: "10000",
    price: "1.307",
    grossAmount: "13070.00",
    netAmount: "-13075.00",
    items: [
      ["20260122 深圳", 36, 70.836],
      ["人民币 匿名银行 0000000001 159813", 119.256, 180.156],
      ["芯片", 306.864, 24],
      ["证券买入", 353.22, 48],
      ["10000.00", 445.932, 41.664],
      ["1.3070", 495.048, 30.576],
      ["13070.00", 533.076, 41.664],
      ["5.00", 582.192, 19.488],
      ["0.00", 609.132, 19.488],
      ["0.00", 636.072, 19.488],
      ["-13075.00", 663.012, 46.164],
      ["0.00 45300.00", 716.628, 90.312],
    ],
  },
  {
    date: "20260202",
    fee: "5.00",
    quantity: "10000",
    price: "1.259",
    grossAmount: "12590.00",
    netAmount: "-12595.00",
    items: [
      ["20260202 深圳", 36, 70.836],
      ["人民币 匿名银行 0000000001 159813", 119.256, 180.156],
      ["芯片", 306.864, 24],
      ["证券买入", 353.22, 48],
      ["10000.00", 445.932, 41.664],
      ["1.2590", 495.048, 30.576],
      ["12590.00", 533.076, 41.664],
      ["5.00", 582.192, 19.488],
      ["0.00", 609.132, 19.488],
      ["0.00", 636.072, 19.488],
      ["-12595.00", 663.012, 46.164],
      ["0.00 55300.00", 716.628, 90.312],
    ],
  },
  {
    date: "20260226",
    fee: "5.99",
    quantity: "20000",
    price: "1.272",
    grossAmount: "25440.00",
    netAmount: "-25445.99",
    items: [
      ["20260226 深圳", 36, 70.836],
      ["人民币 匿名银行 0000000001 159813", 119.256, 180.156],
      ["芯片", 306.864, 24],
      ["证券买入", 353.22, 48],
      ["20000.00", 445.932, 41.664],
      ["1.2720", 495.048, 30.576],
      ["25440.00", 533.076, 41.664],
      ["5.99", 582.192, 19.488],
      ["0.00", 609.132, 19.488],
      ["0.00", 636.072, 19.488],
      ["-25445.99 -622297.06 47700.00", 663.012, 146.988],
    ],
  },
];

describe("China Merchants narrow legacy fee columns", () => {
  it.each(narrowEtfRows)("preserves reported commission and settlement on $date", (sample) => {
    const items = (values: Array<[string, number, number]>, y: number) =>
      values.map(([text, x, width]) => ({ text, x, y, width, height: 12 }));
    const pages = [{
      pageNumber: 2, width: 900, height: 600,
      items: [
        ...items([["招商证券普通对账单", 36, 120], ["资产账号：0000000001", 200, 120]], 36),
        ...items([["流水明细", 36, 48]], 144),
        ...items(narrowEtfHeader, 180),
        ...items(sample.items, 216),
      ],
    }];
    const result = parseChinaMerchantsPages(pages, options);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      fee: String(Number(sample.fee)), quantity: sample.quantity, price: sample.price,
      source: {
        feeStatus: "reported", timePrecision: "date-only",
        sourceTimestampText: sample.date,
        settlement: {
          currency: "CNY", grossAmount: String(Number(sample.grossAmount)), netAmount: String(Number(sample.netAmount)),
          fees: { commission: String(Number(sample.fee)), stampDuty: "0", otherFee: "0" },
        },
      },
    });
  });
});
