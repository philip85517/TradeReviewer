import type { PreviewLocation, ScenarioId } from './contracts';
import { validateDateRange } from './practice-date-range';
const scenarios: ScenarioId[] = ['reference','pagination','empty','slow','retry','stale','not-found','version-expired','extreme','explicit-end-price'];
export function decodePreviewLocation(search: string): PreviewLocation {
  const p = new URLSearchParams(search); const scenario = p.get('scenario') as ScenarioId;
  const page = p.get('page') ?? ''; const n = Number(page);
  const practiceId = p.get('practice'); const revisionId = p.get('revision'); const practiceVersion = p.get('version');
  return {scenario: scenarios.includes(scenario) ? scenario : 'reference', query: {from:p.get('from') ?? '2026-10-15',to:p.get('to') ?? '2026-10-19',market:p.get('market') ?? 'all',accountId:p.get('account') ?? 'all',search:p.get('search') ?? '',sort:p.get('sort') === 'date-desc' ? 'date-desc' : 'date-asc',pageIndex:/^\d+$/.test(page) && Number.isSafeInteger(n) && n > 0 ? n : 1,pageSize:6}, ...(practiceId ? {detail: revisionId && practiceVersion ? {practiceId, revisionId, practiceVersion} : {practiceId}} : {})};
}
export function encodePreviewLocation(location: PreviewLocation): string {
 const q=location.query; const p=new URLSearchParams({scenario:location.scenario,from:q.from,to:q.to,market:q.market,account:q.accountId,search:q.search,sort:q.sort,page:String(q.pageIndex)});
 if(location.detail) { p.set('practice',location.detail.practiceId); if ('revisionId' in location.detail) {p.set('revision',location.detail.revisionId); p.set('version',location.detail.practiceVersion);} } return `?${p.toString()}`;
}
export function validatePreviewLocation(location: PreviewLocation): string | null { return validateDateRange(location.query); }
