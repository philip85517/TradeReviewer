import type { HomeRequest, Scenario } from '../display-contract';
import type { HistoryRange } from './contracts';
import { matchesScope, mockInstruments } from './mock-source';

export type HistoryMetric = 'net' | 'cumulative' | 'win' | 'rounds';
export type HistoryPeriod = { key: string; label: string; state: 'value' | 'empty' | 'source-missing' | 'future'; net: number | null; closed: number | null; wins: number | null; fees: number | null };
export type HistorySnapshot = { range: HistoryRange; currency: 'CNY'; periods: HistoryPeriod[]; stats: { net: number | null; closed: number | null; wins: number | null; fees: number | null }; state: 'ready' | 'empty' | 'source-missing' | 'future' };
export type HistoryPoint = HistoryPeriod & { value: number | null; cumulative: number | null };

// Deliberately supplied closed-result fixtures, not a transaction accounting algorithm.
const MONTHS = [[1, 6000, 6000], [3, -2000, -2000], [4, 7000, -1000], [6, 5000, -1000], [7, 6000, 6000], [9, 1000, -3000], [10, 1000, 1000]];
const YEARS = [2024, 2025, 2026];
export const historyRangeLabel = (range: HistoryRange) => range.fromYear === range.toYear ? String(range.fromYear) : range.fromYear === 2024 && range.toYear === 2026 ? '2024–2026' : `${range.fromYear}–${range.toYear}`;

export function readHistorySnapshot(request: HomeRequest, range: HistoryRange, scenario: Scenario): HistorySnapshot {
  const allClosed = mockInstruments(scenario).filter(row => !row.open);
  const eligible = new Set(allClosed.filter(row => matchesScope(row, request)).map(row => row.id));
  const records = YEARS.flatMap(year => MONTHS.flatMap(([month, ...nets], mi) => nets.map((net, ri) => {
    const index = mi * 2 + ri, instrument = allClosed[index % Math.max(1, allClosed.length)];
    const scale = (year === 2024 ? .6 : year === 2025 ? .8 : 1) * (scenario === 'extreme' ? 100000 : 1);
    return { year, month, index, id: instrument?.id ?? '', net: scenario === 'one' ? 0 : net * scale, wins: scenario === 'one' ? 0 : Number(net > 0), fees: (index === 13 ? 230 : 170) * (scenario === 'extreme' ? 1000 : 1) };
  }))).filter(row => eligible.has(row.id) && (scenario !== 'one' || row.index === 0));
  const monthly = range.fromYear === range.toYear;
  const keys = monthly ? Array.from({ length: 12 }, (_, i) => ({ year: range.fromYear, month: i + 1 })) : Array.from({ length: Math.min(100, Math.max(1, range.toYear - range.fromYear + 1)) }, (_, i) => ({ year: range.fromYear + i, month: 0 }));
  const periods: HistoryPeriod[] = keys.map(({ year, month }) => {
    const key = month ? `${year}-${String(month).padStart(2, '0')}` : String(year);
    const future = year > 2026 || year === 2026 && month > 10;
    const selected = records.filter(row => row.year === year && (!month || row.month === month));
    const missing = (scenario === 'gaps' || scenario === 'unknown') && eligible.size > 0 && (monthly ? month === 6 && year <= 2026 : year === 2025);
    const sum = (field: 'net' | 'wins' | 'fees') => selected.reduce((total, row) => total + row[field], 0);
    return { key, label: month ? `${month}月` : String(year), state: future ? 'future' : missing ? 'source-missing' : selected.length ? 'value' : 'empty', net: future || missing ? null : sum('net'), closed: future || missing ? null : selected.length, wins: future || missing ? null : sum('wins'), fees: future || missing ? null : sum('fees') };
  });
  const unknown = periods.some(row => row.state === 'source-missing');
  const futureOnly = periods.every(row => row.state === 'future');
  const sum = (field: 'net' | 'closed' | 'wins' | 'fees') => unknown || futureOnly ? null : periods.reduce((total, row) => total + (row[field] ?? 0), 0);
  const stats = { net: sum('net'), closed: sum('closed'), wins: sum('wins'), fees: sum('fees') };
  return { range, currency: 'CNY', periods, stats, state: unknown ? 'source-missing' : futureOnly ? 'future' : stats.closed === 0 ? 'empty' : 'ready' };
}

export function historySeries(periods: HistoryPeriod[], metric: HistoryMetric): HistoryPoint[] {
  let cumulative = 0, missing = false;
  return periods.map(row => {
    if (row.state === 'source-missing') missing = true;
    cumulative += row.net ?? 0;
    const total = missing || row.state === 'future' ? null : cumulative;
    const value = row.state === 'source-missing' || row.state === 'future' ? null : metric === 'rounds' ? row.closed : row.closed === 0 ? null : metric === 'win' ? row.wins! / row.closed! * 100 : metric === 'cumulative' ? total : row.net;
    return { ...row, value, cumulative: total };
  });
}

export function historyTicks(values: (number | null)[], metric: HistoryMetric): number[] {
  if (metric === 'win') return [0, 20, 40, 60, 80, 100];
  const known = values.filter((value): value is number => value !== null);
  const min = Math.min(0, ...known), max = Math.max(0, ...known);
  if (min === 0 && max === 0) return metric === 'rounds' ? [0, 1, 2] : [-1, 0, 1];
  const raw = (max - min) / 5, exponent = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map(factor => factor * exponent).find(candidate => candidate >= raw) ?? exponent * 10;
  if (metric === 'rounds') step = Math.max(1, Math.ceil(step));
  while (Math.ceil(max / step) - Math.floor(min / step) > 6) step *= 2;
  return Array.from({ length: Math.ceil(max / step) - Math.floor(min / step) + 1 }, (_, i) => Number(((Math.floor(min / step) + i) * step).toPrecision(12)));
}
export function historyAmount(value: number | null, signed = false, compact = false): string {
  if (value === null) return '—';
  const prefix = signed && value > 0 ? '+' : '';
  if (compact && Math.abs(value) >= 1e8) return prefix + (value / 1e8).toFixed(2) + '亿';
  if (compact && Math.abs(value) >= 1e4) return prefix + (value / 1e4).toFixed(2) + '万';
  return prefix + new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: compact ? 0 : 2 }).format(value);
}
