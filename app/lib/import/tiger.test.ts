import { describe, expect, it } from "vitest";

import { buildTradeEpisodes } from "../trades/episodes";
import { legacyItem, legacyPages, legacyRow } from "./__fixtures__/tiger-legacy-pages";
import {
  NON_TIGER_PAGES,
  TIGER_IDENTICAL_FILL_PAGES,
  TIGER_PAGES,
  TIGER_SHORT_PAGES,
  TIGER_TRADITIONAL_CROSS_PAGE_DUPLICATE,
  TIGER_TRADITIONAL_DIFFERENT_MARKET,
  TIGER_TRADITIONAL_MISSING_KEY_FIELD,
  TIGER_TRADITIONAL_PAGES,
  TIGER_TRADITIONAL_SPLIT_FEE_DUPLICATE,
  TIGER_TRADITIONAL_VARIABLE_HEIGHT_FEES,
} from "./__fixtures__/tiger-pages";
import {
  detectTigerStatement,
  parseTigerPages,
  TigerStatementParser,
} from "./tiger";

const options = {
  fileName: "Tiger_2025.pdf",
  fileFingerprint: "tiger-fixture",
};

describe("Tiger fee reconciliation", () => {
  const subtotal = (amount: string, currency = "USD", y = 340) =>
    legacyRow(y, ["合计", "", "", "", "", "", "", "", amount, "", "", "", "", currency]);

  it.each(["其他代收", "其它代收", "Other Charges"])("includes %s before other fee components", label => {
    const pages = legacyPages({ fee: "平台费: -1" });
    pages[0].items.push(legacyItem(`${label}: -2`, 710, 241), ...subtotal("-3"));
    const result = parseTigerPages(pages, options);
    expect(result.records[0]?.fee).toBe("3");
    expect(result.blocked).toBe(false);
    expect(result.monthly?.reviewRequired).toBe(false);
  });

  it("blocks an omitted unknown component against the printed currency total", () => {
    const pages = legacyPages({ fee: "平台费: -1" });
    pages[0].items.push(legacyItem("未识别项目: -2", 710, 241), ...subtotal("-3"));
    const result = parseTigerPages(pages, options);
    expect(result.blocked).toBe(true);
    expect(result.monthly?.reviewRequired).toBe(true);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      severity: "error", code: "tiger-fee-total-mismatch", page: 1, row: 340,
      message: expect.stringContaining("USD"),
    }));
    // Retain the parsed evidence for review; never distribute the unexplained difference.
    expect(result.records[0]?.fee).toBe("1");
  });

  it("reconciles currencies separately and ignores base-currency conversion totals", () => {
    const pages = legacyPages();
    pages[0].items.push(...subtotal("-2"));
    pages[0].items.push(...legacyRow(380, ["01888", "HK", "SEHK", "", "3", "10", "-30", "0", "-5", "0", "", "2020-12-08 10:20:30, GMT+8", "2020-12-10", "HKD"]));
    pages[0].items.push(...subtotal("-5", "HKD", 420));
    pages[0].items.push(...legacyRow(450, ["合计（基础币种）", "", "", "", "", "", "", "", "-999", "", "", "", "", "USD"]));
    expect(parseTigerPages(pages, options).blocked).toBe(false);
    pages[0].items = pages[0].items.map(i => i.y === 420 && i.x === 710 ? { ...i, text: "-6" } : i);
    expect(parseTigerPages(pages, options)).toMatchObject({ blocked: true, monthly: { reviewRequired: true } });
  });

  it("joins a fee list split over a repeated page header and reconciles its total", () => {
    const first = legacyPages()[0];
    first.items = first.items.filter(i => i.y <= 210);
    first.items.push(legacyItem("其他代收: -2", 710, 790));
    const second = legacyPages({ fee: "平台费: -1" })[0];
    second.pageNumber = 2;
    second.items.push(...subtotal("-3"));
    const result = parseTigerPages([first, second], options);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.fee).toBe("3");
    expect(result.blocked).toBe(false);
    expect(new Set(result.records[0]?.source.fragments?.filter(f => f.role === "fee").map(f => f.page))).toEqual(new Set([1, 2]));
  });

  it("blocks an unreadable printed currency fee subtotal", () => {
    const pages = legacyPages();
    pages[0].items.push(...subtotal("unreadable"));
    expect(parseTigerPages(pages, options)).toMatchObject({ blocked: true, diagnostics: [expect.objectContaining({ code: "invalid-tiger-fee-total" })] });
  });

  it("blocks missing or inconsistent fee evidence even without a currency subtotal", () => {
    expect(parseTigerPages(legacyPages({ fee: "" }), options).blocked).toBe(true);
    const pages = legacyPages({ fee: "佣金: -2" });
    pages[0].items.push(legacyItem("小计: -9", 710, 259));
    expect(parseTigerPages(pages, options)).toMatchObject({
      blocked: true, monthly: { reviewRequired: true },
      diagnostics: [expect.objectContaining({ severity: "error", code: "invalid-tiger-fee" })],
    });
  });
});

