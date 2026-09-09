import { describe, expect, it } from "vitest";
import { columnStatement } from "./__fixtures__/china-merchants-columns";
import { parseChinaMerchantsPages } from "./china-merchants";
import { enrichStatementImport } from "./enrich-import";
import { createImportPreview } from "./import-preview";
import { reconcileExecutions } from "./execution-reconciliation";
const options = { fileName: "arbitrary.pdf", fileFingerprint: "one" };

describe("A-share statement column layouts", () => {
  it.each([{}, { scale: 1.7, shift: 43 }, { continuation: true }])(
    "reads independent columns without fixed coordinates: %j",
    (variant) => {
      const result = parseChinaMerchantsPages(
        columnStatement(variant),
        options,
      );
      expect(result.blocked).toBe(false);
      expect(result.records).toHaveLength(2);
      expect(result.records[0]).toMatchObject({
        quantity: "100",
        price: "40",
        fee: "5.04",
        instrument: { symbol: "600036", market: "CN-SH", currency: "CNY" },
        source: { timePrecision: "date-only" },
      });
      expect(result.records[1]).toMatchObject({
        quantity: "200",
        price: "1.1",
        fee: "5",
        instrument: { symbol: "159813", market: "CN-SZ" },
      });
    },
  );
  it("stops before the next statement section", () => {
    expect(
      parseChinaMerchantsPages(columnStatement({ stop: true }), options)
        .records,
    ).toHaveLength(0);
  });
  it("rejects a cash mismatch instead of shifting a blank fee column", () => {
    const result = parseChinaMerchantsPages(
      columnStatement({ blankFee: true }),
      options,
    );
    expect(result.records).toHaveLength(0);
    expect(
      result.diagnostics.some(
        (item) => item.code === "invalid-china-merchants-trade-row",
      ),
    ).toBe(true);
  });
  it("integrates parsed names and the requested format label into the existing preview", async () => {
    const parsed = parseChinaMerchantsPages(columnStatement(), options);
    const enriched = await enrichStatementImport(parsed, {
      resolver: async () => {
        throw new Error("Names and types are on the statement");
      },
    });
    const preview = createImportPreview(options.fileName, enriched);
    expect(preview.notices).toEqual(
      expect.arrayContaining([expect.stringContaining("交易日期")]),
    );
    expect(preview).toMatchObject({
      sourceLabel: "A股招商银行",
      tradeCount: 2,
      blocked: false,
      unresolvedInstrumentCount: 0,
    });
  });
  it("keeps separate asset accounts but deduplicates the same account across files", () => {
    const first = parseChinaMerchantsPages(columnStatement(), options).records;
    const other = parseChinaMerchantsPages(
      columnStatement({ account: "0000000002" }),
      { ...options, fileFingerprint: "two" },
    ).records;
    expect(first).toHaveLength(2);
    expect(other[0].accountId).not.toBe(first[0].accountId);
    expect(reconcileExecutions(first, other).acceptedIncoming).toHaveLength(2);
    const repeat = parseChinaMerchantsPages(columnStatement(), {
      ...options,
      fileFingerprint: "three",
    }).records;
    expect(reconcileExecutions(first, repeat).duplicates).toHaveLength(2);
  });
  it("excludes overseas trades, bonds, non-ETF funds and unclassified securities", () => {
    const cases = [
      ["沪港通", "00700", "腾讯控股"],
      ["上海", "113001", "转债"],
      ["深圳", "160001", "LOF基金"],
      ["上海", "999999", "未知证券"],
    ];
    const rows = cases.map(([market, symbol, name]) => [
      "20250103",
      market,
      "人民币",
      "银行",
      "A000000001",
      symbol,
      name,
      "证券买入",
      "100",
      "1",
      "100",
      "0",
      "0",
      "0",
      "-100",
      "0",
      "100",
    ]);
    const result = parseChinaMerchantsPages(columnStatement({ rows }), options);
    expect(result.records).toEqual([]);
    expect(result.exclusions.reduce((sum, x) => sum + x.count, 0)).toBe(4);
    expect(result.exclusions.map((x) => x.category)).toEqual(
      expect.arrayContaining(["market", "bond", "fund", "unknown-asset"]),
    );
  });
  it("blocks missing asset account instead of grouping by a security subaccount", () => {
    const pages = columnStatement();
    pages[0].items = pages[0].items.filter((item) => item.y !== 70);
    const result = parseChinaMerchantsPages(pages, options);
    expect(result.blocked).toBe(true);
    expect(result.diagnostics[0].code).toBe("missing-china-merchants-account");
  });
  it("preserves original settlement evidence and rejects same-day cash conflicts", () => {
    const first = parseChinaMerchantsPages(columnStatement(), options).records;
    expect(first[0]?.source.settlement).toMatchObject({
      currency: "CNY",
      quantity: "100",
      grossAmount: "4000",
      netAmount: "-4005.04",
      fees: { commission: "5", stampDuty: "0", otherFee: "0.04" },
    });
    const pages = columnStatement();
    pages[0].items = pages[0].items.map((item) =>
      item.text === "5.00" && item.y === 170
        ? { ...item, text: "6.00" }
        : item.text === "-4005.04"
          ? { ...item, text: "-4006.04" }
          : item,
    );
    const changed = parseChinaMerchantsPages(pages, {
      ...options,
      fileFingerprint: "changed",
    }).records;
    const reconciled = reconcileExecutions(first, changed);
    expect(reconciled.duplicates).toHaveLength(1);
    expect(reconciled.conflicts).toHaveLength(1);
  });

  it("recognizes exchange ETF codes even when the abbreviated name contains 基金", () => {
    const rows = [
      [
        "20250103",
        "上海",
        "人民币",
        "银行",
        "A000000001",
        "516150",
        "行业基金",
        "证券买入",
        "100",
        "1",
        "100",
        "0",
        "0",
        "0",
        "-100",
        "0",
        "100",
      ],
    ];
    const result = parseChinaMerchantsPages(columnStatement({ rows }), options);
    expect(result.candidates).toEqual([
      {
        market: "CN-SH",
        symbol: "516150",
        sourceName: "行业基金",
        sourceAssetType: "etf",
      },
    ]);
  });

  it("reassembles dates, markets, symbols and account labels split into text fragments", () => {
    const pages = columnStatement();
    pages[0].items = pages[0].items.flatMap((item) => {
      if (
        ![
          "20250103",
          "600036",
          "上海",
          "资产账号：",
          "招商证券普通对账单",
          "40.0000",
        ].includes(item.text)
      )
        return [item];
      return [...item.text].map((text, index) => ({
        ...item,
        text,
        x: item.x + (index * item.width) / item.text.length,
        width: item.width / item.text.length,
      }));
    });
    const result = parseChinaMerchantsPages(pages, options);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      price: "40",
      instrument: { symbol: "600036" },
    });
  });

  it("keeps accounts distinct when the distinguishing digits are separate items", () => {
    const splitAccount = (account: string) => {
      const pages = columnStatement({ account });
      pages[0].items = pages[0].items.flatMap((item) =>
        item.text === account
          ? [
              { ...item, text: account.slice(0, 8), width: 40 },
              { ...item, text: account.slice(8), x: item.x + 40, width: 10 },
            ]
          : [item],
      );
      return pages;
    };
    const first = parseChinaMerchantsPages(
      splitAccount("0000000001"),
      options,
    ).records;
    const second = parseChinaMerchantsPages(splitAccount("0000000002"), {
      ...options,
      fileFingerprint: "second",
    }).records;
    expect(first[0].accountId).not.toBe(second[0].accountId);
    expect(reconcileExecutions(first, second).acceptedIncoming).toHaveLength(2);
  });
  it("treats numeric display precision changes as the same statement evidence", () => {
    const first = parseChinaMerchantsPages(columnStatement(), options).records;
    const pages = columnStatement();
    pages[0].items = pages[0].items.map((item) =>
      item.text === "4000.00"
        ? { ...item, text: "4000.0", x: item.x + 3, width: item.width - 3 }
        : item,
    );
    const second = parseChinaMerchantsPages(pages, {
      ...options,
      fileFingerprint: "alternate",
    }).records;
    const result = reconcileExecutions(first, second);
    expect(result.duplicates).toHaveLength(2);
    expect(result.conflicts).toEqual([]);
  });

  it.each(["-100", "0"])(
    "rejects invalid signed buy quantities: %s",
    (quantity) => {
      const rows = [
        [
          "20250103",
          "上海",
          "人民币",
          "银行",
          "A000000001",
          "600036",
          "招商银行",
          "证券买入",
          quantity,
          "40",
          "4000",
          "5",
          "0",
          "0",
          "-4005",
          "0",
          "100",
        ],
      ];
      const result = parseChinaMerchantsPages(
        columnStatement({ rows }),
        options,
      );
      expect(result.records).toHaveLength(0);
      expect(result.diagnostics[0].code).toBe(
        "invalid-china-merchants-trade-row",
      );
    },
  );
  it("reports unrecognized business rows without importing them", () => {
    const rows = [
      [
        "20250103",
        "上海",
        "人民币",
        "银行",
        "A000000001",
        "600036",
        "招商银行",
        "未知业务",
        "100",
        "40",
        "4000",
        "5",
        "0",
        "0",
        "-4005",
        "0",
        "100",
      ],
    ];
    const result = parseChinaMerchantsPages(columnStatement({ rows }), options);
    expect(result.records).toHaveLength(0);
    expect(result.diagnostics[0].code).toBe("unknown-china-merchants-business");
  });

  it("does not merge neighbouring text columns with a narrow gap", () => {
    const pages = columnStatement();
    pages[0].items = pages[0].items.map((item) =>
      item.x === 62 ? { ...item, x: 61 } : item,
    );
    const result = parseChinaMerchantsPages(pages, options);
    expect(result.records).toHaveLength(2);
  });

  it("reassembles long signed amounts that extend left of their column centre", () => {
    const rows = [
      [
        "20250103",
        "上海",
        "人民币",
        "银行",
        "A000000001",
        "600036",
        "招商银行",
        "证券买入",
        "100000",
        "100",
        "10000000",
        "5",
        "0",
        "0",
        "-10000005.00",
        "0",
        "100000",
      ],
    ];
    const pages = columnStatement({ rows });
    pages[0].items = pages[0].items.flatMap((item) =>
      item.text === "-10000005.00"
        ? [...item.text].map((text, index) => ({
            ...item,
            text,
            x: item.x + (index * item.width) / item.text.length,
            width: item.width / item.text.length,
          }))
        : [item],
    );
    const result = parseChinaMerchantsPages(pages, options);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].source.settlement?.netAmount).toBe("-10000005");
  });
});
