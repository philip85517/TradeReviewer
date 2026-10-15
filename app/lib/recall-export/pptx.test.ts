import { describe, expect, it } from 'vitest';
import type { RecallDocument, RecallSnapshot } from '../recall/types';
import { createRecallPptxManifest } from './pptx-manifest';
import { createRecallPptxBlob, paginateRecallPptxRows } from './pptx';
import JSZip from 'jszip';
import { buildTradeEpisodes } from '../trades/episodes';
import { canonicalRecallJson, captureRecallExecutionEvidence } from '../recall/retained-bundles';
import { sha256 } from '../recall/retained-digest';
import { replayExecutionAt } from '../import/statement-evidence';
import { calculateRecallActualMetrics } from '../recall/actual-metrics';
import type { RecallPlanVersion } from '../recall/types';
import type { NormalizedDrawing } from '../chart/drawings';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function snapshot(id: string, phase: RecallSnapshot['phase']): RecallSnapshot {
    return { id, phase, decisionId: 'global', timeframe: '1D', cursor: '2026-01-01', executionCursor: '2026-01-01', candles: [], drawings: [], imageDataUrl: PNG, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
}
function document(): RecallDocument {
    return { version: 1, episodeId: 'episode', revision: 3, decisions: [], snapshots: [snapshot('pre', 'pre-entry'), snapshot('post', 'post-review')],
        working: { drawings: [], timeframe: '1D', cursor: '2026-01-01', executionCursor: '2026-01-01', selectedDecisionId: null }, status: 'in-progress', updatedAt: '2026-01-01' };
}
function textDrawing(id: string, text: string): NormalizedDrawing {
    return { version: 2, id, episodeId: 'episode', name: 'text', tool: 'text', anchors: [{ time: '2026-01-01', price: 56 }], style: { color: '#fff', lineWidth: 1, opacity: 1 },
        text, textRevision: 1, recallOwnerId: 'owner', zIndex: 0, hidden: false, locked: false, visibleOn: 'all', stage: 'post-review', createdAtCursor: '2026-01-01' };
}
function frozenDocument() {
    const input = document(); input.snapshots.splice(1, 0, snapshot('hold', 'holding'));
    const instrument = { id: 'US:TEST', symbol: '测/试', name: '测试', market: 'US', currency: 'USD' };
    const episode = buildTradeEpisodes([
        { id: 'buy', side: 'buy' as const, quantity: '1000', price: '56', fee: '20', executedAt: '2026-01-01' },
        { id: 'exit1', side: 'sell' as const, quantity: '600', price: '64', fee: '12', executedAt: '2026-01-02' },
        { id: 'exit2', side: 'sell' as const, quantity: '400', price: '61', fee: '8', executedAt: '2026-01-03' },
    ].map(fill => ({ ...fill, accountId: 'account', accountLabel: 'Test', instrument, source: { platform: 'test', row: 0 } })))[0];
    input.episodeId = episode.id;
    input.decisions = episode.executions.map(fill => ({ id: `decision-${fill.id}`, executionIds: [fill.id] }));
    const plan: RecallPlanVersion = { id: 'plan-version', planId: 'plan', decisionId: 'decision-buy', kind: 'initial',
        input: { direction: 'long', currency: 'USD', priceBasis: 'raw', entry: '56', initialStop: '52', targets: [{ id: 'target', price: '68', quantity: null, ratio: null }],
            sizeInputMode: 'quantity', sizeInputValue: '1000', resolvedQuantity: '1000', quantityUnit: 'share', capital: { amount: '200000', currency: 'USD', asOf: '2026-01-01', source: 'manual-reference' } },
        recordedPhase: 'pre-entry', source: 'retrospective', recordedAt: '2026-01-01', retainedAt: '2026-01-01', knowledgeCutoff: { cursor: '2026-01-01', executionCursor: 'buy' }, hasSeenFuture: false };
    const baseline = { id: 'risk', scope: 'decision' as const, decisionId: 'decision-buy', planVersionId: 'plan-version', amount: '4000', currency: 'USD', method: 'planned-price-risk' as const, methodVersion: 'risk-v1' as const, frozenAt: '2026-01-01' };
    input.plans = { drafts: [structuredClone(plan)], versions: [plan], riskBaselines: [baseline] };
    input.retainedBundles = input.snapshots.map((snap, index) => {
        snap.retainedBundleId = `bundle-${snap.id}`; snap.cursor = `2026-01-0${index + 2}`; snap.executionCursor = index === 0 ? 'buy' : index === 1 ? 'exit1' : 'exit2';
        const evidence = captureRecallExecutionEvidence(episode);
        const bundle = { id: snap.retainedBundleId, snapshotId: snap.id, documentRevision: index + 1, retainedAt: snap.cursor, executionEvidence: evidence, decisions: input.decisions,
            captureContext: { phase: snap.phase, cursor: snap.cursor, executionCursor: snap.executionCursor, timeframe: snap.timeframe }, planVersionIds: [plan.id], riskBaselineIds: [baseline.id] };
        return { ...bundle, actualMetrics: calculateRecallActualMetrics({ episode, decisions: bundle.decisions, planVersions: [plan], riskBaselines: [baseline], context: { phase: snap.phase!, cursor: snap.cursor, executionCursor: snap.executionCursor }, source: { documentRevision: bundle.documentRevision, evidenceDigest: evidence.digest, bundleId: bundle.id, computedAt: snap.cursor } }) };
    });
    return input;
}
async function unzip(blob: Blob) {
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(blob); });
    return JSZip.loadAsync(buffer);
}
function refreshEvidenceDigest(bundle: NonNullable<RecallDocument['retainedBundles']>[number]) {
    bundle.executionEvidence.digest = sha256(canonicalRecallJson(bundle.executionEvidence.payload));
}
describe('PPTX frozen export', () => {
    it('declares only package parts that exist in the generated multi-slide presentation', async () => {
        const archive = await unzip(await createRecallPptxBlob(createRecallPptxManifest(frozenDocument())));
        const xml = await archive.file('[Content_Types].xml')!.async('string');
        const overrides = new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('Override');
        expect(overrides.length).toBeGreaterThan(3);
        for (const override of Array.from(overrides)) {
            const partName = override.getAttribute('PartName')!;
            expect(archive.file(partName.replace(/^\//, '')), partName).not.toBeNull();
        }
        expect(archive.file('ppt/slideMasters/slideMaster1.xml')).not.toBeNull();
    });
    it('preserves stage images and explicitly marks missing stages and legacy summary', () => {
        const input = document(); const before = JSON.stringify(input);
        const manifest = createRecallPptxManifest(input, { generatedAt: '2026-01-02' });
        expect(manifest.stages.map(stage => stage.snapshot?.id ?? null)).toEqual(['pre', null, 'post']);
        expect(manifest.stages[0].snapshot?.imageDataUrl).toBe(PNG);
        expect(manifest.stages[0].bundle).toBeNull();
        expect(manifest.summary.bundle).toBeNull();
        expect(manifest.summary.rows.flat().join(' ')).toContain('缺少已留存全局版本组合');
        expect(JSON.stringify(input)).toBe(before);
        expect(Object.isFrozen(manifest)).toBe(true);
    });
    it('keeps each selected stage bundle and the global summary independent from working drafts', () => {
        const input = frozenDocument(); input.plans!.drafts[0].input.entry = '999';
        const manifest = createRecallPptxManifest(input);
        expect(manifest.stages.map(stage => stage.bundle?.id)).toEqual(['bundle-pre', 'bundle-hold', 'bundle-post']);
        expect(manifest.summary.bundle?.id).toBe('bundle-post');
        const summary = manifest.summary.rows.flat().join(' ');
        expect(summary).toContain('6760 USD'); expect(summary).toContain('1.69 R'); expect(summary).toContain('4000 USD'); expect(summary).toContain('建仓 1000'); expect(summary).not.toContain('999');
        input.retainedBundles![2].actualMetrics!.metrics.netPnl.value = '888';
        expect(manifest.summary.bundle?.actualMetrics?.metrics.netPnl.value).toBe('6760');
    });
    it('exports only frozen manual evaluation tags and evidence identifiers', () => {
        const input = frozenDocument();
        input.exitEvaluations = { drafts: [], associations: [], versions: [{ id: 'evaluation-version', evaluationId: 'evaluation', decisionId: 'decision-exit1', earlyExit: 'yes', adherence: 'deviated', reason: 'emotion', reasonDetail: '保留的说明', comparedPlanVersionId: 'plan-version', comparedTargetId: 'target', tags: ['analysis', 'exit'], tagDictionaryVersion: 'manual-v1', evidence: [{ kind: 'text', drawingId: 'text-1', textRevision: 2, ownerId: 'decision-exit1' }], source: 'manual-retrospective', recordedBy: 'user', recordedPhase: 'post-review', recordedAt: '2026-01-04', retainedAt: '2026-01-04', knowledgeCutoff: { cursor: '2026-01-04', executionCursor: 'exit2' }, hasSeenFuture: true, executionIds: ['exit1'] }] };
        input.retainedBundles![2].evaluationRevisionIds = ['evaluation-version'];
        const details = createRecallPptxManifest(input).summary.details.flat().join(' ');
        expect(details).toContain('标签 判断、退出'); expect(details).toContain('text-1'); expect(details).toContain('修订 2'); expect(details).toContain('保留的说明');
    });
    it('exports only frozen episode manual labels and their evidence pointers', () => {
        const input = frozenDocument();
        const version = { id: 'manual-version', evaluationId: 'manual', target: { scope: 'episode' as const, decisionId: null }, tags: ['position' as const, 'analysis' as const], tagDictionaryVersion: 'manual-v1' as const, evidence: [{ kind: 'snapshot' as const, snapshotId: 'post' }], source: 'manual-retrospective' as const, recordedBy: 'user' as const, recordedPhase: 'post-review' as const, recordedAt: '2026-01-04', knowledgeCutoff: { cursor: '2026-01-04', executionCursor: 'exit2' }, hasSeenFuture: true, retainedAt: '2026-01-04', executionIds: ['buy', 'exit1', 'exit2'] };
        input.manualEvaluations = { drafts: [], versions: [version], associations: [{ evaluationId: 'manual', decisionId: null, status: 'linked' }] };
        input.retainedBundles![2].manualEvaluationRevisionIds = [version.id];
        const details = createRecallPptxManifest(input).summary.details.flat().join(' ');
        expect(details).toContain('回合人工标签'); expect(details).toContain('仓位、判断'); expect(details).toContain('快照 post');
    });
    it('honors an explicit global bundle or formal source without substituting current draft data', () => {
        const input = frozenDocument();
        const early = createRecallPptxManifest(input, { globalBundleId: 'bundle-pre' });
        expect(early.summary.bundle?.id).toBe('bundle-pre'); expect(early.summary.rows.flat().join(' ')).not.toContain('6760');
        input.lastCompleted = { ...structuredClone(input), status: 'completed', completedAt: '2026-01-05' };
        input.retainedBundles![2].actualMetrics!.metrics.netPnl.value = '999';
        expect(createRecallPptxManifest(input, { source: 'completed' }).summary.rows.flat().join(' ')).toContain('6760');
        expect(() => createRecallPptxManifest(input, { globalBundleId: 'missing' })).toThrow('不可用');
    });
    it('selects the surviving frozen correction even when its risk inputs are incomplete', () => {
        const input = frozenDocument(); const original = input.plans!.versions[0];
        input.plans!.versions.push({ ...structuredClone(original), id: 'correction', kind: 'correction', parentVersionId: original.id, input: { ...structuredClone(original.input), entry: '60', initialStop: null } });
        const bundle = input.retainedBundles![2]; bundle.planVersionIds.push('correction'); bundle.actualMetrics!.denominator = null;
        const manifest = createRecallPptxManifest(input);
        expect(manifest.summary.rows.find(row => row[0] === '入场 / 止损')?.[1]).toBe('60 / 未记录 USD');
    });
    it('does not reveal actual direction from the full episode on an early or untrusted capture', () => {
        const input = frozenDocument();
        const early = createRecallPptxManifest(input, { globalBundleId: 'bundle-pre' });
        expect(early.summary.rows[0][2]).toContain('尚未揭示');
        input.retainedBundles![2].executionEvidence.payload.episode.directionKnown = false;
        expect(createRecallPptxManifest(input).summary.rows[0][2]).toContain('方向待确认');
    });
    it('chooses one retained bundle by visible execution count before retained time', () => {
        const input = frozenDocument();
        const sourceSnapshot = input.snapshots.find(item => item.id === 'post')!;
        const sourceBundle = input.retainedBundles!.find(item => item.id === 'bundle-post')!;
        const laterS0 = structuredClone(sourceSnapshot);
        const laterBundle = structuredClone(sourceBundle);
        laterS0.id = 's0-later';
        laterS0.phase = 'pre-entry';
        laterS0.retainedBundleId = 'bundle-s0-later';
        laterS0.cursor = '2025-12-31T23:59:59.999Z';
        laterS0.executionCursor = 'buy';
        laterS0.updatedAt = laterS0.cursor;
        laterBundle.id = 'bundle-s0-later';
        laterBundle.snapshotId = laterS0.id;
        laterBundle.retainedAt = '2026-01-10T00:00:00.000Z';
        laterBundle.documentRevision = 2;
        laterBundle.captureContext = {
            ...laterBundle.captureContext,
            phase: laterS0.phase,
            cursor: laterS0.cursor,
            executionCursor: laterS0.executionCursor,
        };
        input.snapshots.push(laterS0);
        input.retainedBundles!.push(laterBundle);

        const manifest = createRecallPptxManifest(input);
        expect(manifest.executionFacts.snapshotId).toBe('post');
        expect(manifest.executionFacts.executionIds).toEqual(['buy', 'exit1', 'exit2']);
        expect(manifest.executionFacts.warnings).toEqual([]);
    });
    it('keeps nonglobal S0/S1/S2 facts independent from the missing global summary', () => {
        const input = frozenDocument();
        for (const snap of input.snapshots) snap.decisionId = 'decision-buy';
        const pre = input.snapshots.find(item => item.id === 'pre')!;
        const preBundle = input.retainedBundles!.find(item => item.id === 'bundle-pre')!;
        pre.executionCursor = '__recall_before_first_execution__';
        preBundle.captureContext = { ...preBundle.captureContext, executionCursor: pre.executionCursor };
        const hold = input.snapshots.find(item => item.id === 'hold')!;
        const holdBundle = input.retainedBundles!.find(item => item.id === 'bundle-hold')!;
        hold.executionCursor = 'buy';
        holdBundle.captureContext = { ...holdBundle.captureContext, executionCursor: hold.executionCursor };

        const manifest = createRecallPptxManifest(input);

        expect(manifest.summary.bundle).toBeNull();
        expect(manifest.summary.rows.flat().join(' ')).toContain('缺少已留存全局版本组合');
        expect(manifest.executionFacts.snapshotId).toBe('post');
        expect(manifest.executionFacts.executionIds).toEqual(['buy', 'exit1', 'exit2']);
        expect(manifest.executionFacts.rows.every(row => row.length === 5)).toBe(true);
        expect(manifest.executionFacts.rows.map(row => [row[1], row[4]])).toEqual([
            ['买入', '20 USD'], ['卖出', '12 USD'], ['卖出', '8 USD'],
        ]);

        const onlyS0 = structuredClone(input);
        onlyS0.snapshots = onlyS0.snapshots.filter(item => item.id === 'pre');
        onlyS0.retainedBundles = onlyS0.retainedBundles!.filter(item => item.id === 'bundle-pre');
        expect(createRecallPptxManifest(onlyS0).executionFacts.executionIds).toEqual([]);

        const onlyS1 = structuredClone(input);
        onlyS1.snapshots = onlyS1.snapshots.filter(item => item.id === 'hold');
        onlyS1.retainedBundles = onlyS1.retainedBundles!.filter(item => item.id === 'bundle-hold');
        expect(createRecallPptxManifest(onlyS1).executionFacts.executionIds).toEqual(['buy']);
    });
    it('freezes completed execution facts and filters future payload from provenance notes', async () => {
        const input = frozenDocument();
        input.lastCompleted = { ...structuredClone(input), status: 'completed', completedAt: '2026-01-05' };
        const completed = createRecallPptxManifest(input, { source: 'completed' });
        const completedRows = structuredClone(completed.executionFacts.rows);
        input.lastCompleted.retainedBundles![2].executionEvidence.payload.executions[0].fee = '999';
        expect(completed.executionFacts.rows).toEqual(completedRows);

        const cutoffInput = frozenDocument();
        const snapshot = cutoffInput.snapshots.find(item => item.id === 'post')!;
        const bundle = cutoffInput.retainedBundles!.find(item => item.id === 'bundle-post')!;
        snapshot.cursor = '2026-01-02';
        snapshot.executionCursor = 'exit1';
        bundle.captureContext = { ...bundle.captureContext, cursor: snapshot.cursor, executionCursor: snapshot.executionCursor };
        const cutoffManifest = createRecallPptxManifest(cutoffInput);
        expect(cutoffManifest.executionFacts.executionIds).toEqual(['buy', 'exit1']);
        const archive = await unzip(await createRecallPptxBlob(cutoffManifest));
        const notes = (await Promise.all(Object.keys(archive.files)
            .filter(path => path.includes('notesSlides/') && path.endsWith('.xml'))
            .map(path => archive.file(path)!.async('string')))).join('\n');
        expect(notes).toContain('executionIds');
        expect(notes).not.toContain('exit2');
    });
    it('rejects invalid snapshot binding and evidence digests instead of exporting their facts', () => {
        const badBinding = frozenDocument();
        badBinding.retainedBundles!.forEach(bundle => { bundle.snapshotId = 'other-snapshot'; });
        const bindingManifest = createRecallPptxManifest(badBinding);
        expect(bindingManifest.executionFacts.snapshotId).toBeNull();
        expect(bindingManifest.executionFacts.warnings).toContain('缺少有效已留存成交事实');

        const badDigest = frozenDocument();
        badDigest.retainedBundles!.forEach(bundle => { bundle.executionEvidence.digest = 'bad-digest'; });
        const digestManifest = createRecallPptxManifest(badDigest);
        expect(digestManifest.executionFacts.snapshotId).toBeNull();
        expect(digestManifest.executionFacts.warnings).toContain('缺少有效已留存成交事实');
    });
    it('uses the allocated fee from a buildTradeEpisodes split instead of raw settlement fees', () => {
        const instrument = { id: 'US:SPLIT', symbol: 'SPLIT', name: 'Split', market: 'US', currency: 'USD' };
        const sourceSettlement = { currency: 'USD', quantity: '150', grossAmount: '9150', netAmount: '9135', fees: { commission: '15' } };
        const episodes = buildTradeEpisodes([
            { id: 'open', side: 'buy' as const, quantity: '100', price: '50', fee: '0', executedAt: '2026-01-01', accountId: 'account', accountLabel: 'Test', instrument, source: { platform: 'test', row: 1, feeStatus: 'reported' as const } },
            { id: 'reverse', side: 'sell' as const, quantity: '150', price: '61', fee: '15', executedAt: '2026-01-02', accountId: 'account', accountLabel: 'Test', instrument, source: { platform: 'test', row: 2, feeStatus: 'reported' as const, settlement: sourceSettlement } },
        ]);
        const closing = episodes.find(episode => episode.executions.some(execution => execution.id === 'reverse:close'))!;
        expect(closing.executions.find(execution => execution.id === 'reverse:close')?.fee).toBe('10');

        const input = frozenDocument();
        input.episodeId = closing.id;
        const snapshot = input.snapshots.find(item => item.id === 'post')!;
        const bundle = input.retainedBundles!.find(item => item.id === 'bundle-post')!;
        const closingExecution = closing.executions.find(execution => execution.id === 'reverse:close')!;
        snapshot.cursor = '2026-01-05';
        snapshot.executionCursor = closingExecution.id;
        bundle.captureContext = { ...bundle.captureContext, cursor: snapshot.cursor, executionCursor: snapshot.executionCursor };
        bundle.executionEvidence = captureRecallExecutionEvidence(closing);

        const manifest = createRecallPptxManifest(input);
        const row = manifest.executionFacts.rows.find(item => item[1] === '卖出');
        expect(row?.[4]).toBe('10 USD');
    });
    it('renders non-finite fees as unknown while preserving reported and unknown zero semantics', () => {
        const invalid = frozenDocument();
        const invalidBundle = invalid.retainedBundles!.find(item => item.id === 'bundle-post')!;
        const invalidExecution = invalidBundle.executionEvidence.payload.executions[0];
        invalidExecution.fee = 'Infinity';
        invalidExecution.source.feeStatus = 'reported';
        refreshEvidenceDigest(invalidBundle);
        expect(createRecallPptxManifest(invalid).executionFacts.rows[0][4]).toBe('未知');

        const reportedZero = frozenDocument();
        const reportedBundle = reportedZero.retainedBundles!.find(item => item.id === 'bundle-post')!;
        reportedBundle.executionEvidence.payload.executions[0].fee = '0';
        reportedBundle.executionEvidence.payload.executions[0].source.feeStatus = 'reported';
        refreshEvidenceDigest(reportedBundle);
        expect(createRecallPptxManifest(reportedZero).executionFacts.rows[0][4]).toBe('0 USD');

        const unknownZero = frozenDocument();
        const unknownBundle = unknownZero.retainedBundles!.find(item => item.id === 'bundle-post')!;
        unknownBundle.executionEvidence.payload.executions[0].fee = '0';
        unknownBundle.executionEvidence.payload.executions[0].source.feeStatus = 'unknown';
        refreshEvidenceDigest(unknownBundle);
        expect(createRecallPptxManifest(unknownZero).executionFacts.rows[0][4]).toBe('未知');
    });
    it('labels date-only execution rows without inventing an intraday time', () => {
        const input = frozenDocument();
        const bundle = input.retainedBundles!.find(item => item.id === 'bundle-post')!;
        const execution = bundle.executionEvidence.payload.executions[0];
        execution.executedAt = '2026-01-03T07:00:00.000Z';
        execution.source.timePrecision = 'date-only';
        execution.source.marketCalendarDate = '2026-01-03';
        refreshEvidenceDigest(bundle);

        const manifest = createRecallPptxManifest(input);
        const row = manifest.executionFacts.rows[manifest.executionFacts.executionIds.indexOf(execution.id)][0];
        expect(row).toContain('2026年01月03日');
        expect(row).toContain('仅日期');
        expect(row).toContain('时刻未提供');
        expect(row).not.toContain('15:00');
    });
    it('uses the canonical source-timezone calendar day for date-only fallback', () => {
        const input = frozenDocument();
        const snapshot = input.snapshots.find(item => item.id === 'post')!;
        const bundle = input.retainedBundles!.find(item => item.id === 'bundle-post')!;
        const execution = bundle.executionEvidence.payload.executions.find(item => item.id === 'buy')!;
        execution.executedAt = '2026-03-17T23:00:00.000Z';
        execution.source = { ...execution.source, timePrecision: 'date-only', sourceTimezone: 'Asia/Tokyo' };
        snapshot.cursor = '2026-03-18T23:59:59.999Z';
        snapshot.executionCursor = execution.id;
        bundle.captureContext = { ...bundle.captureContext, cursor: snapshot.cursor, executionCursor: snapshot.executionCursor };
        refreshEvidenceDigest(bundle);

        expect(replayExecutionAt(execution)).toBe('2026-03-18T23:59:59.999Z');
        const manifest = createRecallPptxManifest(input);
        const row = manifest.executionFacts.rows[manifest.executionFacts.executionIds.indexOf(execution.id)][0];
        expect(row).toBe('2026年03月18日（仅日期；时刻未提供）');

        const explicit = frozenDocument();
        const explicitSnapshot = explicit.snapshots.find(item => item.id === 'post')!;
        const explicitBundle = explicit.retainedBundles!.find(item => item.id === 'bundle-post')!;
        const explicitExecution = explicitBundle.executionEvidence.payload.executions.find(item => item.id === 'buy')!;
        explicitExecution.executedAt = execution.executedAt;
        explicitExecution.source = { ...explicitExecution.source, timePrecision: 'date-only', sourceTimezone: 'Asia/Tokyo', marketCalendarDate: '2026-03-16' };
        explicitSnapshot.cursor = '2026-03-18T23:59:59.999Z';
        explicitSnapshot.executionCursor = explicitExecution.id;
        explicitBundle.captureContext = { ...explicitBundle.captureContext, cursor: explicitSnapshot.cursor, executionCursor: explicitSnapshot.executionCursor };
        refreshEvidenceDigest(explicitBundle);
        const explicitManifest = createRecallPptxManifest(explicit);
        const explicitRow = explicitManifest.executionFacts.rows[explicitManifest.executionFacts.executionIds.indexOf(explicitExecution.id)][0];
        expect(explicitRow).toBe('2026年03月16日（仅日期；时刻未提供）');

        const west = frozenDocument();
        const westSnapshot = west.snapshots.find(item => item.id === 'post')!;
        const westBundle = west.retainedBundles!.find(item => item.id === 'bundle-post')!;
        const westExecution = westBundle.executionEvidence.payload.executions.find(item => item.id === 'buy')!;
        westExecution.executedAt = '2026-03-18T06:00:00.000Z';
        westExecution.source = { ...westExecution.source, timePrecision: 'date-only', sourceTimezone: 'America/Los_Angeles' };
        westSnapshot.cursor = '2026-03-18T23:59:59.999Z';
        westSnapshot.executionCursor = westExecution.id;
        westBundle.captureContext = { ...westBundle.captureContext, cursor: westSnapshot.cursor, executionCursor: westSnapshot.executionCursor };
        refreshEvidenceDigest(westBundle);
        const westManifest = createRecallPptxManifest(west);
        const westRow = westManifest.executionFacts.rows[westManifest.executionFacts.executionIds.indexOf(westExecution.id)][0];
        expect(westRow).toBe('2026年03月17日（仅日期；时刻未提供）');

        const precise = frozenDocument();
        const preciseSnapshot = precise.snapshots.find(item => item.id === 'post')!;
        const preciseBundle = precise.retainedBundles!.find(item => item.id === 'bundle-post')!;
        const preciseExecution = preciseBundle.executionEvidence.payload.executions.find(item => item.id === 'buy')!;
        preciseExecution.executedAt = execution.executedAt;
        preciseExecution.source = { ...preciseExecution.source, timePrecision: 'second', sourceTimezone: 'Asia/Tokyo' };
        preciseSnapshot.cursor = '2026-03-18T23:59:59.999Z';
        preciseSnapshot.executionCursor = preciseExecution.id;
        preciseBundle.captureContext = { ...preciseBundle.captureContext, cursor: preciseSnapshot.cursor, executionCursor: preciseSnapshot.executionCursor };
        refreshEvidenceDigest(preciseBundle);
        const preciseManifest = createRecallPptxManifest(precise);
        const preciseRow = preciseManifest.executionFacts.rows[preciseManifest.executionFacts.executionIds.indexOf(preciseExecution.id)][0];
        expect(preciseRow).toMatch(/^2026年03月18日 \d{2}:\d{2}$/);
        expect(preciseRow).not.toContain('仅日期');
    });
    it('does not reveal a date-only execution before its canonical day boundary', () => {
        const input = frozenDocument();
        for (const snapshot of input.snapshots) {
            const bundle = input.retainedBundles!.find(item => item.id === snapshot.retainedBundleId)!;
            const execution = bundle.executionEvidence.payload.executions.find(item => item.id === 'buy')!;
            bundle.executionEvidence.payload.executions = [execution];
            bundle.executionEvidence.executionIds = [execution.id];
            execution.executedAt = '2026-03-17T23:00:00.000Z';
            execution.source = { ...execution.source, timePrecision: 'date-only', sourceTimezone: 'Asia/Tokyo' };
            snapshot.cursor = '2026-03-18T00:00:00.000Z';
            snapshot.executionCursor = execution.id;
            bundle.captureContext = { ...bundle.captureContext, cursor: snapshot.cursor, executionCursor: snapshot.executionCursor };
            refreshEvidenceDigest(bundle);
        }
        const manifest = createRecallPptxManifest(input);
        expect(manifest.executionFacts.executionIds).toEqual([]);
        expect(manifest.executionFacts.rows).toEqual([]);
        expect(manifest.executionFacts.warnings).toContain('当前双截止下无已揭示成交事实');
    });
    it('generates actual widescreen OOXML with native editable tables and embedded images only', async () => {
        const manifest = createRecallPptxManifest(frozenDocument());
        const zip = await unzip(await createRecallPptxBlob(manifest));
        expect(await zip.file('ppt/presentation.xml')!.async('string')).toContain('cx="12192000" cy="6858000"');
        expect(await zip.file('ppt/slides/slide4.xml')!.async('string')).toContain('<a:tbl>');
        expect(Object.keys(zip.files).filter(path => path.startsWith('ppt/media/') && !path.endsWith('/')).length).toBeGreaterThanOrEqual(1);
        const relationships = await Promise.all(Object.keys(zip.files).filter(path => path.endsWith('.rels')).map(path => zip.file(path)!.async('string')));
        expect(relationships.join('')).not.toContain('TargetMode="External"');
        const notes = await Promise.all(Object.keys(zip.files).filter(path => /ppt\/notesSlides\/notesSlide\d+\.xml$/.test(path)).map(path => zip.file(path)!.async('string')));
        expect(notes.join('')).toContain('TRADEREVIEW_FROZEN_MANIFEST'); expect(notes.join('')).toContain('bundle-post');
    });
    it('deduplicates inherited Text by stable identity while preserving equal independent text and long appendices', async () => {
        const input = frozenDocument(); const text = '中文<&>\u0001长段说明'.repeat(100);
        input.snapshots[0].drawings = [textDrawing('shared', text)];
        input.snapshots[1].drawings = [textDrawing('shared', text), textDrawing('independent', text)];
        const manifest = createRecallPptxManifest(input);
        expect(manifest.texts).toHaveLength(2); expect(manifest.texts[0].snapshotIds).toEqual(['pre', 'hold']);
        const zip = await unzip(await createRecallPptxBlob(manifest));
        const xml = (await Promise.all(Object.keys(zip.files).filter(path => /ppt\/slides\/slide\d+\.xml$/.test(path)).map(path => zip.file(path)!.async('string')))).join('');
        expect(xml).toContain('&lt;'); expect(xml).toContain('&amp;'); expect(xml).not.toContain('\u0001'); expect(xml).toContain('sz="1800"');
        expect(Object.keys(zip.files).filter(path => /ppt\/slides\/slide\d+\.xml$/.test(path)).length).toBeGreaterThan(6);
        const pages = paginateRecallPptxRows([['来源', text]], [3.1, 9.13]);
        expect(pages.flatMap(page => page.rows.map(row => row[1])).join('').replace(/\n/g, '')).toBe(text.replace(/\u0001/g, ''));
        expect(pages.every(page => page.heights.reduce((sum, height) => sum + height, 0) <= 5.05)).toBe(true);
    });
    it('stops on invalid images without modifying the document or producing a partial export', async () => {
        const input = frozenDocument(); input.snapshots[0].imageDataUrl = 'https://app.invalid/image.png';
        const before = JSON.stringify(input);
        await expect(createRecallPptxBlob(createRecallPptxManifest(input))).rejects.toThrow('内嵌 PNG');
        expect(JSON.stringify(input)).toBe(before);
    });
});
