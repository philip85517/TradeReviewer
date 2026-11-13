import type { HomeRequest, Scenario } from './display-contract';
import { DEFAULT_REQUEST, SCENARIOS } from './mock-source';
export type PreviewLocation = { request: HomeRequest; scenario: Scenario; holdingId?: string; panel?: 'detail' | 'trades' };
export function validDate(value: string) { return /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function parseLocation(search: string): PreviewLocation {
  const p = new URLSearchParams(search), base = DEFAULT_REQUEST;
  const from = p.get('from') ?? base.period.from, to = p.get('to') ?? base.period.to;
  const preset = p.get('period') ?? 'ytd';
  const validPeriod = validDate(from) && validDate(to) && from <= to && ['all', 'ytd', 'month', 'week', 'custom'].includes(preset);
  const page = Number(p.get('page') ?? '1');
  const request: HomeRequest = { market: ['all', 'CN', 'HK', 'US'].includes(p.get('market') ?? '') ? p.get('market') as HomeRequest['market'] : 'all', accountId: ['all', 'account-1', 'account-2'].includes(p.get('account') ?? '') ? p.get('account')! : 'all', period: validPeriod ? { preset: preset as HomeRequest['period']['preset'], from, to } : base.period, query: (p.get('q') ?? '').slice(0, 200), sort: ['name', 'marketValue', 'unrealized'].includes(p.get('sort') ?? '') ? p.get('sort') as HomeRequest['sort'] : 'name', direction: p.get('direction') === 'desc' ? 'desc' : 'asc', page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1 };
  const scenario = SCENARIOS.includes(p.get('scenario') as Scenario) ? p.get('scenario') as Scenario : 'normal';
  const holdingId = p.get('holding');
  return { request, scenario, ...(holdingId && holdingId.length < 300 ? { holdingId, panel: p.get('panel') === 'trades' ? 'trades' as const : 'detail' as const } : {}) };
}
export function serializeLocation(state: PreviewLocation): string {
  const r = state.request, p = new URLSearchParams({ market: r.market, account: r.accountId, period: r.period.preset, from: r.period.from, to: r.period.to, q: r.query, sort: r.sort, direction: r.direction, page: String(r.page), scenario: state.scenario });
  if (state.holdingId) { p.set('holding', state.holdingId); p.set('panel', state.panel ?? 'detail'); }
  return `?${p.toString()}`;
}