describe("Tiger historical monthly evidence", () => {
  it("recognizes Limited and signed quantities with blank direction, excluding totals", () => {
    const result = parseTigerPages(legacyPages(), options);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ side: "buy", quantity: "3", fee: "2", accountId: "tiger:SYNTH001", source: { grossAmount: "-30", settlementDate: "2020-12-10", timeEvidence: "row" } });
    expect(parseTigerPages(legacyPages({ quantity: "-3" }), options).records[0]?.side).toBe("sell");
    expect(result.monthly).toMatchObject({ month: "2020-12", accountId: "tiger:SYNTH001", positions: [], events: [], reviewRequired: false });
  });
  it("recognizes a documented no-stock month without claiming unsupported layout", () => {
    expect(parseTigerPages(legacyPages({ empty: true }), options)).toMatchObject({ blocked: false, records: [], monthly: { month: "2020-12", reviewRequired: false } });
  });
  it("preserves identical blank-direction fills at separate source rows", () => {
    const pages = legacyPages();
    pages[0].items.push(...legacyRow(330, ["SYNX", "US", "NASDAQ", "", "3", "10", "-30", "0", "-2", "0", "", "2020-12-08 10:20:30, US/Eastern", "2020-12-10", "USD"]));
    const result = parseTigerPages(pages, options);
    expect(result.records).toHaveLength(2);
    expect(new Set(result.records.map(r => r.id)).size).toBe(2);
  });
  it.each([
    ["2024-11-03 01:30:00, US/Eastern", "ambiguous-wall-clock"],
    ["2024-03-10 02:30:00, US/Eastern", "nonexistent-wall-clock"],
    ["2024-02-30 10:20:30, GMT+8", "invalid-statement-time"],
    ["bad date", "invalid-statement-time"],
    ["2024-04-01 10:20:30", "missing-statement-timezone"],
  ])("rejects %s visibly", (time, code) => {
    const result = parseTigerPages(legacyPages({ time }), options);
    expect(result.records).toHaveLength(0);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code }));
    expect(result.monthly?.reviewRequired).toBe(true);
    expect(result.blocked).toBe(true);
  });
  it("uses explicit user timezone for an otherwise unevidenced row", () => {
    const result = parseTigerPages(legacyPages({ time: "2020-12-08 10:20:30" }), { ...options, sourceTimezone: "America/New_York" });
    expect(result.records[0]).toMatchObject({ executedAt: "2020-12-08T15:20:30.000Z", source: { timeEvidence: "user" } });
  });
  it("keeps missing fee distinct from reported zero", () => {
    expect(parseTigerPages(legacyPages({ fee: "" }), options)).toMatchObject({ monthly: { reviewRequired: true }, records: [{ source: { feeStatus: "unknown" } }] });
    expect(parseTigerPages(legacyPages({ fee: "0" }), options)).toMatchObject({ monthly: { reviewRequired: false }, records: [{ source: { feeStatus: "reported" } }] });
  });
  it("isolates document accounts and respects explicit account mapping", () => {
    expect(parseTigerPages(legacyPages({ account: "SYNTH002" }), options).records[0]?.accountId).toBe("tiger:SYNTH002");
    expect(parseTigerPages(legacyPages(), { ...options, accountId: "mapped" }).records[0]?.accountId).toBe("mapped");
  });
  it("preserves repeated code-only fills with explicit direction", () => {
    const pages = legacyPages();
    pages[0].items.push(legacyItem("买入", 290, 250));
    pages[0].items.push(...legacyRow(330, ["SYNX", "US", "NASDAQ", "买入", "3", "10", "-30", "0", "-2", "0", "", "2020-12-08 10:20:30, US/Eastern", "2020-12-10", "USD"]));
    expect(parseTigerPages(pages, options).records).toHaveLength(2);
  });
  it("does not add a fee subtotal a second time", () => {
    const pages = legacyPages({ fee: "佣金: -2" });
    pages[0].items.push(legacyItem("平台费: -1", 710, 259), legacyItem("小计: -3", 710, 268));
    expect(parseTigerPages(pages, options).records[0]?.fee).toBe("3");
  });
  it("refuses inconsistent fee totals with a visible row diagnostic", () => {
    const pages = legacyPages({ fee: "佣金: -2" });
    pages[0].items.push(legacyItem("小计: -9", 710, 259));
    const result = parseTigerPages(pages, options);
    expect(result.records).toHaveLength(0);
    expect(result.monthly?.reviewRequired).toBe(true);
  });
  it("ends execution context at other sections and excludes fund tables", () => {
    const pages = legacyPages();
    pages[0].items.push(legacyItem("期末持仓", 30, 310));
    pages[0].items.push(...legacyRow(330, ["OTHER", "US", "NASDAQ", "", "4", "11", "-44", "0", "-2", "0", "", "2020-12-08 10:20:30, US/Eastern", "2020-12-10", "USD"]));
    expect(parseTigerPages(pages, options).records).toHaveLength(1);
    const fund = legacyPages();
    fund[0].items = fund[0].items.map(i => i.text === "股票" ? { ...i, text: "基金" } : i);
    expect(parseTigerPages(fund, options)).toMatchObject({ records: [], exclusions: [expect.objectContaining({ category: "fund" })] });
  });
  it("retains fragments of suppressed display continuations", () => {
    const result = parseTigerPages(TIGER_TRADITIONAL_CROSS_PAGE_DUPLICATE, options);
    expect(new Set(result.records[0]?.source.fragments?.map(f => f.page))).toEqual(new Set([1, 2]));
  });
  it("surfaces a damaged stock row whose quantity is missing", () => {
    const result = parseTigerPages(legacyPages({ quantity: "" }), options);
    expect(result.records).toHaveLength(0);
    expect(result.monthly?.reviewRequired).toBe(true);
  });
  it("recognizes no-trade months that contain a stock holdings section", () => {
    const pages = legacyPages({ empty: true });
    pages[0].items.push(legacyItem("股票", 30, 180), legacyItem("代码", 30, 210), legacyItem("期末数量", 370, 210));
    expect(parseTigerPages(pages, options)).toMatchObject({ blocked: false, records: [], monthly: { reviewRequired: false } });
  });
  it("ignores subsequent unrelated table headers and explanatory prose", () => {
    const pages = legacyPages();
    pages[0].items.push(...legacyRow(330, ["代码", "申购数量(股)", "申购类型", "申购截止时间", "上市时间", "利息收取时间", "记息天数", "", "", "", "", "IPO利率", "", "币种"]));
    expect(parseTigerPages(pages, options).monthly?.reviewRequired).toBe(false);
  });
  it("retains the prior-page date fragment for a split timestamp", () => {
    const pages = legacyPages();
    pages[0].items.push(legacyItem("2020-12-09", 1010, 790));
    const continuation = legacyPages({ time: "11:20:30, US/Eastern" })[0];
    continuation.pageNumber = 2;
    const result = parseTigerPages([...pages, continuation], options);
    expect(result.records[1]?.executedAt).toBe("2020-12-09T16:20:30.000Z");
    expect(result.records[1]?.source.fragments).toContainEqual({ page: 1, row: 790, role: "execution-date" });
  });
  it("does not carry a fund date into a stock execution", () => {
    const fund = legacyPages();
    fund[0].items = fund[0].items.map(i => i.text === "股票" ? { ...i, text: "基金" } : i);
    fund[0].items.push(legacyItem("2020-12-09", 1010, 790));
    const stock = legacyPages({ time: "11:20:30, US/Eastern" })[0];
    stock.pageNumber = 2;
    const result = parseTigerPages([...fund, stock], options);
    expect(result.records).toHaveLength(0);
    expect(result.monthly?.reviewRequired).toBe(true);
  });
});

