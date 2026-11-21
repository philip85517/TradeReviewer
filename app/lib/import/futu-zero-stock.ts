import Decimal from 'decimal.js';
import type { StatementZeroStockEvidence } from './monthly-statement';

type Row = { page: number; row: number; text: string };
/** Recognizes the complete cash-only comprehensive-account report, never a net-zero valuation. */
export function readFutuZeroStockEvidence(rows: Row[], accountId: string, month?: string): StatementZeroStockEvidence[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')) return [];
  const compact = (text: string) => text.replace(/\s+/g, '');
  const text = rows.map(r => compact(r.text)).join('\n');
  if (!/保證金綜合帳戶.*證券月結單/.test(text)) return [];
  const summary = rows.findIndex(r => compact(r.text) === '資產組合摘要');
  const opening = rows.findIndex(r => compact(r.text).startsWith('期初資產淨值總覽'));
  const closing = rows.findIndex(r => compact(r.text).startsWith('期末資產淨值總覽'));
  if (summary < 0 || opening <= summary || closing <= opening) return [];
  const numeric = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;
  const values = (row: Row, label: string, count: number) => {
    const cells = row.text.trim().split(/\s+/);
    if (cells.shift() !== label || cells.length !== count || cells.some(v => !numeric.test(v))) return undefined;
    return cells;
  };
  const summaryRows = rows.slice(summary + 1, opening);
  const cashSummary = summaryRows.filter(r => compact(r.text).startsWith('現金結餘'));
  const navSummary = summaryRows.filter(r => compact(r.text).startsWith('資產淨值'));
  if (cashSummary.length !== 1 || navSummary.length !== 1) return [];
  const summaryCash = values(cashSummary[0], '現金結餘', 3);
  const summaryNav = values(navSummary[0], '資產淨值', 3);
  if (!summaryCash || !summaryNav || summaryCash.some((v,i) => v !== summaryNav[i])) return [];
  const otherSummary = summaryRows.filter(r => r !== cashSummary[0] && r !== navSummary[0]).map(r => compact(r.text));
  if (otherSummary.some(t => !/^(期初金額\(HKD\)期末金額\(HKD\)變動\(HKD\)|參考匯率：.*|期初概覽)$/.test(t))) return [];
  // This template contains no securities-detail sections at all. A nonzero
  // quantity at a zero mark is still a position and disqualifies this proof.
  const important = rows.findIndex((r,i) => i > closing && compact(r.text) === '重要提示');
  if (important < 0) return [];
  const detailText = rows.slice(opening, important).map(r => compact(r.text));
  if (detailText.some(t => /^(?:股票和股票期權|股票及股票期權|股票持倉|股票|證券持倉|基金|債券|期權|期初持倉|期末持倉|資產組合|交易明細|股票進出)/.test(t))) return [];
  // Require the entire overview region to contain only this known cash-only
  // template's rows, so an unrecognized ticker/detail row cannot be ignored.
  const allowed = /^(?:期[初末]資產淨值總覽|現金結餘|資產淨值|合計\(HKD\)|初始保證金要求|維持保證金要求|可再開倉資金|期末概覽|保證金綜合帳戶|製備日期：|\d{4}\/\d{2}$)/;
  if (rows.slice(opening, important).some(r => !allowed.test(compact(r.text)))) return [];
  const result: StatementZeroStockEvidence[] = [];
  for (const [phase, start] of [['opening', opening], ['closing', closing]] as const) {
    const section = rows.slice(start, start + 3);
    if (section.length !== 3) continue;
    if (compact(section[0].text) !== `${phase === 'opening' ? '期初' : '期末'}資產淨值總覽合計(HKD)港幣資產美元資產人民幣資產日元資產新加坡元資產`) continue;
    const cash = values(section[1], '現金結餘', 6);
    const nav = values(section[2], '資產淨值', 6);
    if (!cash || !nav || cash.some((v,i) => v !== nav[i])) continue;
    const summaryIndex = phase === 'opening' ? 0 : 1;
    if (!new Decimal(cash[0].replaceAll(',', '')).eq(summaryCash[summaryIndex].replaceAll(',', ''))) continue;
    // Every row between the table header and NAV must be present and cash-only.
    const date = phase === 'opening' ? `${month}-01` : `${month}-${new Date(Date.UTC(Number(month!.slice(0,4)), Number(month!.slice(5)), 0)).getUTCDate()}`;
    result.push({accountId,date,phase,markets:['US','HK','CN-SH','CN-SZ'],proof:'complete-cash-only-asset-breakdown',source:[...rows.slice(summary, opening),...section].map(r=>({page:r.page,row:r.row,role:'complete-cash-only-asset-breakdown'}))});
  }
  return result;
}
