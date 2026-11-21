import Decimal from 'decimal.js';
import type { Market } from '../display-contract';
import type { ContributionProps, MockInstrument } from './contracts';
import { readHistorySnapshot } from './history-data';

export type ContributionMode = 'current' | 'historical';
export type ContributionCategory = 'long' | 'short' | 'ipo';
export type ContributionRecord = { key: string; instrumentId: string; name: string; code: string; exchange: string; market: Exclude<Market, 'all'>; open: boolean; net?: number | null; realized: number | null; floating: number | null };
export type ContributionSegment = { type: 'realized' | 'floating'; value: number; side: 'positive' | 'negative'; offset: number; width: number };
export const MARKET_NAMES: Record<Market, string> = { all: '全部市场', CN: 'A股', HK: '港股', US: '美股' };
const cents = (n: number) => new Decimal(n).toDecimalPlaces(2).toNumber();
const sum = (values: number[]) => values.reduce((acc, n) => acc.add(n), new Decimal(0)).toNumber();

/** Illustrative presentation snapshots only. These allocations are not financial calculation rules.
 * long/short/ipo select separate supplied examples; ipo represents allocation + subsequent sales only,
 * never ordinary post-listing purchases inferred from a security identity.
 */
export function buildContributionSnapshot(props: ContributionProps, mode: ContributionMode, category: ContributionCategory): ContributionRecord[] {
  const { request, scenario } = props, filters = request.filters;
  let instruments = props.instruments.filter(item =>
    (request.market === 'all' || item.market === request.market) &&
    (request.accountId === 'all' || item.accountId === request.accountId) &&
    (!filters?.assetTypes.length || filters.assetTypes.includes(item.assetType)) &&
    (!filters?.openOnly || item.open) &&
    (!filters || filters.review === 'all' || item.review === filters.review) &&
    (mode !== 'historical' || !item.open) &&
    (category === 'long' || item.assetType === '股票'));
  if (scenario === 'empty' || !instruments.length) return [];
  // The 50-result fixture deliberately exercises 8-row / 7-page presentation.
  if (scenario === 'fifty-pages' && mode === 'current') {
    const expanded: MockInstrument[] = [];
    for (const market of ['CN', 'HK', 'US'] as const) {
      const group = instruments.filter(item => item.market === market);
      for (let i = 0; group.length && i < 50; i++) expanded.push(group[i % group.length]);
    }
    instruments = expanded;
  }
  const historical = mode === 'historical' ? readHistorySnapshot(request, props.historyRange, scenario) : null;
  if (historical?.state === 'empty') return [];
  const targetValue = mode === 'current' ? props.currentNet?.value : historical?.stats.net;
  const knownParts = mode === 'current' && props.currentRealized?.value != null && props.currentFloating?.value != null ? sum([Number(props.currentRealized.value), Number(props.currentFloating.value)]) : null;
  const target = Number(targetValue ?? knownParts ?? (mode === 'current' ? 18420 : 30000));
  const targetCents = cents(target * (category === 'long' ? 1 : category === 'short' ? -0.15 : 0.08));
  const markets = (['CN', 'HK', 'US'] as const).filter(market => instruments.some(item => item.market === market));
  const weights = { CN: 12020, HK: -600, US: 7000 };
  const denominator = sum(markets.map(market => weights[market]));
  let allocated = 0;
  const rows = markets.flatMap((market, marketIndex) => {
    const group = instruments.filter(item => item.market === market);
    const marketTotal = marketIndex === markets.length - 1 ? cents(targetCents - allocated) : cents(targetCents * weights[market] / denominator);
    allocated = cents(allocated + marketTotal);
    let emitted = 0;
    return group.map((item, i): ContributionRecord => {
      const total = i === group.length - 1 ? cents(marketTotal - emitted) : cents(marketTotal / group.length);
      emitted = cents(emitted + total);
      const ratio = [0.72, 1.2, -0.4, 0.65, 0, 1.1, 0.85, 0.6][i % 8];
      const realized = mode === 'historical' ? total : cents(total * ratio);
      const floating = mode === 'historical' ? 0 : cents(total - realized);
      const first = market === markets[0] && i === 0;
      const unknownRealized = mode === 'historical' ? historical?.stats.net === null : first && props.currentRealized?.value === null;
      const unknownFloating = mode === 'current' && first && props.currentFloating?.value === null;
      const unknownNet = targetValue == null && (mode === 'historical' || first);
      return { key: `${mode}:${category}:${item.id}:${i}`, instrumentId: item.id, name: item.name, code: item.code, exchange: item.exchange, market, open: item.open,
        net: unknownNet ? null : total, realized: unknownRealized ? null : realized, floating: unknownFloating ? null : floating };
    });
  });
  // Supplied Mock presentation parts must reconcile with the adjacent cards.
  // Preserve each symbol's net while adjusting the illustrative split, never derive it from trades.
  if (mode === 'current' && props.currentRealized?.value != null && rows.length) {
    const factor = category === 'long' ? 1 : category === 'short' ? -0.15 : 0.08;
    const targetRealized = cents(Number(props.currentRealized.value) * factor);
    const delta = cents(targetRealized - sum(rows.map(row => row.realized ?? 0)));
    const last = rows[rows.length - 1];
    last.realized = cents((last.realized ?? 0) + delta);
    if (last.floating !== null) last.floating = cents(last.floating - delta);
  }
  return rows;
}
export function contributionTotal(row: Pick<ContributionRecord, 'realized' | 'floating' | 'net'>): number | null {
  if (row.net !== undefined) return row.net;
  return row.realized === null || row.floating === null ? null : cents(row.realized + row.floating);
}
export function totalParts(rows: Pick<ContributionRecord, 'realized' | 'floating'>[]) {
  return { realized: rows.some(row => row.realized === null) ? null : sum(rows.map(row => row.realized!)), floating: rows.some(row => row.floating === null) ? null : sum(rows.map(row => row.floating!)) };
}
export function totalContribution(rows: Pick<ContributionRecord, 'realized' | 'floating' | 'net'>[]): number | null {
  const values = rows.map(contributionTotal);
  return values.some(value => value === null) ? null : sum(values as number[]);
}
export function aggregateMarkets(rows: ContributionRecord[]): ContributionRecord[] {
  return (['CN', 'HK', 'US'] as const).map(market => {
    const items = rows.filter(row => row.market === market), parts = totalParts(items);
    return { key: `market:${market}`, instrumentId: '', name: MARKET_NAMES[market], code: '', exchange: '', market, open: false, ...parts, net: totalContribution(items) };
  });
}
/** Combine supplied open/closed components of one account/security after local filtering. */
export function aggregateSymbols(rows: ContributionRecord[], instruments: MockInstrument[]): ContributionRecord[] {
  const identities = new Map(instruments.map(item => [item.id, item]));
  const grouped = new Map<string, ContributionRecord>();
  for (const row of rows) {
    const key = `${identities.get(row.instrumentId)?.accountId}:${row.exchange}:${row.code}`;
    const previous = grouped.get(key);
    if (!previous) grouped.set(key, { ...row, key: `symbol:${key}` });
    else grouped.set(key, { ...(row.open && !previous.open ? row : previous), key: `symbol:${key}`, open: previous.open || row.open, ...totalParts([previous, row]), net: totalContribution([previous, row]) });
  }
  return [...grouped.values()];
}
export function segmentGeometry(realized: number | null, floating: number | null, max: number): ContributionSegment[] {
  let positive = 0, negative = 0;
  return ([['realized', realized], ['floating', floating]] as const).flatMap(([type, value]) => {
    if (value === null) return [];
    const width = Math.abs(value) / Math.max(max, 0.01) * 46, side = value >= 0 ? 'positive' : 'negative';
    const offset = side === 'positive' ? positive : negative;
    if (side === 'positive') positive += width; else negative += width;
    return [{ type, value, side, offset, width }];
  });
}
export function formatContribution(value: number | null, compact = true): string {
  if (value === null) return '不可计算';
  const n = cents(value), abs = Math.abs(n), sign = n > 0 ? '+' : n < 0 ? '−' : '';
  if (compact && abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿`;
  if (compact && abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(2)}万`;
  return `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