describe("Tiger PDF import", () => {
  it("requires both the broker heading and a stock table header", () => {
    expect(detectTigerStatement(TIGER_PAGES)).toMatchObject({
      matched: true,
    });
    expect(detectTigerStatement(NON_TIGER_PAGES)).toMatchObject({
      matched: false,
    });
  });

  it("imports long, short, and ETF rows without doubling display duplicates", () => {
    const result = parseTigerPages(TIGER_PAGES, options);

    expect(result.broker).toBe("tiger");
    expect(result.records).toHaveLength(5);
    expect(
      result.records.find(
        (execution) =>
          execution.instrument.symbol === "1810" &&
          execution.side === "sell",
      ),
    ).toMatchObject({
      side: "sell",
      quantity: "800",
      price: "51.8",
      fee: "5.8",
      instrument: {
        market: "HK",
        name: "小米集团-W",
        currency: "HKD",
      },
      source: {
        platform: "tiger",
        page: 1,
        sourceTimezone: "GMT+8",
        timePrecision: "second",
      },
    });
    expect(result.candidates).toContainEqual({
      market: "US",
      symbol: "SPY",
      sourceName: "SPDR S&P 500 ETF",
      sourceAssetType: "etf",
    });
    expect(result.exclusions).toContainEqual(
      expect.objectContaining({ category: "fund", count: 1 }),
    );
  });

  it("carries the stock section across a page break with a repeated header", () => {
    const pages = TIGER_PAGES.map((page, index) =>
      index === 1
        ? {
            ...page,
            items: page.items.filter((item) => item.text !== "股票交易"),
          }
        : page,
    );

    expect(parseTigerPages(pages, options).records).toHaveLength(5);
  });

  it("builds a closed short episode from short-open then close", () => {
    const result = parseTigerPages(TIGER_SHORT_PAGES, options);
    const [episode] = buildTradeEpisodes(result.records);

    expect(episode).toMatchObject({
      direction: "short",
      status: "closed",
      openingQuantity: "800",
      remainingQuantity: "0",
    });
  });

  it("keeps legitimate identical fills when the identity cells repeat", () => {
    const result = parseTigerPages(TIGER_IDENTICAL_FILL_PAGES, options);

    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.id).not.toBe(result.records[1]?.id);
  });

  it("exposes an async parser adapter for the dispatcher", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const extractPages = async () => TIGER_SHORT_PAGES;
    const parser = new TigerStatementParser(extractPages);

    await expect(
      parser.detect({
        ...options,
        bytes,
      }),
    ).resolves.toMatchObject({ matched: true });
    await expect(
      parser.parse({
        ...options,
        bytes,
      }),
    ).resolves.toMatchObject({ broker: "tiger", blocked: false });
  });

  it("parses the anonymized Traditional-Chinese multi-line layout", () => {
    expect(detectTigerStatement(TIGER_TRADITIONAL_PAGES)).toMatchObject({
      matched: true,
    });

    const result = parseTigerPages(TIGER_TRADITIONAL_PAGES, options);
    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toMatchObject({
      side: "buy",
      executedAt: "2025-09-18T02:00:00.000Z",
      instrument: { market: "HK", symbol: "1810", name: "匿名港股" },
    });
    expect(result.records[1]).toMatchObject({
      side: "sell",
      executedAt: "2025-09-18T14:00:00.000Z",
      instrument: { market: "US", symbol: "SPY" },
    });
    expect(result.records[2]).toMatchObject({
      executedAt: "2025-12-18T15:00:00.000Z",
    });
    expect(result.candidates).toContainEqual(
      expect.objectContaining({
        symbol: "MYST",
        sourceAssetType: "unknown",
      }),
    );
  });

  it("collapses an exact blank-identity continuation across a page header", () => {
    const result = parseTigerPages(
      TIGER_TRADITIONAL_CROSS_PAGE_DUPLICATE,
      options,
    );
    expect(result.records).toHaveLength(1);
  });

  it("does not collapse an identity continuation with a missing key field", () => {
    const result = parseTigerPages(
      TIGER_TRADITIONAL_MISSING_KEY_FIELD,
      options,
    );
    expect(result.records).toHaveLength(2);
    expect(result.records[1]?.instrument.symbol).toBe("SPY");
  });

  it("does not collapse otherwise identical rows from different markets", () => {
    const result = parseTigerPages(
      TIGER_TRADITIONAL_DIFFERENT_MARKET,
      options,
    );
    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.instrument.market)).toEqual([
      "HK",
      "US",
    ]);
  });

  it("distinguishes a Tiger document with an unsupported table schema", () => {
    const detection = detectTigerStatement(NON_TIGER_PAGES);
    expect(detection).toMatchObject({
      matched: false,
      diagnostics: [
        expect.objectContaining({ code: "unsupported-tiger-layout" }),
      ],
    });
    expect(parseTigerPages(NON_TIGER_PAGES, options)).toMatchObject({
      blocked: true,
      diagnostics: [
        expect.objectContaining({ code: "unsupported-tiger-layout" }),
      ],
    });
  });

  it("attributes variable-height fee lists by logical block", () => {
    const result = parseTigerPages(
      TIGER_TRADITIONAL_VARIABLE_HEIGHT_FEES,
      options,
    );
    expect(result.records.map((record) => record.fee)).toEqual(["7", "6"]);
  });

  it("joins a split cross-page fee list before collapsing its display duplicate", () => {
    const result = parseTigerPages(
      TIGER_TRADITIONAL_SPLIT_FEE_DUPLICATE,
      options,
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.fee).toBe("7");
  });
});
