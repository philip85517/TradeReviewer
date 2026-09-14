import { describe, expect, it } from "vitest";
import { applyMonthlyHistoryEvidence, attachStatementEvidence, isExecutionBackedIpoAllocation, replayExecutionAt } from "./statement-evidence";
import type { StatementParseResult } from "./contracts";
import type { PdfTextPage } from "./pdf-text";
import type { TradeExecution } from "../trades/types";
import type { StatementEvent } from "./monthly-statement";
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
  function legacyCashPage(rows: [number, string][][], pageNumber = 1): PdfTextPage {
    const base = page(rows);
    return { ...base, pageNumber, items: base.items.map((item) => ({ ...item, y: item.y + 20 })) };
  }

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

  it("retains only scoped unassigned IPO fees as context without assigning a stock", () => {
    const execution: TradeExecution = { id: "live", accountId: "acct", accountLabel: "Test", instrument: { id: "HK:01810", market: "HK", symbol: "01810", name: "Test", currency: "HKD" }, source: { platform: "futu", row: 1 }, side: "sell", executedAt: "2025-01-10T14:30:00Z", quantity: "2", price: "30", fee: "0" };
    const ipoFee: StatementEvent = { id: "ipo-fee", accountId: "acct", market: "HK", date: "2025-01-02", kind: "fee", amount: "-100", currency: "HKD", description: "IPO Application Handling Fee", source: [] };
    const ordinaryInterest: StatementEvent = { id: "interest", accountId: "acct", market: "HK", date: "2025-01-03", kind: "fee", amount: "-2", currency: "HKD", description: "Interest for Month", source: [] };
    const attached = applyMonthlyHistoryEvidence([execution], [{ ...result().monthly!, events: [ipoFee, ordinaryInterest] }]);
    expect(attached[0].source.positionEvents).toHaveLength(1);
    expect(attached[0].source.positionEvents?.[0]).toMatchObject({ id: "ipo-fee", currency: "HKD" });
    expect(attached[0].source.positionEvents?.[0].symbol).toBeUndefined();
  });

  it("does not leak unassigned IPO fees across account, market, currency, or simulation scope", () => {
    const live: TradeExecution = { id: "live", accountId: "acct", accountLabel: "Test", instrument: { id: "HK:01810", market: "HK", symbol: "01810", name: "Test", currency: "HKD" }, source: { platform: "futu", row: 1 }, side: "sell", executedAt: "2025-01-10T14:30:00Z", quantity: "2", price: "30", fee: "0" };
    const simulation: TradeExecution = { ...live, id: "simulation", source: { ...live.source, tradeNature: "simulation" } };
    const events: StatementEvent[] = [
      { id: "in-scope", accountId: "acct", market: "HK", date: "2025-01-02", kind: "fee", amount: "-100", currency: "HKD", description: "IPO Application Handling Fee", source: [] },
      { id: "other-account", accountId: "other", market: "HK", date: "2025-01-02", kind: "fee", amount: "-101", currency: "HKD", description: "IPO Application Handling Fee", source: [] },
      { id: "wrong-market", accountId: "acct", market: "US", date: "2025-01-02", kind: "fee", amount: "-102", currency: "HKD", description: "IPO Application Handling Fee", source: [] },
      { id: "wrong-currency", accountId: "acct", market: "HK", date: "2025-01-02", kind: "fee", amount: "-103", currency: "USD", description: "IPO Application Handling Fee", source: [] },
    ];
    const monthly = { ...result().monthly!, events };
    const attached = applyMonthlyHistoryEvidence([live, simulation], [monthly]);
    expect(attached[0].source.positionEvents?.map(event => event.id)).toEqual(["in-scope"]);
    expect(attached[1].source.positionEvents).toBeUndefined();
  });

  it("keeps unassigned IPO fee attachment idempotent when evidence is reapplied", () => {
    const execution: TradeExecution = { id: "live", accountId: "acct", accountLabel: "Test", instrument: { id: "HK:01810", market: "HK", symbol: "01810", name: "Test", currency: "HKD" }, source: { platform: "futu", row: 1 }, side: "sell", executedAt: "2025-01-10T14:30:00Z", quantity: "2", price: "30", fee: "0" };
    const fee: StatementEvent = { id: "ipo-fee", accountId: "acct", date: "2025-01-02", kind: "fee", amount: "-100", currency: "HKD", description: "申購手續費", source: [] };
    const monthly = { ...result().monthly!, events: [fee] };
    const once = applyMonthlyHistoryEvidence([execution], [monthly]);
    expect(applyMonthlyHistoryEvidence(once, [monthly])).toEqual(once);
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
    expect(parsed.monthly?.events.map(e => [e.kind, e.symbol, e.amount, e.quantity, e.displayTimePolicy])).toEqual([
      ["ipo", "02050", "-68271.65", undefined, undefined], ["distribution", "02382", "425.60", undefined, undefined], ["fee", "02382", "-12.00", undefined, undefined],
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
    expect(attachStatementEvidence([p], result()).monthly?.events[0]).toMatchObject({ symbol: "02050", kind: "ipo", quantity: "500", displayTimePolicy: "session-open" });
  });

  it("extracts legacy Futu stock-in as a dated IPO inventory event with source evidence", () => {
    // Evidence: /Users/zhoulin/Documents/交易/富途/港股/2018-07.pdf, p.1,
    // 股票進出 01810 小米集團-W / 存入股票 2018/07/06 +1,800 / Dep - IPO Allotment.
    const parsed = attachStatementEvidence([legacyCashPage([
      [[20, "港股保證金賬戶月結單(2018年07月)"]],
      [[20, "股票進出"]],
      [[20, "類型"], [120, "日期"], [220, "股票"], [360, "變動數量"], [470, "單號"], [570, "備註"]],
      [[20, "01810 小米集團-"]],
      [[20, "存入股票"], [120, "2018/07/06"], [360, "+1,800"], [470, "4726968"], [570, "Dep - IPO Allotment"]],
      [[20, "W"]],
    ])], result());
    expect(parsed.monthly?.events).toEqual([expect.objectContaining({
      kind: "ipo", date: "2018-07-06", symbol: "01810", market: "HK", quantity: "1800",
      description: expect.stringContaining("IPO Allotment"),
      source: [{ page: 1, row: 5, role: "stock" }],
    })]);
  });

  it("extracts legacy stock withdrawals as transfer-out inventory events", () => {
    const parsed = attachStatementEvidence([legacyCashPage([
      [[20, "港股保證金賬戶月結單(2020年12月)"]],
      [[20, "股票進出"]],
      [[20, "類型"], [120, "日期"], [220, "股票"], [360, "變動數量"], [470, "單號"], [570, "備註"]],
      [[20, "提取股票"], [120, "2020/12/29"], [220, "02127 匯森家居"], [360, "50"], [470, "7800000"], [570, "外部轉出"]],
    ])], result());
    expect(parsed.monthly?.events[0]).toMatchObject({ kind: "transfer-out", date: "2020-12-29", symbol: "02127", quantity: "50", source: [{ page: 1, row: 4, role: "stock" }] });
  });

  it("requires review instead of silently dropping an unparseable legacy stock row", () => {
    const parsed = attachStatementEvidence([legacyCashPage([
      [[20, "港股保證金賬戶月結單(2020年12月)"]],
      [[20, "股票進出"]],
      [[20, "類型"], [120, "日期"], [220, "股票"], [360, "變動數量"], [470, "單號"], [570, "備註"]],
      [[20, "存入股票"], [220, "06618 京東健康"], [360, "50"], [470, "7583332"], [570, "IPO Allotment Qty - #06618"]],
      [[20, "提取股票"], [120, "2020/12/29"], [220, "02127 匯森家居"], [470, "7800000"], [570, "外部轉出"]],
    ])], result());
    expect(parsed.monthly?.events).toEqual([]);
    expect(parsed.monthly?.reviewRequired).toBe(true);
    expect(parsed.diagnostics.filter((diagnostic) => diagnostic.code === "statement-stock-row-unparsed").map((diagnostic) => diagnostic.instrumentSymbol)).toEqual(["06618", "02127"]);
  });

  it("does not borrow the previous movement's stock code for an adjacent row missing its own code", () => {
    const parsed = attachStatementEvidence([legacyCashPage([
      [[20, "港股保證金賬戶月結單(2020年12月)"]],
      [[20, "股票進出"]],
      [[20, "類型"], [120, "日期"], [220, "股票"], [360, "變動數量"], [470, "單號"], [570, "備註"]],
      [[20, "存入股票"], [120, "2020/12/07"], [220, "06618 京東健康"], [360, "50"], [470, "7583332"], [570, "IPO Allotment Qty - #06618"]],
      [[20, "存入股票"], [120, "2020/12/08"], [360, "20"], [470, "7583333"], [570, "IPO Allotment"]],
    ])], result());
    expect(parsed.monthly?.events).toHaveLength(1);
    expect(parsed.monthly?.events[0]).toMatchObject({ symbol: "06618", quantity: "50" });
    expect(parsed.diagnostics.filter((diagnostic) => diagnostic.code === "statement-stock-row-unparsed")).toHaveLength(1);
    expect(parsed.diagnostics.find((diagnostic) => diagnostic.code === "statement-stock-row-unparsed")?.instrumentSymbol).toBeUndefined();
    expect(parsed.monthly?.historyIncomplete).toBe(true);
  });

  it("does not turn negative or cancelled IPO stock rows into positive IPO inventory", () => {
    const parsed = attachStatementEvidence([legacyCashPage([
      [[20, "港股保證金賬戶月結單(2020年12月)"]],
      [[20, "股票進出"]],
      [[20, "類型"], [120, "日期"], [220, "股票"], [360, "變動數量"], [470, "單號"], [570, "備註"]],
      [[20, "存入股票"], [120, "2020/12/29"], [220, "02127 匯森家居"], [360, "-50"], [470, "7800000"], [570, "IPO Allotment Qty - #02127"]],
      [[20, "存入股票"], [120, "2020/12/29"], [220, "06618 京東健康"], [360, "50"], [470, "7800001"], [570, "IPO Allotment Qty - #06618 Cancel"]],
    ])], result());
    expect(parsed.monthly?.events.map((event) => ({ kind: event.kind, quantity: event.quantity, symbol: event.symbol, source: event.source }))).toEqual([
      { kind: "transfer-out", quantity: "-50", symbol: "02127", source: [{ page: 1, row: 4, role: "stock" }] },
      { kind: "transfer-out", quantity: "50", symbol: "06618", source: [{ page: 1, row: 5, role: "stock" }] },
    ]);
    expect(parsed.monthly?.events.every((event) => event.kind !== "ipo")).toBe(true);
  });

  it("retains valid legacy cash deposits and withdrawals while classifying IPO rows", () => {
    // Evidence: /Users/zhoulin/Documents/交易/富途/港股/2018-06.pdf, p.2,
    // 資金進出 rows 2018/06/05 through 2018/06/27.
    const parsed = attachStatementEvidence([legacyCashPage([
      [[20, "港股保證金賬戶月結單(2018年06月)"]],
      [[20, "賬戶幣種"], [120, "港幣"]],
      [[20, "資金進出"]],
      [[20, "類型"], [120, "日期"], [260, "金額"], [390, "單號"], [520, "備註"]],
      [[20, "存入現金"], [120, "2018/06/05"], [260, "+16,550.00"], [390, "2258738"]],
      [[20, "存入現金"], [120, "2018/06/08"], [260, "+61,100.00"], [390, "2290768"]],
      [[20, "提取現金"], [120, "2018/06/11"], [260, "-6,000.00"], [390, "2302444"]],
      [[20, "提取現金"], [120, "2018/06/27"], [260, "-73,894.00"], [390, "2444317"], [520, "Dr. - IPO FINANCING App #01810 XIAOMI CORPORATION, 30,000 Shares"]],
      [[20, "提取現金"], [120, "2018/06/27"], [260, "-100.00"], [390, "2444318"], [520, "Dr. IPO FINANCING App Handling Fee #01810 XIAOMI CORPORATION"]],
    ])], result());
    expect(parsed.monthly?.events.map((event) => ({ kind: event.kind, amount: event.amount, symbol: event.symbol }))).toEqual([
      { kind: "other", amount: "16550.00", symbol: undefined },
      { kind: "other", amount: "61100.00", symbol: undefined },
      { kind: "other", amount: "-6000.00", symbol: undefined },
      { kind: "ipo", amount: "-73894.00", symbol: "01810" },
      { kind: "fee", amount: "-100.00", symbol: "01810" },
    ]);
    expect(parsed.monthly?.events.every((event) => event.currency === "HKD")).toBe(true);
  });

  it("prefers a cash row currency and clears it across a stock section", () => {
    const parsed = attachStatementEvidence([legacyCashPage([
      [[20, "富途綜合賬戶月結單(2025年06月)"]],
      [[20, "賬戶幣種"], [120, "港幣"]],
      [[20, "資金進出"]],
      [[20, "日期"], [120, "金額"], [220, "貨幣種類"], [320, "備註"]],
      [[20, "2025/06/01"], [120, "+10.00"], [220, "USD"], [320, "存入現金"]],
      [[20, "2025/06/02"], [120, "+20.00"], [320, "存入現金"]],
      [[20, "股票進出"]],
      [[20, "類型"], [120, "日期"], [220, "股票"], [360, "變動數量"], [470, "單號"], [570, "備註"]],
      [[20, "存入股票"], [120, "2025/06/03"], [220, "01810 小米"], [360, "10"], [470, "1"], [570, "外部轉入"]],
      [[20, "資金進出"]],
      [[20, "日期"], [120, "金額"], [220, "貨幣種類"], [320, "備註"]],
      [[20, "2025/06/04"], [120, "+30.00"], [320, "存入現金"]],
    ])], result());
    expect(parsed.monthly?.events.filter((event) => event.kind === "other").map((event) => event.currency)).toEqual(["USD", "HKD", "HKD"]);
    expect(parsed.monthly?.events.find((event) => event.kind === "transfer-in")?.currency).toBeUndefined();
  });

  it("does not infer a cash currency from a Hong Kong stock symbol", () => {
    const parsed = attachStatementEvidence([legacyCashPage([
      [[20, "富途綜合賬戶月結單(2025年06月)"]],
      [[20, "資金進出"]],
      [[20, "日期"], [120, "金額"], [220, "備註"]],
      [[20, "2025/06/01"], [120, "+10.00"], [220, "IPO Application Amount - #01810"]],
    ])], result());
    expect(parsed.monthly?.events[0]).toMatchObject({ symbol: "01810", kind: "ipo", amount: "10.00" });
    expect(parsed.monthly?.events[0].currency).toBeUndefined();
  });

  it("extracts old 2020 IPO cash and stock-in evidence without changing signs", () => {
    // Evidence: /Users/zhoulin/Documents/交易/富途/港股/2020-07.pdf, p.1-2,
    // 思摩尔 06969; /2020-12.pdf, p.1-2, 京东健康 06618 and 汇森 02127.
    const parsed = attachStatementEvidence([
      legacyCashPage([
        [[20, "港股保證金賬戶月結單（2020年07月）"]],
        [[20, "資金進出"]],
        [[20, "類型"], [120, "日期"], [260, "金額"], [390, "單號"], [520, "備註"]],
        [[20, "提取現金"], [120, "2020/07/02"], [260, "-50,099.82"], [390, "12327358"], [520, "Dr. - IPO Application Amount - #06969"]],
        [[20, "提取現金"], [120, "2020/07/02"], [260, "-100.00"], [390, "12327359"], [520, "Dr. - IPO Application Handling Fee - #06969"]],
        [[20, "提取現金"], [120, "2020/07/09"], [260, "-295.00"], [390, "12897794"], [520, "Dr. - IPO Financing Interest - #06969"]],
        [[20, "存入現金"], [120, "2020/07/09"], [260, "+37,574.87"], [390, "12897795"], [520, "Cr. - IPO Refund Amount - #06969"]],
        [[20, "股票進出"]],
        [[20, "類型"], [120, "日期"], [220, "股票"], [360, "變動數量"], [470, "單號"], [570, "備註"]],
        [[20, "06969 思摩爾國"]],
        [[20, "存入股票"], [120, "2020/07/09"], [360, "+1,000"], [470, "6282569"], [570, "IPO Allotment Qty - #06969"]],
        [[20, "際"]],
      ]),
      legacyCashPage([
        [[20, "港股保證金賬戶月結單（2020年12月）"]],
        [[20, "資金進出"]],
        [[20, "類型"], [120, "日期"], [260, "金額"], [390, "單號"], [520, "備註"]],
        [[20, "提取現金"], [120, "2020/12/01"], [260, "-7,129.12"], [390, "20907429"], [520, "Dr. - IPO Application Amount - #06618"]],
        [[20, "提取現金"], [120, "2020/12/01"], [260, "-50.00"], [390, "20907430"], [520, "Dr. - IPO Application Handling Fee - #06618"]],
        [[20, "存入現金"], [120, "2020/12/07"], [260, "+3,564.55"], [390, "21389642"], [520, "Cr. - IPO Refund Amount - #06618"]],
        [[20, "提取現金"], [120, "2020/12/18"], [260, "-37,574.86"], [390, "22873578"], [520, "Dr. - IPO Application Amount - #02127"]],
        [[20, "存入現金"], [120, "2020/12/28"], [260, "+33,999.18"], [390, "23387178"], [520, "Cr. - IPO Refund Amount - #02127"]],
        [[20, "股票進出"]],
        [[20, "類型"], [120, "日期"], [220, "股票"], [360, "變動數量"], [470, "單號"], [570, "備註"]],
        [[20, "存入股票"], [120, "2020/12/07"], [220, "06618 京東健康"], [360, "+50"], [470, "7583332"], [570, "IPO Allotment Qty - #06618"]],
        [[20, "存入股票"], [120, "2020/12/28"], [220, "02127 匯森家居"], [360, "+2,000"], [470, "7795037"], [570, "IPO Allotment Qty - #02127"]],
      ], 2),
    ], { ...result(), monthly: { ...result().monthly!, month: "2020-07" } });
    expect(parsed.monthly?.events.filter((event) => event.symbol === "06969").map((event) => [event.kind, event.amount, event.quantity])).toEqual([
      ["ipo", "-50099.82", undefined], ["fee", "-100.00", undefined], ["fee", "-295.00", undefined], ["ipo", "37574.87", undefined], ["ipo", undefined, "1000"],
    ]);
    expect(parsed.monthly?.events.filter((event) => event.symbol === "06618").map((event) => [event.kind, event.amount, event.quantity])).toEqual([
      ["ipo", "-7129.12", undefined], ["fee", "-50.00", undefined], ["ipo", "3564.55", undefined], ["ipo", undefined, "50"],
    ]);
    expect(parsed.monthly?.events.filter((event) => event.symbol === "02127").map((event) => [event.kind, event.amount, event.quantity])).toEqual([
      ["ipo", "-37574.86", undefined], ["ipo", "33999.18", undefined], ["ipo", undefined, "2000"],
    ]);
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


describe("persisted date-only simulation knowledge", () => {
  const simulation: TradeExecution = {
    id: "persisted-simulation", accountId: "simulation-run", accountLabel: "Simulation",
    instrument: { id: "CN-SH:600000", market: "CN-SH", symbol: "600000", name: "Test", currency: "CNY" },
    source: { platform: "tradingview", row: 1, tradeNature: "simulation", simulationRunId: "run", timePrecision: "date-only", sourceTimezone: "Asia/Shanghai" },
    side: "buy", executedAt: "2025-01-02T16:00:00.000Z", quantity: "100", price: "10", fee: "0",
  };
  it("does not reveal a Shanghai midnight fill on the previous UTC calendar day", () => {
    expect(replayExecutionAt(simulation)).toBe("2025-01-03T23:59:59.999Z");
    const before = createReplaySnapshot({ candles: [], executions: [simulation], cursor: "2025-01-02" });
    expect(before.executions).toEqual([]);
    expect(before.position.quantity).toBe("0");
    const after = createReplaySnapshot({ candles: [], executions: [simulation], cursor: "2025-01-03" });
    expect(after.executions).toHaveLength(1);
    expect(after.position.quantity).toBe("100");
  });
  it("preserves explicit date evidence and second-precision instants", () => {
    expect(replayExecutionAt({ ...simulation, source: { ...simulation.source, marketCalendarDate: "2025-01-04" } })).toBe("2025-01-04T23:59:59.999Z");
    expect(replayExecutionAt({ ...simulation, source: { ...simulation.source, sourceTimezone: undefined, sourceTimestampText: "2025-01-03" } })).toBe("2025-01-03T23:59:59.999Z");
    expect(replayExecutionAt({ ...simulation, source: { ...simulation.source, timePrecision: "second" } })).toBe(simulation.executedAt);
    expect(replayExecutionAt({ ...simulation, executedAt: "2025-01-03" })).toBe("2025-01-03T23:59:59.999Z");
  });
});

describe("verified date-only IPO replay timing", () => {
  const ipoAllocation: TradeExecution = {
    id: "verified-ipo-allocation",
    accountId: "acct",
    accountLabel: "Test",
    instrument: { id: "HK:02101", market: "HK", symbol: "02101", name: "Test", currency: "HKD" },
    source: {
      platform: "futu",
      row: 1,
      timePrecision: "date-only",
      tradingDate: "2025-01-21",
      displayTimePolicy: "session-open",
      positionEffect: "open-long",
    },
    side: "buy",
    executedAt: "2025-01-21",
    quantity: "500",
    price: "22.53",
    fee: "0",
  };

  it("replays a verified date-only IPO allocation at UTC midnight", () => {
    expect(replayExecutionAt(ipoAllocation)).toBe("2025-01-21T00:00:00.000Z");
  });

  it("orders a same-day date-only sale after the verified allocation", () => {
    const sale = { ...ipoAllocation, id: "same-day-sale", side: "sell" as const, source: { ...ipoAllocation.source, positionEffect: undefined }, quantity: "500" };
    const snapshot = createReplaySnapshot({ candles: [], executions: [sale, ipoAllocation], cursor: "2025-01-21" });
    expect(snapshot.executions.map((execution) => execution.id)).toEqual(["verified-ipo-allocation", "same-day-sale"]);
    expect(snapshot.position.quantity).toBe("0");
  });

  it("keeps unknown date-only fills at end of day", () => {
    expect(replayExecutionAt({ ...ipoAllocation, source: { ...ipoAllocation.source, displayTimePolicy: undefined, positionEffect: undefined } })).toBe("2025-01-21T23:59:59.999Z");
    expect(replayExecutionAt({ ...ipoAllocation, source: { ...ipoAllocation.source, positionEffect: undefined } })).toBe("2025-01-21T23:59:59.999Z");
    expect(replayExecutionAt({ ...ipoAllocation, source: { ...ipoAllocation.source, displayTimePolicy: undefined } })).toBe("2025-01-21T23:59:59.999Z");
  });

  it("keeps precise second timestamps unchanged", () => {
    const precise = { ...ipoAllocation, executedAt: "2025-01-21T01:23:45.000Z", source: { ...ipoAllocation.source, timePrecision: "second" as const } };
    expect(replayExecutionAt(precise)).toBe("2025-01-21T01:23:45.000Z");
  });
});

describe("verified IPO allocation duplicate matching", () => {
  type ExecutionOverrides = Partial<Omit<TradeExecution, "source">> & { source?: Partial<TradeExecution["source"]> };
  const execution = (overrides: ExecutionOverrides = {}): TradeExecution => {
    const { source: sourceOverrides, ...rest } = overrides;
    return {
    id: "verified-ipo",
    accountId: "acct",
    accountLabel: "Test",
    instrument: { id: "HK:6049", market: "HK", symbol: "6049", name: "Test", currency: "HKD" },
    side: "buy",
    executedAt: "2019-12-18",
    quantity: "200",
    price: "35.4537",
    fee: "50",
    ...rest,
    source: {
      platform: "futu",
      row: 18,
      page: 1,
      fileFingerprint: "doc-fp",
      tradingDate: "2019-12-18",
      positionEffect: "open-long",
      displayTimePolicy: "session-open",
      sourceTradeId: "5653048",
      grossAmount: "7090.74",
      ...(sourceOverrides ?? {}),
    },
    };
  };

  it("matches the six verified IPO buys when the old stock event has no amount", () => {
    const verified = [
      ["6049", "200", "2019-12-18", "5653048"],
      ["9997", "500", "2020-06-26", "6194791"],
      ["3347", "100", "2020-08-06", "6489610"],
      ["2101", "500", "2020-09-17", "6658877"],
      ["6996", "500", "2020-11-19", "7515686"],
      ["9960", "1000", "2021-07-15", "8750962"],
    ] as const;
    expect(verified.map(([symbol, quantity, date, order]) => isExecutionBackedIpoAllocation(
      {
        id: `stock-${symbol}`,
        accountId: "acct",
        market: "HK",
        symbol,
        date,
        kind: "ipo",
        quantity,
        description: `IPO Allotment ${order}`,
        source: [],
      },
      [execution({ instrument: { id: `HK:${symbol}`, market: "HK", symbol, name: "Test", currency: "HKD" }, quantity, executedAt: date, source: { tradingDate: date, sourceTradeId: order } })],
    ))).toEqual([true, true, true, true, true, true]);
  });

  it("does not treat a same-day ordinary buy as a backed IPO without verified provenance", () => {
    const ordinaryBuy = execution({ source: { positionEffect: undefined, displayTimePolicy: undefined, sourceTradeId: undefined } });
    const event = { id: "stock-6049", accountId: "acct", market: "HK", symbol: "6049", date: "2019-12-18", kind: "ipo" as const, quantity: "200", description: "IPO Allotment", source: [] };
    expect(isExecutionBackedIpoAllocation(event, [ordinaryBuy])).toBe(false);
    expect(isExecutionBackedIpoAllocation({ ...event, description: "IPO Allotment 15653048" }, [execution()])).toBe(false);
  });

  it("uses trusted document/page/row provenance when the description has no order number", () => {
    const event = { id: "stock-6049", documentId: "doc-fp", accountId: "acct", market: "HK", symbol: "6049", date: "2019-12-18", kind: "ipo" as const, quantity: "200", description: "IPO Allotment", source: [{ page: 2, row: 7, role: "stock" }] };
    const backed = execution({ source: { page: 9, row: 4, fragments: [{ page: 2, row: 7, role: "order" }], sourceTradeId: undefined } });
    expect(isExecutionBackedIpoAllocation(event, [backed])).toBe(true);
    expect(isExecutionBackedIpoAllocation({ ...event, documentId: "other-doc" }, [backed])).toBe(false);
  });

  it("keeps the amount path based on stock amount, independent of fee-inclusive effective price", () => {
    const event = { id: "stock-6049", accountId: "acct", market: "HK", symbol: "6049", date: "2019-12", kind: "ipo" as const, quantity: "200", amount: "7090.74", description: "IPO Allotment", source: [] };
    expect(isExecutionBackedIpoAllocation(event, [execution({ price: "35.7037" })])).toBe(true);
  });
});
