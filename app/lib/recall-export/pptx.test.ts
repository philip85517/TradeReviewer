import { describe, expect, it } from 'vitest';
import type { RecallDocument, RecallSnapshot } from '../recall/types';
import { createRecallPptxManifest } from './pptx-manifest';
import { createRecallPptxBlob, paginateRecallPptxRows } from './pptx';
import JSZip from 'jszip';
import { buildTradeEpisodes } from '../trades/episodes';
import { captureRecallExecutionEvidence } from '../recall/retained-bundles';
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
