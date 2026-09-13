import type { StatementParseResult } from "./contracts";
import type { MonthlyStatement, StatementEvent, StatementPosition } from "./monthly-statement";
import type { PdfTextItem, PdfTextPage } from "./pdf-text";
import type { TradeExecution } from "../trades/types";
import Decimal from "decimal.js";
import { canonicalInstrumentId } from "../instruments/display-name";

type Row = { y: number; items: PdfTextItem[]; number: number; text: string };
const compact = (text: string) => text.replace(/\s+/g, "");
const numberText = (text: string) => /^[+-]?(?:\d[\d,]*)(?:\.\d+)?$/.test(text.trim()) ? text.trim().replace(/,/g, "").replace(/^\+/, "") : undefined;
const stockMovementPattern = /^(?:存入股票|存入证券|提取股票|提取证券|轉入股票|转入股票|轉出股票|转出股票)/;
const stockHeaderPattern = /^(?:類型|类型|日期|股票|變動數量|变动数量|單號|单号|備註|备注)$/;

function currencyCode(text: string): string | undefined {
  const value = compact(text).toUpperCase();
  if (value === "HKD" || value === "港幣" || value === "港币") return "HKD";
  if (value === "USD" || value === "美元") return "USD";
  if (value === "CNH") return "CNH";
  if (value === "CNY" || value === "人民幣" || value === "人民币") return "CNY";
  if (value === "JPY" || value === "日圓" || value === "日元") return "JPY";
  if (value === "SGD" || value === "新加坡元") return "SGD";
  if (value === "GBP" || value === "英鎊" || value === "英镑") return "GBP";
  if (value === "EUR" || value === "歐元" || value === "欧元") return "EUR";
  return undefined;
}

function rowCurrency(row: Row): string | undefined {
  return row.items.map(item => currencyCode(item.text)).find(Boolean);
}

function accountCurrencyIn(row: Row): string | undefined {
  const labelIndex = row.items.findIndex(item => /^(?:賬戶幣種|账户币种)$/.test(compact(item.text)));
  if (labelIndex < 0) return undefined;
  return row.items.slice(labelIndex + 1).map(item => currencyCode(item.text)).find(Boolean) ?? rowCurrency(row);
}

