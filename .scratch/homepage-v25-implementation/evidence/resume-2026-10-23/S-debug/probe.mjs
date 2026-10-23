import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const output = path.dirname(new URL(import.meta.url).pathname);
const source = 'app/lib/reviews/homepage-v25-state.ts';
const m = await import(pathToFileURL(path.join(root, source)).href);
const copy = value => JSON.parse(JSON.stringify(value));
const hash = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
const initial = m.createHomepageState({ live: true, market: 'all', accounts: ['*'], rangeMode: 'all' });
const draft = { ...copy(initial.draft), attachments: { categories: ['long'], openOnly: true, pendingReview: false } };
const waiting = m.beginHomepageApply(initial, draft, 1000);
const applied = m.applyHomepageResult(waiting, { generation: waiting.request.generation, scopeKey: waiting.request.scopeKey, ok: true, applied: draft });
const encoded = m.encodeHomepageSnapshot(applied.snapshot);
// This Map models the bytes passed across a storage boundary. It is not browser evidence.
const modeledStorage = new Map([['snapshot', encoded]]);
const decoded = m.decodeHomepageSnapshot(modeledStorage.get('snapshot'));
const { attachments, ...identityAndRange } = applied.applied;
// Diagnostic-only counterfactual: one boundary projection, no product mutation.
const projectedSnapshot = { ...copy(applied.snapshot), scope: copy(identityAndRange), attachments: copy(attachments) };
const projectedDecoded = m.decodeHomepageSnapshot(m.encodeHomepageSnapshot(projectedSnapshot));

const marker = 'S_DEBUG_SYNTHETIC_BUSINESS_ROW';
const nestedLeakage = ['holdings', 'period', 'contribution', 'history', 'search', 'returnState'].map(field => {
  const candidate = copy(initial.snapshot);
  candidate[field].businessRows = [{ marker }];
  const serialized = m.encodeHomepageSnapshot(candidate);
  return { field, serializedContainsBusinessRows: serialized.includes(marker), decoderAcceptsEncoderOutput: m.decodeHomepageSnapshot(serialized) !== null };
});
const guardedFields = ['scope', 'attachments'].map(field => {
  const candidate = copy(initial.snapshot);
  candidate[field].businessRows = [{ marker }];
  const serialized = m.encodeHomepageSnapshot(candidate);
  return { field, serializedContainsBusinessRows: serialized.includes(marker), decoderAcceptsEncoderOutput: m.decodeHomepageSnapshot(serialized) !== null };
});
const chartModes = ['period-pnl', 'cumulative-pnl', 'win-rate', 'round-count'].map(chartMode => {
  const candidate = copy(initial.snapshot);
  candidate.history.chartMode = chartMode;
  return { chartMode, decoderAcceptsEncoderOutput: m.decodeHomepageSnapshot(m.encodeHomepageSnapshot(candidate)) !== null };
});
const contributionOpenOnly = copy(initial.snapshot);
contributionOpenOnly.contribution.currentOpenOnly = true;
const contradictoryContribution = copy(initial.snapshot);
contradictoryContribution.contribution.selectedMarket = 'hk';
contradictoryContribution.contribution.currentMarket = 'a';
contradictoryContribution.contribution.mode = 'current';
const malformedHistory = copy(initial.snapshot);
malformedHistory.history = { from: '2026-02-31', to: '2025-01-01', year: 'not-a-year' };
const negativeScroll = copy(initial.snapshot);
negativeScroll.scrollTop = -50;
negativeScroll.search.resultsScrollTop = -20;

const allUrl = m.serializeHomepageNavigation(initial.applied);
const urlCases = [
  { name: 'all sentinel without catalog', url: allUrl, options: {} },
  { name: 'all sentinel with real account catalog', url: allUrl, options: { allowedAccounts: ['broker-a', 'broker-b'] } },
  { name: 'known concrete account', url: '/trades?scope=live&accounts=broker-a&rangeMode=all', options: { allowedAccounts: ['broker-a'] } },
  { name: 'unknown concrete account', url: '/trades?scope=live&accounts=unknown&rangeMode=all', options: { allowedAccounts: ['broker-a'] } },
  { name: 'all mixed with concrete account', url: '/trades?scope=live&accounts=*,broker-a&rangeMode=all', options: { allowedAccounts: ['broker-a'] } },
  { name: 'invalid calendar date', url: '/trades?scope=live&accounts=broker-a&date=2026-02-31', options: { allowedAccounts: ['broker-a'] } },
  { name: 'queue entry rejected', url: '/trades?scope=live&accounts=broker-a&queue=pending', options: { allowedAccounts: ['broker-a'] } },
].map(item => ({ ...item, result: m.parseHomepageNavigation(item.url, item.options) }));

