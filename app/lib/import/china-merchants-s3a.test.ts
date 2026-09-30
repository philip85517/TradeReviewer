import { describe, expect, it } from "vitest";
import { columnStatement } from "./__fixtures__/china-merchants-columns";
import { CHINA_MERCHANTS_S3A_LEGACY } from "./__fixtures__/china-merchants-s3a";
import { parseChinaMerchantsPages } from "./china-merchants";
import { readLegacyChinaMerchantsRows } from "./china-merchants-legacy-layout";
import { reconcileExecutions } from "./execution-reconciliation";

const options = {
  fileName: "masked-china-merchants-s3a.pdf",
  fileFingerprint: "s3a-legacy",
};

const overlapRow = [
  "20260309",
  "深圳",
  "人民币",
  "测试银行",
  "A000000001",
  "000893",
  "匿名钾",
  "证券卖出",
  "-500",
  "65.08",
  "32540",
  "7.66",
  "16.27",
  "0",
  "32516.07",
  "32793.33",
  "0",
];

function parseWithoutLegacyCells(remove: number[], y = 216) {
  const pages = structuredClone(CHINA_MERCHANTS_S3A_LEGACY);
  pages[1].items = pages[1].items.filter(
    (item) => !(item.y === y && remove.includes(item.x)),
  );
  return parseChinaMerchantsPages(pages, options);
}

