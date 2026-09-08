import { describe, expect, it } from "vitest";
import { applyMonthlyHistoryEvidence, attachStatementEvidence } from "./statement-evidence";
import type { StatementParseResult } from "./contracts";
import type { PdfTextPage } from "./pdf-text";
import type { TradeExecution } from "../trades/types";
import { isMonthlyStatement } from "./monthly-statement";
import { buildTradeEpisodes } from "../trades/episodes";
import { replayPositionAtPrice } from "../replay/position-ledger";
import { createReplaySnapshot } from "../replay/replay-engine";

// Synthetic values, with columns and relative baselines from original PDF.js layouts.
function page(rows: [number, string][][]): PdfTextPage {
  return { pageNumber: 1, width: 1200, height: 900, items: rows.flatMap((cells, row) => cells.map(([x, text]) => ({ x, y: 80 + row * 28, text, width: text.length * 6, height: 10 }))) };
}
function result(broker: "futu" | "tiger" = "futu"): StatementParseResult {
  return { broker, records: [], candidates: [], exclusions: [], diagnostics: [], blocked: false, monthly: { documentId: "fixture", templateIds: [], accountId: "acct", month: "2025-01", positions: [], events: [], reviewRequired: false } };
}

describe("attachStatementEvidence", () => {
  it("retains a no-trade closing snapshot after the last fill and reveals it only at its boundary", () => {
    const buy: TradeExecution = { id: "buy", accountId: "acct", accountLabel: "Test", instrument: { id: "US:LI", market: "US", symbol: "LI", name: "LI", currency: "USD" }, source: { platform: "tiger", row: 1 }, side: "buy", executedAt: "2025-01-10T14:30:00Z", quantity: "100", price: "30", fee: "0" };
    const monthly = { ...result().monthly!, month: "2025-02", positions: [{ accountId: "acct", market: "US", symbol: "LI", phase: "closing" as const, date: "2025-02-28", quantity: "40", source: [] }] };
    const attached = applyMonthlyHistoryEvidence([buy], [monthly]);
    expect(attached[0].source.statementPositions).toHaveLength(1);
    const [episode] = buildTradeEpisodes(attached);
    const before = createReplaySnapshot({ candles: [], executions: episode.executions, cursor: "2025-02-28T12:00:00Z" });
    expect(before.position.quantity).toBe("100");
    expect(before.position.accuracy).toBeUndefined();
    expect(JSON.stringify(before)).not.toContain('"quantity":"40"');
    const after = createReplaySnapshot({ candles: [], executions: episode.executions, cursor: "2025-02-28" });
    expect(after.position).toMatchObject({ quantity: "40", accuracy: { reasons: expect.arrayContaining(["position-gap"]) } });
    const corrected = applyMonthlyHistoryEvidence(attached, [{ ...monthly, positions: [] }]);
    expect(corrected[0].source.statementPositions).toBeUndefined();
  });
  it("caps closed episode evidence while retaining all snapshots on instrument-level executions", () => {
    const buy: TradeExecution = { id: "buy", accountId: "acct", accountLabel: "Test", instrument: { id: "US:LI", market: "US", symbol: "LI", name: "LI", currency: "USD" }, source: { platform: "tiger", row: 1 }, side: "buy", executedAt: "2025-01-10T14:30:00Z", quantity: "100", price: "30", fee: "0" };
    const sell: TradeExecution = { ...buy, id: "sell", side: "sell", executedAt: "2025-01-11T14:30:00Z" };
    const monthly = { ...result().monthly!, month: "2025-02", positions: [{ accountId: "acct", market: "US", symbol: "LI", phase: "opening" as const, date: "2025-02-01", quantity: "40", source: [] }] };
    const attached = applyMonthlyHistoryEvidence([buy, sell], [monthly]);
    const [closed] = buildTradeEpisodes(attached);
    expect(closed.status).toBe("closed");
    expect(createReplaySnapshot({ candles: [], executions: closed.executions, cursor: "2025-02-10" }).position.quantity).toBe("0");
    expect(createReplaySnapshot({ candles: [], executions: attached, cursor: "2025-02-10" }).position.quantity).toBe("40");
    const noTradeClose = { ...monthly, positions: [{ ...monthly.positions[0], phase: "closing" as const, date: "2025-02-28", quantity: "0" }] };
    const [closedBySnapshot] = buildTradeEpisodes(applyMonthlyHistoryEvidence([buy], [noTradeClose]));
    expect(closedBySnapshot).toMatchObject({ status: "closed", endedAt: "2025-02-28T23:59:59.999Z" });
    expect(createReplaySnapshot({ candles: [], executions: closedBySnapshot.executions, cursor: "2025-02-28" }).position.quantity).toBe("0");
  });
  it("propagates unresolved inventory to buys, scopes known symbols, and clears corrected document flags", () => {
    const buy: TradeExecution = { id: "buy", accountId: "acct", accountLabel: "Test", instrument: { id: "HK:00700", market: "HK", symbol: "00700", name: "Test", currency: "HKD" }, source: { platform: "futu", row: 1 }, side: "buy", executedAt: "2025-01-10T01:30:00Z", quantity: "2", price: "30", fee: "0" };
    const other = { ...buy, id: "other", instrument: { ...buy.instrument, id: "HK:02382", symbol: "02382" } };
    const layout = (name: string) => page([
      [[52, "期初概覽-股票和股票期權"]],
      [[54, "代碼名稱"], [300, "數量"], [400, "價格"]],
      [[54, name], [300, "N/A"], [400, "400"]],
    ]);
    const parsed = attachStatementEvidence([layout("00700(示例)")], { ...result(), records: [buy, other] });
    expect(parsed.records[0].source.historyIncomplete).toEqual(["fixture"]);
    expect(parsed.records[1].source.historyIncomplete).toBeUndefined();
    expect(buildTradeEpisodes(parsed.records)[0].accuracy?.reasons).toContain("history-incomplete");
    expect(replayPositionAtPrice({ executions: [parsed.records[0]], markPrice: "32" }).accuracy?.reasons).toContain("history-incomplete");
    const unknown = attachStatementEvidence([layout("UNRECOGNIZED_SECURITY")], { ...result(), records: [buy, other] });
    expect(unknown.records.every(r => r.source.historyIncomplete?.includes("fixture"))).toBe(true);
    const persisted = JSON.parse(JSON.stringify(parsed.monthly));
    expect(applyMonthlyHistoryEvidence([buy], [persisted])[0].source.historyIncomplete).toEqual(["fixture"]);
    expect(applyMonthlyHistoryEvidence([buy], [{ ...persisted, month: "2025-02" }])[0].source.historyIncomplete).toEqual(["fixture"]);
    expect(applyMonthlyHistoryEvidence(parsed.records, [result().monthly!])[0].source.historyIncomplete).toBeUndefined();
  });

  it("excludes unambiguous OCC options without marking stock history incomplete", () => {
    const parsed = attachStatementEvidence([page([
      [[52, "期初概覽-股票和股票期權"]],
      [[54, "代碼名稱"], [300, "數量"], [400, "價格"]],
      [[54, "AAPL250117C00100000"], [300, "2"], [400, "3.50"]],
    ])], result());
    expect(parsed.monthly?.positions).toEqual([]);
    expect(parsed.monthly?.historyIncomplete).toBeUndefined();
    expect(parsed.diagnostics).toEqual([]);
  });
  it("extracts stock inventory from Futu's combined stock/options headings", () => {
    const parsed = attachStatementEvidence([page([
      [[52, "期初概覽-股票和股票期權"]],
      [[54, "代碼名稱"], [333, "交易所/市場"], [421, "貨幣種類"], [524, "數量"], [603, "價格"], [681, "乘數"], [769, "市值"]],
      [[54, "00700(示例股份)"], [334, "SEHK"], [422, "HKD"], [526, "200"], [582, "401.2000"], [696, "-"], [744, "80,240.00"]],
    ])], result());
    expect(parsed.monthly?.positions[0]).toMatchObject({ phase: "opening", symbol: "00700", quantity: "200" });
    expect(parsed.monthly?.reviewRequired).toBe(false);
  });

  it("requires review for unresolved stock rows, including unsupported headers and option codes", () => {
    const parsed = attachStatementEvidence([page([
      [[52, "期初概覽-股票和股票期權"]],
      [[54, "代碼名稱"], [300, "數量"], [400, "價格"]],
      [[54, "00700(示例股份)"], [300, "N/A"], [400, "400"]],
      [[54, "UNRECOGNIZED_SECURITY"], [300, "2"], [400, "3.50"]],
      [[52, "期末總覽"]],
      [[54, "名稱代碼"], [300, "未知數量欄"], [400, "價格"]],
      [[54, "00700(示例股份)"], [300, "100"], [400, "400"]],
    ])], result());
    expect(parsed.monthly?.positions).toEqual([]);
    expect(parsed.monthly?.reviewRequired).toBe(true);
    expect(parsed.diagnostics.filter(d => d.code === "statement-position-row-unparsed").map(d => d.row)).toEqual([3, 4, 7]);
  });

  it("requires review when a stock transfer has unreadable date or quantity", () => {
    const parsed = attachStatementEvidence([page([
      [[33, "头寸转账"]],
      [[29, "产品"], [206, "代码"], [452, "日期"], [583, "方式"], [816, "转移数量"], [1001, "成本价"], [1139, "币种"]],
      [[29, "股票"], [218, "LI"], [333, "unknown"], [537, "外部转账 转入"], [856, "2"], [1003, "0"], [1146, "USD"]],
      [[29, "股票"], [218, "LI"], [333, "2025-01-08"], [537, "外部转账 转入"], [856, "N/A"], [1003, "0"], [1146, "USD"]],
    ])], result("tiger"));
    expect(parsed.monthly?.reviewRequired).toBe(true);
    expect(parsed.diagnostics.filter(d => d.code === "statement-transfer-row-unparsed")).toHaveLength(2);
  });
  it("ends holdings at valuation totals before grey-market trades and legal notes", () => {
    const parsed = attachStatementEvidence([page([
      [[34, "期初總覽"]],
      [[23, "股票"], [300, "持有數量"], [400, "昨收價"]],
      [[23, "01810 示例"], [300, "100"], [400, "14.82"]],
      [[432, "期初證券市值："], [535, "1482"]],
      [[34, "暗盤交易明細"]],
      [[23, "股票"], [300, "數量"], [400, "價格"]],
      [[23, "03347 示例"], [300, "100"], [400, "115.40"]],
      [[23, "本公司證實已支付印花稅"], [300, "117"], [400, "章"]],
    ])], result());
    expect(parsed.monthly?.positions.map(p => p.symbol)).toEqual(["01810"]);
    expect(parsed.diagnostics).toEqual([]);
  });
  it("replaces removed events and changed snapshots on executions from another document", () => {
    const execution: TradeExecution = { id: "sale", accountId: "acct", accountLabel: "Test", instrument: { id: "US:LI", market: "US", symbol: "LI", name: "LI", currency: "USD" }, source: { platform: "tiger", row: 1, fileFingerprint: "later-document" }, side: "sell", executedAt: "2025-04-02T14:30:00Z", quantity: "2", price: "30", fee: "0" };
    const original = result("tiger").monthly!;
    original.positions = [{ accountId: "acct", market: "US", symbol: "LI", phase: "opening", date: "2025-01-01", quantity: "2", source: [] }];
    original.events = [{ id: "transfer", accountId: "acct", market: "US", symbol: "LI", date: "2025-01-02", kind: "transfer-in", quantity: "2", description: "transfer", source: [] }];
    const unrelated = { ...original, documentId: "other-document", positions: [], events: [{ ...original.events[0], id: "other-transfer" }] };
    const attached = applyMonthlyHistoryEvidence([execution], [original, unrelated]);
    expect(attached[0].source.openingPosition).toMatchObject({ documentId: "fixture", quantity: "2" });
    expect(attached[0].source.positionEvents?.map(e => e.documentId)).toEqual(["fixture", "other-document"]);
    const replacement = { ...original, positions: [{ ...original.positions[0], quantity: "7" }], events: [] };
    const updated = applyMonthlyHistoryEvidence(attached, [replacement]);
    expect(updated[0].source.openingPosition).toMatchObject({ documentId: "fixture", quantity: "7" });
    expect(updated[0].source.positionEvents?.map(e => e.id)).toEqual(["other-transfer"]);
    expect(applyMonthlyHistoryEvidence(updated, [replacement])).toEqual(updated);
    expect(attached[0].source.openingPosition?.quantity).toBe("2");
    expect(original.positions[0]).not.toHaveProperty("documentId");
    const removed = applyMonthlyHistoryEvidence(updated, [{ ...replacement, positions: [] }, { ...unrelated, events: [] }]);
    expect(removed[0].source).not.toHaveProperty("openingPosition");
    expect(removed[0].source).not.toHaveProperty("positionEvents");
    const legacy = { ...execution, source: { ...execution.source, positionEvents: [{ ...original.events[0], id: "fixture:evidence:1:3" }] } };
    expect(applyMonthlyHistoryEvidence([legacy], [{ ...replacement, positions: [] }])[0].source).not.toHaveProperty("positionEvents");
  });

  it("replaces parser-owned evidence when parsing into a previous result", () => {
    const layout = (quantity: string) => page([
      [[34, "期初總覽"]],
      [[23, "名稱代碼"], [306, "數量"], [416, "價格"], [556, "市值"]],
      [[23, "06969 示例股份"], [301, quantity], [411, "8.680"], [535, "34,720.00"]],
    ]);
    const first = attachStatementEvidence([layout("4,000")], result());
    const changed = attachStatementEvidence([layout("2,000")], first);
    expect(changed.monthly?.positions).toHaveLength(1);
    expect(changed.monthly?.positions[0]).toMatchObject({ documentId: "fixture", quantity: "2000" });
    expect(isMonthlyStatement(JSON.parse(JSON.stringify(changed.monthly)))).toBe(true);
    expect(isMonthlyStatement({ ...changed.monthly, positions: [{ ...changed.monthly!.positions[0], documentId: 42 }] })).toBe(false);
    expect(attachStatementEvidence([], changed).monthly?.positions).toEqual([]);
  });
  it("reads Futu stock opening quantities without treating marks or totals as cost", () => {
    const parsed = attachStatementEvidence([page([
      [[34, "期初總覽"]],
      [[23, "名稱代碼"], [306, "數量"], [416, "價格"], [556, "市值"]],
      [[23, "06969 示例股份"], [301, "4,000"], [411, "8.680"], [535, "34,720.00"]],
      [[465, "期初證券市值："], [542, "34,720.00"]],
      [[34, "交易明細"]],
      [[23, "06969 示例股份"], [301, "2,000"], [411, "8.540"]],
    ])], result());
    expect(parsed.monthly?.positions).toEqual([{ documentId: "fixture", accountId: "acct", market: "HK", symbol: "06969", phase: "opening", date: "2025-01-01", quantity: "4000", source: [{ page: 1, row: 3, role: "opening-position" }] }]);
  });

  it("keeps Tiger funds out of stock closing snapshots and preserves reported cost", () => {
    const parsed = attachStatementEvidence([page([
      [[33, "期末持仓"]], [[34, "基金"]],
      [[29, "代码"], [225, "数量"], [385, "成本价格"], [489, "收盘价格"], [1139, "币种"]],
      [[29, "HK0000934320.USD"], [225, "100"], [385, "1.05"], [489, "1.06"], [1139, "USD"]],
      [[34, "股票"]],
      [[29, "代码"], [225, "数量"], [291, "乘数"], [385, "成本价格"], [489, "收盘价格"], [1139, "币种"]],
      [[29, "QID"], [232, "-10"], [298, "1.0"], [378, "38.33"], [492, "38.59"], [1146, "USD"]],
      [[29, "合计（基础币种）"], [232, "-10"], [489, "385.90"]],
    ])], result("tiger"));
    expect(parsed.monthly?.positions).toHaveLength(1);
    expect(parsed.monthly?.positions[0]).toMatchObject({ symbol: "QID", quantity: "-10", cost: "38.33", phase: "closing", date: "2025-01-31" });
  });

  it("extracts a Tiger transfer independently of trade rows and zero cost", () => {
    const parsed = attachStatementEvidence([page([
      [[33, "头寸转账"]],
      [[29, "产品"], [206, "代码"], [452, "日期"], [583, "方式"], [650, "转出方"], [732, "转入方"], [816, "转移数量"], [912, "费用数量"], [1001, "成本价"], [1078, "市值"], [1139, "币种"]],
      [[29, "股票"], [218, "LI"], [333, "2025-01-08, 11:31:04, GMT+8"], [537, "外部转账 转入"], [729, "12345"], [856, "2"], [951, "0"], [1003, "0.0000"], [1075, "62.58"], [1146, "USD"]],
      [[192, "合计 LI"], [856, "2"], [951, "0"], [1075, "62.58"]],
    ])], result("tiger"));
    expect(parsed.monthly?.events).toHaveLength(1);
    expect(parsed.monthly?.events[0]).toMatchObject({ documentId: "fixture", symbol: "LI", market: "US", kind: "transfer-in", quantity: "2", date: "2025-01-08T03:31:04.000Z" });
    expect(isMonthlyStatement({ ...parsed.monthly, events: [{ ...parsed.monthly!.events[0], documentId: 42 }] })).toBe(false);
    expect(parsed.records).toEqual([]);
  });

  it("retains Futu IPO and distribution cash evidence without turning share remarks into quantity", () => {
    const parsed = attachStatementEvidence([page([
      [[59, "資金進出"]],
      [[54, "日期"], [122, "方向"], [210, "類型"], [341, "貨幣種類"], [496, "金額"], [525, "備註"]],
      [[54, "2025/01/18"], [122, "減少"], [210, "港股IPO公開發售"], [341, "HKD"], [471, "-68,271.65"], [525, "Dr. - IPO Application Amount - #02050"]],
      [[54, "2025/01/27"], [122, "增加"], [210, "公司行動"], [341, "HKD"], [480, "+425.60"], [525, "24 F/D-HKD0.532/SH <SEHK 2382 EXAMPLE> 800 shares"]],
      [[54, "2025/01/27"], [122, "減少"], [210, "公司行動"], [341, "HKD"], [488, "-12.00"], [525, "Scrip Charge 800 shares <SEHK 2382 EXAMPLE>"]],
      [[54, "2025/01/28"], [122, "增加"], [210, "基金贖回"], [341, "HKD"], [480, "+425.60"], [525, "Fund Redemption"]],
      [[59, "重要通知"]], [[54, "2025/01/29 公司行動 F/D <SEHK 2382 EXAMPLE>"]],
    ])], result());
    expect(parsed.monthly?.events.map(e => [e.kind, e.symbol, e.amount, e.quantity])).toEqual([
      ["ipo", "02050", "-68271.65", undefined], ["distribution", "02382", "425.60", undefined], ["fee", "02382", "-12.00", undefined],
    ]);
  });

  it("uses Tiger parenthesized codes over English company names in IPO results", () => {
    const p = page([
      [[33, "IPO结果"]],
      [[29, "代码"], [307, "中签数量(股)"], [417, "币种"], [498, "中签金额"]],
      [[29, "VESYNC (02148)"], [350, "1000"], [424, "HKD"], [517, "5000.00"]],
    ]);
    expect(attachStatementEvidence([p], result("tiger")).monthly?.events[0]).toMatchObject({ symbol: "02148", market: "HK", kind: "ipo", quantity: "1000", date: "2025-01" });
  });

  it("keeps stock allotment quantities as auxiliary IPO evidence", () => {
    const p = page([
      [[59, "資產進出"]],
      [[54, "日期"], [122, "方向"], [210, "類型"], [290, "代碼名稱"], [410, "貨幣種類"], [480, "數量"], [560, "金額"], [620, "備註"]],
      [[52, "股票和股票期權"]],
      [[54, "2025/01/19"], [122, "增加"], [210, "港股IPO公開發售"], [290, "2050(示例)"], [410, "HKD"], [480, "+500"], [560, "+11265"], [620, "IPO Allotment Qty - #02050"]],
    ]);
    expect(attachStatementEvidence([p], result()).monthly?.events[0]).toMatchObject({ symbol: "02050", kind: "ipo", quantity: "500" });
  });

  it("attaches an earlier no-trade month's closing boundary across missing months, scoped by account", () => {
    const execution = { id: "sale", accountId: "acct", accountLabel: "Test", instrument: { id: "US:LI", market: "US", symbol: "LI", name: "LI", currency: "USD" }, source: { platform: "tiger", row: 1 }, side: "sell" as const, executedAt: "2025-04-02T14:30:00Z", quantity: "2", price: "30", fee: "0" };
    const monthly = result("tiger").monthly!;
    monthly.positions = [
      { accountId: "acct", market: "US", symbol: "LI", phase: "closing", date: "2025-01-31", quantity: "2", source: [] },
      { accountId: "other", market: "US", symbol: "LI", phase: "opening", date: "2025-04-01", quantity: "99", source: [] },
      { accountId: "acct", market: "US", symbol: "LI", phase: "closing", date: "2025-04-30", quantity: "0", source: [] },
    ];
    const [attached] = applyMonthlyHistoryEvidence([execution], [monthly]);
    expect(attached.source.openingPosition).toMatchObject({ phase: "closing", date: "2025-01-31", quantity: "2" });
    expect(execution.source).not.toHaveProperty("openingPosition");
    expect(applyMonthlyHistoryEvidence([attached], [monthly])).toEqual([attached]);
  });
});