function rowsOf(page: PdfTextPage): Row[] {
  const rows: Row[] = [];
  for (const item of [...page.items].filter(i => i.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = rows.at(-1);
    if (!row || Math.abs(row.y - item.y) > 3) {
      row = { y: item.y, items: [], number: rows.length + 1, text: "" };
      rows.push(row);
    }
    // Overprinted bold headers are one visual cell, not additional evidence.
    if (!row.items.some(i => i.text === item.text && Math.abs(i.x - item.x) < 2)) row.items.push(item);
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    row.text = row.items.map(i => i.text).join(" ");
  }
  return rows;
}

function numericCell(row: Row, headers: PdfTextItem[], label: RegExp): string | undefined {
  const target = headers.find(h => label.test(compact(h.text)));
  if (!target) return undefined;
  const center = (i: PdfTextItem) => i.x + i.width / 2;
  const values = row.items.filter(i => numberText(i.text) !== undefined &&
    [...headers].sort((a, b) => Math.abs(center(a) - center(i)) - Math.abs(center(b) - center(i)))[0] === target);
  return values.length === 1 ? numberText(values[0].text) : undefined;
}

function identity(text: string): { market: string; symbol: string } | undefined {
  if (/^[A-Z]{2}\d{8,}|基金|期[权權]|option|fund/i.test(text)) return undefined;
  const hk = text.match(/(?:SEHK\s+|#|\bHK:)(\d{1,5})\b/);
  const symbol = hk?.[1] ?? text.match(/[（(](\d{5}|[A-Z][A-Z0-9]{0,5}(?:\.[A-Z])?)[）)]/)?.[1] ?? text.match(/^\s*(\d{1,5}|[A-Z][A-Z0-9]{0,5}(?:\.[A-Z])?)(?=\s|\(|（|$)/)?.[1];
  if (!symbol) return undefined;
  return { market: /^\d+$/.test(symbol) ? "HK" : "US", symbol: /^\d+$/.test(symbol) ? symbol.padStart(5, "0") : symbol };
}

function dateIn(text: string): string | undefined {
  const match = text.match(/(20\d{2})[-/](\d{2})[-/](\d{2})/);
  if (!match) return undefined;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const value = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) return undefined;
  const clock = text.match(/(\d{2}:\d{2}:\d{2}),?\s*GMT\+8/);
  if (!clock) return date;
  const timestamp = new Date(`${date}T${clock[1]}+08:00`);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined;
}

function adjacentStockIdentity(rows: Row[], index: number): { market: string; symbol: string } | undefined {
  const current = rows[index];
  for (const direction of [-1, 1]) {
    const candidateIndex = index + direction;
    const candidate = rows[candidateIndex];
    if (!candidate || Math.abs(candidate.y - current.y) > 30) continue;
    const candidateText = compact(candidate.text);
    if (stockMovementPattern.test(candidateText) || candidate.items.some(item => stockHeaderPattern.test(compact(item.text)))) continue;
    const nextIndex = candidateIndex + direction;
    const next = rows[nextIndex];
    // A full identity immediately before/after another movement belongs to that
    // movement, not to the current row with a missing code.
    if (next && Math.abs(next.y - candidate.y) <= 30 && stockMovementPattern.test(compact(next.text))) continue;
    const parsed = identity(candidate.text);
    if (parsed && (parsed.symbol.length > 1 || /^\d+$/.test(parsed.symbol))) return parsed;
  }
  return undefined;
}

/** Coordinate/header bounded auxiliary tables; cash and stock evidence never become executions. */
export function attachStatementEvidence(pages: PdfTextPage[], result: StatementParseResult): StatementParseResult {
  if (result.broker !== "futu" && result.broker !== "tiger") return result;
  const allText = pages.flatMap(p => p.items.map(i => i.text)).join(" ");
  const monthMatch = allText.match(/(20\d{2})\s*[年/-]\s*(\d{2})(?:\s*月|\b)/);
  const month = result.monthly?.month ?? result.records.find(r => r.source.statementMonth)?.source.statementMonth ?? (monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : undefined);
  const accounts = [...new Set(result.records.map(r => r.accountId))];
  const accountId = result.monthly?.accountId ?? (accounts.length === 1 ? accounts[0] : undefined);
  const monthly: MonthlyStatement = { documentId: result.records[0]?.source.fileFingerprint ?? `${result.broker}:${month ?? "unknown"}`, templateIds: [], positions: [], events: [], reviewRequired: false, ...result.monthly, month, accountId };
  // This parse replaces this document's previous extraction, including removed rows.
  monthly.positions = monthly.positions.filter(p => p.documentId !== undefined && p.documentId !== monthly.documentId);
  monthly.events = monthly.events.filter(e => e.documentId !== undefined && e.documentId !== monthly.documentId);
  delete monthly.historyIncomplete;
  delete monthly.incompleteInstruments;
  const diagnostics = [...result.diagnostics];
  const unresolved = (page: PdfTextPage, row: Row, section: "position" | "transfer" | "stock", symbol?: string) => {
    const code = `statement-${section}-row-unparsed`;
    if (!diagnostics.some(d => d.code === code && d.page === page.pageNumber && d.row === row.number)) diagnostics.push({ severity: "warning", code, page: page.pageNumber, row: row.number, instrumentSymbol: symbol, message: section === "position" ? "持仓表存在未解析的证券行，期初库存及买卖方向可能不完整；请核对原始持仓表。" : section === "stock" ? "股票進出存在未解析的库存变动行，证券、日期或数量无法确定；持仓及收益需要复核。" : "股票转仓行的代码、日期、方向或数量无法确定；持仓及收益需要复核。" });
    monthly.reviewRequired = true;
    if (symbol) {
      const market = /^\d+$/.test(symbol) ? "HK" : "US";
      if (!monthly.incompleteInstruments?.some(i => i.market === market && i.symbol === symbol)) (monthly.incompleteInstruments ??= []).push({ market, symbol });
    } else monthly.historyIncomplete = true;
  };
  if (!accountId) return { ...result, monthly };
  const positions: StatementPosition[] = [];
  const events: StatementEvent[] = [];
  let section: "position" | "transfer" | "cash" | "asset" | "dividend" | "ipo" | "stock" | undefined;
  let phase: StatementPosition["phase"] = "opening";
  let stock = false;
  let headers: PdfTextItem[] = [];
  let accountCurrency: string | undefined;
  let sectionCurrency: string | undefined;
  const switchSection = (next: typeof section, heading?: Row) => {
    section = next;
    headers = [];
    sectionCurrency = next === "cash" ? accountCurrency ?? (heading ? rowCurrency(heading) : undefined) : undefined;
  };
  for (const page of pages) {
    const rows = rowsOf(page);
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const text = compact(row.text);
      if (row.y < 60 || row.y > page.height - 25) continue; // Repeated titles/dates and account footers are outside evidence tables.
      const labeledAccountCurrency = accountCurrencyIn(row);
      if (labeledAccountCurrency) accountCurrency = labeledAccountCurrency;
      if (section === "position" && /^期[初末](?:證券市值|证券市值|現金結餘|现金结余|資產淨值|资产净值)[:：]/.test(text)) { switchSection(undefined); continue; }
      if (/^期[初末](總覽|总览|概覽|概览|持仓|持倉)/.test(text)) {
        switchSection("position", row);
        phase = text.startsWith("期初") ? "opening" : "closing";
        stock = result.broker === "futu" && !/基金/.test(text);
        continue;
      }
      if (/^(头寸转账|頭寸轉賬|证券转入转出|證券轉入轉出)$/.test(text)) { switchSection("transfer", row); continue; }
      if (/^(資金進出|资金进出)$/.test(text)) { switchSection("cash", row); continue; }
      if (/^(資產進出|资产进出)$/.test(text)) { switchSection("asset", row); continue; }
      if (/^(股票進出|股票进出)$/.test(text)) { switchSection("stock", row); continue; }
      if (/^(股息|股利)$/.test(text)) { switchSection("dividend", row); continue; }
      if (/^IPO结果$/.test(text)) { switchSection("ipo", row); continue; }
      if (/^(交易|暗盤交易|暗盘交易|交易明[细細]|金融产品信息|金融產品信息|重要通知|重要事項|注意事項|聲明|声明|免責|免责声明|利息|应计利息|應計利息|Segment转账|注[:：])/.test(text)) { switchSection(undefined); continue; }
      if (!section) continue;
      if (section === "position" && /^(基金|股票|股票和股票期權|期货|期权)$/.test(text)) { stock = text === "股票" || text === "股票和股票期權"; headers = []; continue; }
      if (/合[计計]|總[计計]|总[计計]|資產淨值|资产净值|證券市值[:：]|证券市值[:：]/.test(text)) continue;
      if (row.items.some(i => /^(數量|数量|持有數量|转移数量|變動數量|变动数量|中签数量\(股\)|金額|金额|现金股息|貨幣種類|货币种类)$/.test(compact(i.text)))) {
        headers = row.items;
        continue;
      }
      if (!headers.length) {
        if (section === "position" && stock && identity(row.items[0]?.text ?? "") && row.items.some(i => numberText(i.text) !== undefined)) unresolved(page, row, "position", identity(row.items[0].text)?.symbol);
        if (section === "transfer" && /股票/.test(text) && /转入|轉入|转出|轉出/.test(text)) unresolved(page, row, "transfer");
        if (section === "stock" && stockMovementPattern.test(text)) unresolved(page, row, "stock", identity(row.text)?.symbol);
        continue;
      }
      const source = [{ page: page.pageNumber, row: row.number, role: section === "position" ? `${phase}-position` : section }];
      const codeHeader = headers.find(h => /^(代码|代碼|股票|名稱代碼|代碼名稱)$/.test(compact(h.text)));
      const nameItems = codeHeader ? row.items.filter(i => Math.abs(i.x - codeHeader.x) < 45) : [];
      // Tiger prints the parenthesized symbol one baseline below the numeric row.
      if (codeHeader && result.broker === "tiger") {
        for (const adjacent of [rows[index - 1], rows[index + 1]]) {
          if (adjacent && Math.abs(adjacent.y - row.y) <= 13) nameItems.push(...adjacent.items.filter(i => Math.abs(i.x - codeHeader.x) < 45));
        }
      }
      const nameText = nameItems.map(i => i.text).join(" ");
      if (section === "position" && /^[A-Z]{1,6}\d{6}[CP]\d{8}(?:\s|$)/.test(nameText)) continue; // Unambiguous OCC option, outside stock replay.
      const instrument = identity(nameText)
        ?? (section === "stock" ? identity(row.text) ?? adjacentStockIdentity(rows, index) : undefined)
        ?? (section === "cash" || section === "asset" ? identity(row.text.match(/<SEHK[^>]+>|#\d{5}/)?.[0]?.replace(/^</, "") ?? "") : undefined);
      if (section === "position") {
        if (!stock) continue;
        const quantity = numericCell(row, headers, /^(數量|数量|持有數量)$/);
        const candidate = nameText.length > 0 && row.items.some(i => numberText(i.text) !== undefined || /^(?:N\/A|--?|\?|—)$/.test(i.text));
        if (!instrument || !month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || quantity === undefined) {
          if (candidate) unresolved(page, row, "position", instrument?.symbol);
          continue;
        }
        const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
        const cost = numericCell(row, headers, /^(成本价格|成本價|成本价)$/);
        positions.push({ documentId: monthly.documentId, accountId, ...instrument, phase, date: phase === "opening" ? `${month}-01` : end, quantity, ...(cost && Number(cost) > 0 ? { cost } : {}), source });
        continue;
      }
      let date = dateIn(row.text);
      let kind: StatementEvent["kind"] | undefined;
      let quantity: string | undefined;
      let amount: string | undefined;
      if (section === "stock") {
        const movement = stockMovementPattern.test(text);
        if (!movement) continue;
        const deposit = /^(?:存入股票|存入证券|轉入股票|转入股票)/.test(text);
        const allotment = /IPO.*(?:Allotment|配股|中签|中籤)/i.test(text);
        const cancelled = /cancel|取消|撤銷|撤销/i.test(text);
        quantity = numericCell(row, headers, /^(?:變動數量|变动数量)$/);
        const positiveQuantity = quantity !== undefined && new Decimal(quantity).isPositive();
        const negativeQuantity = quantity !== undefined && new Decimal(quantity).isNegative();
        kind = allotment && deposit && positiveQuantity && !cancelled ? "ipo" : deposit && !negativeQuantity && !cancelled ? "transfer-in" : "transfer-out";
        if (!instrument || !date || quantity === undefined) {
          unresolved(page, row, "stock", instrument?.symbol);
          continue;
        }
      } else if (section === "transfer") {
        if (!/股票/.test(row.text)) continue;
        kind = /转入|轉入/.test(row.text) ? "transfer-in" : /转出|轉出/.test(row.text) ? "transfer-out" : undefined;
        quantity = numericCell(row, headers, /^转移数量$/);
        if (!instrument || !date || !kind || quantity === undefined) {
          unresolved(page, row, "transfer", instrument?.symbol);
          continue;
        }
      } else if (section === "cash" || section === "asset") {
        if (/基金|貨幣兌換|货币兑换/.test(row.text)) continue;
        const cashRow = section === "cash" && /(?:存入現金|提取現金|存入现金|提取现金)/.test(text);
        kind = /Scrip Charge|Handling (?:Fee|Charge)|Financing Interest|Interest for Month|月度利息扣除|手续费|手續費|利息/i.test(row.text)
          ? "fee"
          : /IPO/.test(row.text) ? "ipo"
          : /F\/D|分派|股息/.test(row.text) ? "distribution"
          : /公司行[动動]/.test(row.text) ? "corporate-action"
          : cashRow ? "other" : undefined;
        amount = numericCell(row, headers, /^金額$/);
        if (section === "asset" && kind === "ipo") quantity = numericCell(row, headers, /^數量$/);
      } else if (section === "dividend") {
        if (!instrument) continue;
        kind = /费用|税/.test(row.text) ? "fee" : "distribution";
        amount = numericCell(row, headers, /^现金净值$/);
      } else if (section === "ipo") {
        if (!instrument) continue;
        quantity = numericCell(row, headers, /^中签数量\(股\)$/);
        if (quantity === undefined) continue;
        kind = "ipo";
        amount = numericCell(row, headers, /^中签金额$/);
        // Results have no event date. Preserve month precision rather than invent a day.
        date = month;
      }
      if (!kind || !date || (section === "cash" && amount === undefined)) continue;
      const eventCurrency = rowCurrency(row) ?? (section === "cash" ? sectionCurrency : undefined);
      events.push({ documentId: monthly.documentId, id: `${monthly.documentId}:evidence:${page.pageNumber}:${row.number}`, accountId, ...instrument, date, kind, ...(quantity !== undefined ? { quantity } : {}), ...(amount !== undefined ? { amount } : {}), ...(kind === "ipo" && quantity !== undefined ? { displayTimePolicy: "session-open" as const } : {}), currency: section === "stock" || section === "transfer" ? undefined : eventCurrency, description: row.text, source });
    }
  }
  const positionKeys = new Set(monthly.positions.map(p => JSON.stringify([p.accountId, p.market, p.symbol, p.date, p.phase, p.quantity])));
  for (const position of positions) {
    const key = JSON.stringify([position.accountId, position.market, position.symbol, position.date, position.phase, position.quantity]);
    if (!positionKeys.has(key)) { monthly.positions.push(position); positionKeys.add(key); }
  }
  const eventIds = new Set(monthly.events.map(e => e.id));
  for (const event of events) if (!eventIds.has(event.id)) { monthly.events.push(event); eventIds.add(event.id); }
  const matches = (item: { accountId: string; market?: string; symbol?: string }, record: StatementParseResult["records"][number]) => item.accountId === record.accountId && item.market === record.instrument.market && item.symbol === record.instrument.symbol;
  for (const event of monthly.events) {
    if ((event.kind === "transfer-in" || event.kind === "transfer-out") && event.date.length === 10 && result.records.some(r => matches(event, r) && (r.source.tradingDate ?? r.source.marketCalendarDate ?? r.executedAt.slice(0, 10)) === event.date)) {
      if (!diagnostics.some(d => d.code === "statement-event-order-ambiguous" && d.page === event.source[0]?.page && d.row === event.source[0]?.row)) diagnostics.push({ severity: "warning", code: "statement-event-order-ambiguous", message: "转仓只有日期，无法确定与同日成交的先后；持仓和收益需要复核。", instrumentSymbol: event.symbol, page: event.source[0]?.page, row: event.source[0]?.row });
      monthly.reviewRequired = true;
    }
  }
  return { ...result, monthly, diagnostics, records: applyMonthlyHistoryEvidence(result.records, [monthly]) };
}

/** Reattach persisted monthly inventory to fills, including months containing no executions.
 * A preceding closing snapshot remains a closing boundary; its price is never promoted to cost.
 * Each supplied document is authoritative, including empty evidence arrays. Documents absent
 * from this call retain their attachments. Callers must supply only the current revision per ID.
 */
export function applyMonthlyHistoryEvidence(executions: TradeExecution[], monthly: MonthlyStatement[]): TradeExecution[] {
  const documents = new Set(monthly.map(m => m.documentId));
  const positions = monthly.flatMap(m => m.positions.map(p => ({ ...p, documentId: p.documentId ?? m.documentId })));
  const events = monthly.flatMap(m => m.events.map(e => ({ ...e, documentId: e.documentId ?? m.documentId })));
  const superseded = (item: StatementPosition | StatementEvent) => {
    // Older parser events already encode their document ID, even without the explicit field.
    const legacyDocument = "id" in item && item.id.includes(":evidence:") ? item.id.slice(0, item.id.lastIndexOf(":evidence:")) : undefined;
    const documentId = item.documentId ?? legacyDocument;
    return documentId !== undefined && documents.has(documentId);
  };
  const symbolKey = (symbol: string, market: string) => market === "HK" ? symbol.replace(/^0+/, "") : symbol.toUpperCase();
  const isUnassignedIpoFee = (event: StatementEvent) => event.kind === "fee" && event.symbol === undefined
    && /(?:\bIPO\b|申購|申购|新股)/i.test(event.description)
    && /(?:fee|charge|interest|利息|手續費|手续费|費用|费用)/i.test(event.description);
  const compatibleUnassignedFee = (event: StatementEvent, execution: TradeExecution) =>
    isUnassignedIpoFee(event) && event.accountId === execution.accountId
      && (event.market === undefined || event.market.toUpperCase() === execution.instrument.market.toUpperCase())
      && (event.currency === undefined || event.currency.toUpperCase() === execution.instrument.currency.toUpperCase());
  return executions.map(execution => {
    const matches = (item: { accountId: string; market?: string; symbol?: string }) => item.accountId === execution.accountId && item.market === execution.instrument.market && item.symbol !== undefined && symbolKey(item.symbol, item.market) === symbolKey(execution.instrument.symbol, execution.instrument.market);
    const isSimulation = execution.source.tradeNature === "simulation" || execution.source.tradingNature === "simulated";
    const day = execution.source.tradingDate ?? execution.source.marketCalendarDate ?? execution.executedAt.slice(0, 10);
    const retainedPosition = execution.source.openingPosition && !superseded(execution.source.openingPosition) ? [execution.source.openingPosition] : [];
    const statementPositions = [...new Map([...positions.filter(matches), ...(execution.source.statementPositions ?? []).filter(p => !superseded(p)), ...retainedPosition].filter(matches).map(p => [JSON.stringify([p.documentId, p.accountId, p.market, p.symbol, p.phase, p.date, p.quantity]), p])).values()];
    const openingPosition = statementPositions
      .filter(p => matches(p) && (p.phase === "opening" ? p.date <= day : p.date < day))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const positionEvents = [...new Map([...(execution.source.positionEvents ?? []).filter(e => !superseded(e)), ...events.filter(event => matches(event) || (!isSimulation && compatibleUnassignedFee(event, execution)))].map(event => [`${event.documentId ?? ""}:${event.accountId}:${event.id}`, event])).values()];
    const source = { ...execution.source };
    delete source.openingPosition;
    delete source.statementPositions;
    delete source.positionEvents;
    if (openingPosition) source.openingPosition = openingPosition;
    if (statementPositions.length) source.statementPositions = statementPositions;
    if (positionEvents.length) source.positionEvents = positionEvents;
    // A later no-trade month can invalidate an earlier still-held position.
    // Conservatively withhold certification for that instrument's history until
    // corrected; do not silently lose the flag just because no later fill exists.
    const affectedDocuments = monthly.filter(m => (!m.accountId || m.accountId === execution.accountId) && (m.historyIncomplete || m.incompleteInstruments?.some(i => i.market === execution.instrument.market && symbolKey(i.symbol, i.market) === symbolKey(execution.instrument.symbol, execution.instrument.market))));
    const historyIncomplete = [...new Set([...(source.historyIncomplete ?? []).filter(id => !documents.has(id)), ...affectedDocuments.map(m => m.documentId)])];
    delete source.historyIncomplete;
    if (historyIncomplete.length) source.historyIncomplete = historyIncomplete;
    return { ...execution, source };
  });
}

export function hasStatementMonthGap(previous: string | undefined, next: string, coveredMonths: string[]): boolean {
  if (!previous) return false;
  const ordinal = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const covered = new Set(coveredMonths.map(ordinal));
  for (let month = ordinal(previous) + 1; month < ordinal(next); month++) {
    if (!covered.has(month)) return true;
  }
  return false;
}

/** Date-only knowledge becomes available at day end; it never acquires invented intraday precision. */
export function replayCursorAt(value: string): string {
  return value.length === 10 ? `${value}T23:59:59.999Z` : new Date(value).toISOString();
}

export function replayExecutionAt(execution: TradeExecution): string {
  if (execution.executedAt.length !== 10 && execution.source.timePrecision !== "date-only") {
    return replayCursorAt(execution.executedAt);
  }
  const verifiedSessionOpenAcquisition = execution.source.displayTimePolicy === "session-open" && execution.source.positionEffect === "open-long";
  let calendarDate = execution.source.marketCalendarDate ?? execution.source.tradingDate;
  const sourceDate = execution.source.sourceTimestampText?.trim();
  if (!calendarDate && sourceDate && /^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) calendarDate = sourceDate;
  if (!calendarDate && execution.executedAt.length !== 10 && execution.source.sourceTimezone) {
    try {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone: execution.source.sourceTimezone, year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date(execution.executedAt)).map(part => [part.type, part.value]));
      calendarDate = `${parts.year}-${parts.month}-${parts.day}`;
    } catch {
      // Unrecognized historical zone labels retain the prior UTC-date fallback.
    }
  }
  const replayDate = calendarDate ?? execution.executedAt.slice(0, 10);
  return verifiedSessionOpenAcquisition ? `${replayDate}T00:00:00.000Z` : replayCursorAt(replayDate);
}

export function statementPositionAt(position: StatementPosition): string {
  return `${position.date}T${position.phase === "opening" ? "00:00:00.000" : "23:59:59.999"}Z`;
}

export function statementEventAt(event: StatementEvent): string {
  if (event.kind === "ipo" && event.quantity !== undefined && event.displayTimePolicy === "session-open") {
    return event.date.length === 7
      ? `${event.date}-01T00:00:00.000Z`
      : `${event.date}T00:00:00.000Z`;
  }
  return event.date.length === 7
    ? new Date(Date.UTC(Number(event.date.slice(0, 4)), Number(event.date.slice(5)), 0, 23, 59, 59, 999)).toISOString()
    : replayCursorAt(event.date);
}

function sameMonthOrDate(event: StatementEvent, execution: TradeExecution): boolean {
  const executionDate = execution.source.tradingDate ?? execution.source.marketCalendarDate ?? execution.executedAt.slice(0, 10);
  return event.date.length === 7
    ? executionDate.startsWith(event.date)
    : executionDate === event.date;
}

function sameActualDate(event: StatementEvent, execution: TradeExecution): boolean {
  const executionDate = execution.source.tradingDate ?? execution.source.marketCalendarDate ?? execution.executedAt.slice(0, 10);
  return event.date.length === 10 && executionDate === event.date;
}

function containsIndependentNumber(text: string, value: string | undefined): boolean {
  if (!value || !/^\d+$/.test(value)) return false;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\D)${escaped}(?:$|\\D)`).test(text);
}

function sameTrustedStatementRow(event: StatementEvent, execution: TradeExecution): boolean {
  const fingerprint = execution.source.fileFingerprint;
  if (!fingerprint || !event.documentId || (event.documentId !== fingerprint && event.documentId !== `futu:${fingerprint}`)) return false;
  const executionRows = [
    ...(execution.source.page !== undefined ? [{ page: execution.source.page, row: execution.source.row }] : []),
    ...(execution.source.fragments ?? []).map(fragment => ({ page: fragment.page, row: fragment.row })),
  ];
  return event.source.some(fragment => executionRows.some(source => source.page === fragment.page && source.row === fragment.row));
}

function closeEnough(left: string, right: string): boolean {
  try {
    return new Decimal(left).minus(right).abs().lte("0.01");
  } catch {
    return false;
  }
}

/**
 * Some broker statements repeat an IPO allotment in both the asset-event table
 * and the ordinary buy blotter. Keep the event for evidence/chart markers, but
 * do not count it as a second inventory addition when the reported amount and
 * quantity identify the same buy.
 */
export function isExecutionBackedIpoAllocation(
  event: StatementEvent,
  executions: readonly TradeExecution[],
): boolean {
  if (event.kind !== "ipo" || event.quantity === undefined || !event.symbol || !event.market) return false;
  let eventQuantity: Decimal;
  try {
    eventQuantity = new Decimal(event.quantity);
  } catch {
    return false;
  }
  if (!eventQuantity.isPositive()) return false;
  return executions.some((execution) => {
    if (execution.side !== "buy" || execution.accountId !== event.accountId || !sameMonthOrDate(event, execution)) return false;
    if (canonicalInstrumentId(execution.instrument.symbol, execution.instrument.market) !== canonicalInstrumentId(event.symbol!, event.market!)) return false;
    if (!closeEnough(execution.quantity, event.quantity!)) return false;
    if (event.amount !== undefined) {
      const gross = execution.source.grossAmount ?? new Decimal(execution.quantity).mul(execution.price).toString();
      return closeEnough(gross, new Decimal(event.amount).abs().toString());
    }
    if (!sameActualDate(event, execution)) return false;
    const verifiedSource = execution.source.positionEffect === "open-long" && execution.source.displayTimePolicy === "session-open";
    if (!verifiedSource) return false;
    return containsIndependentNumber(event.description, execution.source.sourceTradeId) || sameTrustedStatementRow(event, execution);
  });
}
