import * as s from '../../../../app/lib/reviews/homepage-v25-state.ts';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const initial = s.createHomepageState({live:true,market:'all',accounts:['*'],rangeMode:'all'});
const started = s.beginHomepageApply(initial,{...initial.draft,attachments:{categories:['long'],openOnly:true,pendingReview:false}});
const applied = s.applyHomepageResult(started,{generation:started.request.generation,scopeKey:started.request.scopeKey,ok:true,applied:started.draft});
const restored = s.decodeHomepageSnapshot(s.encodeHomepageSnapshot(applied.snapshot));
const nested = structuredClone(initial.snapshot); nested.holdings.businessRows = [{quantity:'123'}];
const checks = {
  appliedAttachmentsSurviveSnapshot: JSON.stringify(restored?.attachments) === JSON.stringify(applied.applied.attachments),
  snapshotScopeHasNoAttachments: !Object.hasOwn(applied.snapshot.scope,'attachments'),
  nestedBusinessDoesNotEnterSerialization: !s.encodeHomepageSnapshot(nested).includes('businessRows'),
  explicitAllAccountsWorksWithKnownAccountList: s.parseHomepageNavigation(s.serializeHomepageNavigation(initial.applied),{allowedAccounts:['real-account']}).ok,
  historicalChartModeRepresented: Object.hasOwn(initial.snapshot.history,'chartMode'),
  illegalDateRejected: s.parseHomepageNavigation('/trades?scope=live&market=all&accounts=real&rangeMode=custom&from=2026-99-99&to=2026-12-31').ok === false,
};
console.log(JSON.stringify({checks,observed:{appliedAttachments:applied.applied.attachments,snapshotAttachments:restored?.attachments,scopeKeys:Object.keys(applied.snapshot.scope),historyKeys:Object.keys(initial.snapshot.history)},sha256:createHash('sha256').update(readFileSync(new URL('../../../../app/lib/reviews/homepage-v25-state.ts',import.meta.url))).digest('hex')},null,2));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