const reordered = { rangeMode: draft.rangeMode, accounts: copy(draft.accounts), market: draft.market, live: true, attachments: copy(draft.attachments) };
const reorderedResult = m.applyHomepageResult(waiting, { generation: waiting.request.generation, scopeKey: waiting.request.scopeKey, ok: true, applied: reordered });
const failed = m.applyHomepageResult(waiting, { generation: waiting.request.generation, scopeKey: waiting.request.scopeKey, ok: false, error: 'network-error' });
const successAfterFailure = m.applyHomepageResult(failed, { generation: waiting.request.generation, scopeKey: waiting.request.scopeKey, ok: true, applied: draft });
const identityChanged = m.changeHomepageIdentity(waiting, { live: true, market: 'hk', accounts: ['broker-hk'], rangeMode: 'all' });

const relativeSources = [
  source, 'app/lib/reviews/homepage-v25-state.test.ts',
  'app/lib/reviews/dashboard-browse-preferences.ts', 'app/components/library/library-browse-state.ts',
  'app/components/trade-review-workspace.tsx', 'app/components/dashboard/review-dashboard.tsx',
  'app/lib/reviews/trading-room-pending.ts', 'app/page.tsx',
  'docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md',
  '.scratch/homepage-v25-implementation/evidence/S/coordinator-round3.mjs',
];
const beforeHashes = Object.fromEntries(relativeSources.map(file => [file, hash(file)]));
const original = spawnSync(process.execPath, ['.scratch/homepage-v25-implementation/evidence/S/coordinator-round3.mjs'], { cwd: root, encoding: 'utf8' });
fs.writeFileSync(path.join(output, 'original-six.stdout.txt'), original.stdout);
fs.writeFileSync(path.join(output, 'original-six.stderr.txt'), original.stderr);
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const observation = {
  diagnosticOnly: true, node: process.version, cwd: root, head, sourceHashes: beforeHashes,
  originalReproduction: { exitStatus: original.status, stdoutFile: 'original-six.stdout.txt', stderrFile: 'original-six.stderr.txt' },
  atomicApplyTrace: {
    initial: { applied: initial.applied, snapshot: initial.snapshot },
    draft, request: waiting.request,
    afterSuccess: { applied: applied.applied, snapshotScope: applied.snapshot.scope, snapshotAttachments: applied.snapshot.attachments },
    decodeRawSnapshot: m.decodeHomepageSnapshot(JSON.stringify(applied.snapshot)),
    encoderOutput: JSON.parse(encoded), modeledStorageBytes: encoded.length,
    decodedFromModeledStorage: decoded,
    counterfactualProjection: { scope: projectedSnapshot.scope, attachments: projectedSnapshot.attachments, restoredAttachments: projectedDecoded?.attachments ?? null },
  },
  nestedLeakage, guardedFields, chartModes,
  designState: {
    historyKeys: Object.keys(initial.snapshot.history),
    contributionKeys: Object.keys(initial.snapshot.contribution),
    contributionLocalOpenOnlyRestores: m.decodeHomepageSnapshot(m.encodeHomepageSnapshot(contributionOpenOnly)) !== null,
    contradictoryContributionAccepted: m.decodeHomepageSnapshot(m.encodeHomepageSnapshot(contradictoryContribution)) !== null,
    malformedHistoryAccepted: m.decodeHomepageSnapshot(m.encodeHomepageSnapshot(malformedHistory)) !== null,
    negativeScrollAccepted: m.decodeHomepageSnapshot(m.encodeHomepageSnapshot(negativeScroll)) !== null,
  },
  urlCases,
  orderSensitivity: {
    originalScopeKey: m.homepageScopeKey(initial.snapshot.scope),
    reorderedScopeKey: m.homepageScopeKey({ rangeMode: 'all', accounts: ['*'], market: 'all', live: true }),
    resultError: reorderedResult.error, accepted: reorderedResult.request === null,
  },
  requestLifecycle: {
    failed: { error: failed.error, requestStillActive: failed.request !== null },
    sameGenerationSuccessAfterFailureAccepted: successAfterFailure.request === null,
    identityChange: { draft: identityChanged.draft, applied: identityChanged.applied, snapshotScope: identityChanged.snapshot.scope, request: identityChanged.request },
  },
  allReadSourcesUnchanged: relativeSources.every(file => hash(file) === beforeHashes[file]),
};
fs.writeFileSync(path.join(output, 'observations.json'), JSON.stringify(observation, null, 2) + '\n');
console.log(JSON.stringify({ originalExitStatus: original.status, unchanged: observation.allReadSourcesUnchanged, snapshotAttachments: decoded?.attachments, nestedLeaks: nestedLeakage.filter(item => item.serializedContainsBusinessRows).length, unsupportedChartModes: chartModes.filter(item => !item.decoderAcceptsEncoderOutput).length, scopeOrderRejected: reorderedResult.error, output: path.join(output, 'observations.json') }, null, 2));