describe("China Merchants S3a legacy source evidence", () => {
  it("reconciles a legacy-layout overlap only after preserving its source evidence", () => {
    const incoming = parseChinaMerchantsPages(
      CHINA_MERCHANTS_S3A_LEGACY,
      options,
    );
    const existing = parseChinaMerchantsPages(
      columnStatement({ rows: [overlapRow] }),
      { ...options, fileFingerprint: "s3a-modern" },
    );

    expect(incoming.records[0]?.source.settlement).toMatchObject({
      currency: "CNY",
      quantity: "500",
      grossAmount: "32540",
      netAmount: "32516.07",
      fees: { commission: "7.66", stampDuty: "16.27", otherFee: "0" },
    });
    expect(incoming.records[0]?.source.statementRowFingerprint).toEqual(
      existing.records[0]?.source.statementRowFingerprint,
    );
    expect(incoming.records[0]?.source.statementPositions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "closing", quantity: "0" }),
      ]),
    );
    expect(reconcileExecutions(existing.records, [incoming.records[0]!])).toMatchObject({
      acceptedIncoming: [],
      conflicts: [],
      duplicates: [{ kept: existing.records[0], skipped: incoming.records[0] }],
    });
  });

  it("retains a red-share quantity event with zero cash evidence without creating a buy", () => {
    const result = parseChinaMerchantsPages(
      CHINA_MERCHANTS_S3A_LEGACY,
      options,
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.instrument.symbol).toBe("000893");
    expect(result.monthly?.events).toEqual([
      expect.objectContaining({
        kind: "corporate-action",
        market: "CN-SH",
        symbol: "516780",
        quantity: "10000",
        amount: "0",
        currency: "CNY",
        description: "红股入账",
        source: [{ page: 2, row: 234, role: "corporate-action" }],
      }),
    ]);
    expect(result.monthly?.events[0]).not.toHaveProperty("cost");
    expect(result.monthly?.events[0]).not.toHaveProperty("price");
  });

  it("keeps a valid execution when both optional balance cells are missing", () => {
    const result = parseWithoutLegacyCells([736, 794]);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.source.settlement).toBeUndefined();
    expect(result.records[0]?.source.statementRowFingerprint).toBeUndefined();
    expect(result.monthly?.reviewRequired).toBe(true);
  });

  it("keeps the execution but leaves tail identity unknown when cash balance is missing", () => {
    const result = parseWithoutLegacyCells([736]);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.source.statementPositions).toBeUndefined();
    expect(result.records[0]?.source.statementRowFingerprint).toBeUndefined();
    expect(result.monthly?.reviewRequired).toBe(true);
  });

  it("keeps a known security-balance gap instrument-scoped", () => {
    const result = parseWithoutLegacyCells([736]);

    expect(result.monthly).toMatchObject({
      reviewRequired: true,
      incompleteInstruments: [{ market: "CN-SZ", symbol: "000893" }],
    });
    expect(result.monthly?.historyIncomplete).toBeUndefined();
  });

  it("keeps a known negative opening balance warning instrument-scoped", () => {
    const result = parseChinaMerchantsPages(
      columnStatement({
        rows: [[
          "20250103",
          "上海",
          "人民币",
          "测试银行",
          "A000000001",
          "600036",
          "招商银行",
          "证券买入",
          "100.00",
          "40.0000",
          "4000.00",
          "5.00",
          "0.00",
          "0.04",
          "-4005.04",
          "5994.96",
          "0.00",
        ]],
      }),
      options,
    );

    expect(result.monthly).toMatchObject({
      reviewRequired: true,
      incompleteInstruments: [{ market: "CN-SH", symbol: "600036" }],
    });
    expect(result.monthly?.historyIncomplete).toBeUndefined();
  });

  it("keeps a known corporate-action evidence gap instrument-scoped", () => {
    const pages = structuredClone(CHINA_MERCHANTS_S3A_LEGACY);
    pages[1].items = pages[1].items.map((item) =>
      item.y === 234 && item.x === 120
        ? { ...item, text: "未知币 测试银行 A000000001 516780" }
        : item,
    );

    const result = parseChinaMerchantsPages(pages, options);

    expect(result.monthly).toMatchObject({
      reviewRequired: true,
      incompleteInstruments: [{ market: "CN-SH", symbol: "516780" }],
    });
    expect(result.monthly?.historyIncomplete).toBeUndefined();
  });

  it("keeps a corporate-action warning generic when its market is unknown", () => {
    const pages = structuredClone(CHINA_MERCHANTS_S3A_LEGACY);
    pages[1].items = pages[1].items.map((item) =>
      item.y === 234 && item.x === 36
        ? { ...item, text: "20260522 未知市场" }
        : item,
    );

    const result = parseChinaMerchantsPages(pages, options);

    expect(result.monthly?.reviewRequired).toBe(true);
    expect(result.monthly?.historyIncomplete).toBe(true);
    expect(result.monthly?.incompleteInstruments).toBeUndefined();
  });

  it("keeps a corporate-action warning generic when its symbol is malformed", () => {
    const result = parseChinaMerchantsPages(
      columnStatement({
        rows: [[
          "20250103",
          "上海",
          "人民币",
          "测试银行",
          "A000000001",
          "???",
          "未知证券",
          "红股入账",
          "100",
          "0",
          "0",
          "0",
          "0",
          "0",
          "",
          "1000",
          "100",
        ]],
      }),
      options,
    );

    expect(result.monthly?.reviewRequired).toBe(true);
    expect(result.monthly?.historyIncomplete).toBe(true);
    expect(result.monthly?.incompleteInstruments).toBeUndefined();
  });

  it("does not treat a bank balance as red-share cash when cash-change is missing", () => {
    const result = parseWithoutLegacyCells([684], 234);

    expect(result.monthly?.events).toHaveLength(0);
    expect(result.monthly?.reviewRequired).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.instrument.symbol).toBe("000893");
  });

  it("leaves a packed ambiguous tail unknown instead of relabeling its second number", () => {
    const pages = structuredClone(CHINA_MERCHANTS_S3A_LEGACY);
    pages[1].items = pages[1].items.filter(
      (item) => !(item.y === 216 && [684, 736, 794].includes(item.x)),
    );
    pages[1].items.push({
      text: "32516.07 0.00",
      x: 684,
      y: 216,
      width: 132,
      height: 9,
    });

    const rows = readLegacyChinaMerchantsRows(pages);
    const result = parseChinaMerchantsPages(pages, {
      ...options,
      fileFingerprint: "s3a-packed",
    });

    expect(rows[0]?.cells).toBeUndefined();
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.source.statementRowFingerprint).toBeUndefined();
    expect(result.monthly?.reviewRequired).toBe(true);
  });

  it("leaves a very wide cash balance unknown when security balance is missing", () => {
    const pages = structuredClone(CHINA_MERCHANTS_S3A_LEGACY);
    pages[1].items = pages[1].items.filter(
      (item) => !(item.y === 216 && item.x === 794),
    );
    for (const item of pages[1].items) {
      if (item.y !== 216) continue;
      if (item.x === 464) {
        item.text = "-1.00 1.0000";
        item.width = item.text.length * 5.5;
      }
      if (item.x === 552) {
        item.text = "1.00";
        item.width = 22;
      }
      if (item.x === 600 || item.x === 627) {
        item.text = "0.00";
        item.width = 22;
      }
      if (item.x === 684) {
        item.text = "1.00";
        item.width = 22;
      }
      if (item.x === 736) {
        item.text = "-1000000000.00";
        item.width = item.text.length * 5.5;
      }
    }

    const result = parseChinaMerchantsPages(pages, {
      ...options,
      fileFingerprint: "s3a-wide",
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.source.statementPositions).toBeUndefined();
    expect(result.monthly?.reviewRequired).toBe(true);
  });
});
