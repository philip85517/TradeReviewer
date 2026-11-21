import type { HomeRequest, Scenario } from './display-contract';
import { DEFAULT_REQUEST, SCENARIOS } from './mock-source';
export type PreviewLocation = { request: HomeRequest; scenario: Scenario; holdingId?: string; releaseId?: string; panel?: 'detail' | 'trades'; notices?: string[] };
export function validDate(value: string) { return /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function parseLocation(search: string, base=DEFAULT_REQUEST, realAccounts=false): PreviewLocation {
  const p = new URLSearchParams(search);
  const validAccount=(value:string)=>realAccounts?value.length>0&&value.length<=500:['all','account-1','account-2'].includes(value);
  const from = p.get('from') ?? base.period.from, to = p.get('to') ?? base.period.to;
  const preset = p.get('period') ?? 'ytd';
  const validPeriod = p.has('from') === p.has('to') && validDate(from) && validDate(to) && from <= to && ['all', 'ytd', 'month', 'week', 'custom'].includes(preset);
  const page = Number(p.get('page') ?? '1');
  const request: HomeRequest = { market: ['all', 'CN', 'HK', 'US'].includes(p.get('market') ?? '') ? p.get('market') as HomeRequest['market'] : 'all', accountId: validAccount(p.get('account') ?? '') ? p.get('account')! : 'all', period: validPeriod ? { preset: preset as HomeRequest['period']['preset'], from, to } : base.period, query: (p.get('q') ?? '').slice(0, 200), sort: ['name', 'marketValue', 'unrealized'].includes(p.get('sort') ?? '') ? p.get('sort') as HomeRequest['sort'] : 'name', direction: p.get('direction') === 'desc' ? 'desc' : 'asc', page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1 };
  if (!realAccounts && p.has('assets')) {
    request.filters = { assetTypes: (p.get('assets') ?? '').split(',').filter(v => ['股票','ETF','基金'].includes(v)), openOnly: p.get('openOnly') === '1', review: p.get('review') === 'pending' ? 'pending' : p.get('review') === 'done' ? 'done' : 'all' };
  }
  const scenario = SCENARIOS.includes(p.get('scenario') as Scenario) ? p.get('scenario') as Scenario : 'normal';
  const releaseId=p.get('release');
  const holdingId = releaseId&&(!/^[a-zA-Z0-9_-]{1,200}$/.test(releaseId))?null:p.get('holding');
  const notices: string[] = [];
  if(p.has('holding')&&!holdingId)notices.push('详情版本参数无效，请从持仓行重新打开');
  if (p.has('market') && !['all','CN','HK','US'].includes(p.get('market')!)) notices.push('市场参数无效，已选择全部市场');
  if (p.has('account') && !validAccount(p.get('account')!)) notices.push('账户参数无效，已选择全部实盘账户');
  if (!validPeriod) notices.push('日期不完整或无效，已恢复本年期间');
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) notices.push('页码无效，已恢复可用页码');
  if (p.has('sort') && !['name','marketValue','unrealized'].includes(p.get('sort')!)) notices.push('排序参数无效，已按名称排序');
  if (p.has('direction') && !['asc','desc'].includes(p.get('direction')!)) notices.push('排序方向无效，已恢复升序');
  if (p.has('scenario') && !SCENARIOS.includes(p.get('scenario') as Scenario)) notices.push('Mock场景无效，已恢复normal');
  if ((p.get('q')?.length ?? 0) > 200) notices.push('搜索词超长，已保留前200字');
  if (holdingId && holdingId.length >= 300) notices.push('持仓身份参数无效，请从持仓行重新打开');
  if (p.has('panel') && !['detail','trades'].includes(p.get('panel')!)) notices.push('详情位置参数无效，已恢复持仓详情');
  return { request, scenario, ...(notices.length ? { notices } : {}), ...(holdingId && holdingId.length < 300 ? { holdingId, ...(releaseId?{releaseId}:{}), panel: p.get('panel') === 'trades' ? 'trades' as const : 'detail' as const } : {}) };
}
export function serializeLocation(state: PreviewLocation): string {
  const r = state.request, p = new URLSearchParams({ market: r.market, account: r.accountId, period: r.period.preset, from: r.period.from, to: r.period.to, q: r.query, sort: r.sort, direction: r.direction, page: String(r.page), scenario: state.scenario });
  if (r.filters) { p.set('assets',r.filters.assetTypes.join(',')); p.set('openOnly',r.filters.openOnly?'1':'0'); p.set('review',r.filters.review); }
  if (state.holdingId) { p.set('holding', state.holdingId); p.set('panel', state.panel ?? 'detail');if(state.releaseId)p.set('release',state.releaseId); }
  return `?${p.toString()}`;
}
