import Decimal from 'decimal.js';
import { getRecallStoryboard, STORYBOARD_PHASE_LABELS, STORYBOARD_REASON_LABELS } from '../recall/storyboard';
import { calculateRecallPlan } from '../recall/plans';
import type { RecallDocument, RecallPhase, RecallRetainedBundle, RecallSnapshot } from '../recall/types';
import type { RecallActualMetric } from '../recall/actual-metrics';
import { RecallExportError, selectRecallExportDocument } from './manifest';
import { sha256 } from '../recall/retained-digest';
import type { RecallExportSource } from './types';

export type RecallPptxOptions = { source?: RecallExportSource; generatedAt?: string; globalBundleId?: string };
export type RecallPptxText = { key: string; drawingId: string; revision: string; ownerId: string; text: string; snapshotIds: string[] };
export type RecallPptxStage = { phase: RecallPhase; title: string; snapshot: RecallSnapshot | null; bundle: RecallRetainedBundle | null; warnings: string[] };
export type RecallPptxManifest = {
    version: 1; source: RecallExportSource; documentRevision: number; episodeId: string; generatedAt: string; fileName: string;
    stages: RecallPptxStage[]; texts: RecallPptxText[];
    summary: { snapshotId: string | null; bundle: RecallRetainedBundle | null; rows: string[][]; details: string[][] };
};

/** XML 1.0 text excludes control characters and unpaired surrogates. Content remains editable. */
export function pptxText(value: string): string {
    return Array.from(value).filter(character => {
        const point = character.codePointAt(0)!;
        return point === 9 || point === 10 || point === 13 || point >= 32 && point <= 0xd7ff || point >= 0xe000 && point <= 0xfffd || point >= 0x10000 && point <= 0x10ffff;
    }).join('');
}
function freeze<T>(value: T): T {
    if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
    return value;
}
function acceptedBundle(document: RecallDocument, snapshot: RecallSnapshot) {
    return document.retainedBundles?.find(bundle => bundle.id === snapshot.retainedBundleId && bundle.snapshotId === snapshot.id && bundle.documentRevision > 0) ?? null;
}
export function recallPptxGlobalChoices(input: RecallDocument, source: RecallExportSource = 'draft') {
    const { document } = selectRecallExportDocument(input, source);
    return document.snapshots.filter(snapshot => snapshot.decisionId === 'global').flatMap(snapshot => {
        const bundle = acceptedBundle(document, snapshot);
        return bundle ? [{ snapshotId: snapshot.id, bundleId: bundle.id, retainedAt: bundle.retainedAt, revision: bundle.documentRevision }] : [];
    }).sort((a, b) => b.retainedAt.localeCompare(a.retainedAt) || b.revision - a.revision);
}
const reasons: Record<string, string> = {
    'pre-entry': '成交尚未揭示', 'unknown-fees': '费用待补齐', 'unknown-cost': '成本待补齐', 'unknown-quantity': '数量待核对',
    'price-basis-mismatch': '价格口径不同', 'currency-mismatch': '币种不同，尚未换算', 'missing-initial-risk-baseline': '初始风险未记录',
    'no-exits': '尚无已揭示退出', 'episode-open': '尚未平仓', 'missing-visible-raw-mark': '缺少同口径估值',
    'multiple-opening-decisions-require-prior-episode-budget': '多次建仓，基准待确认', 'no-visible-executions': '尚无已揭示成交',
    'incomparable-plan': '原计划缺失或口径不同', 'unknown-direction': '方向待核对', 'inventory-allocation-unavailable': '期初持仓费用分摊待核对',
    'execution-scope-mismatch': '成交范围不一致', 'unsupported-currency-precision': '币种精度待确认', 'missing-opening-decision': '建仓决策归属待确认',
};
function reasonLabel(reason: string | null) { return reason ? reasons[reason] ?? '来源不完整或无法比较' : '来源不完整'; }
function metric(value: Pick<RecallActualMetric, 'value' | 'reason' | 'currency' | 'unit'> | undefined): string {
    if (!value) return '未留存指标';
    if (value.value === null) return `待核算：${reasonLabel(value.reason)}`;
    if (value.unit === 'ratio') return `${new Decimal(value.value).mul(100).toDecimalPlaces(2).toString()}%`;
    return `${value.value}${value.unit === 'R' ? ' R' : value.currency ? ` ${value.currency}` : ''}`;
}
function decimalProduct(a: string | null | undefined, b: string | null | undefined): string {
    try { return a && b && new Decimal(a).isFinite() && new Decimal(b).isFinite() ? new Decimal(a).mul(b).toString() : '未记录'; } catch { return '未记录'; }
}
function summaryRows(document: RecallDocument, bundle: RecallRetainedBundle | null) {
    if (!bundle) return { rows: [['版本来源', '缺少已留存全局版本组合', '未使用当前草稿填补']], details: [] };
    const selectedPlans = (document.plans?.versions ?? []).filter(plan => bundle.planVersionIds.includes(plan.id));
    const actual = bundle.actualMetrics;
    const superseded = new Set<string>();
    for (const correction of selectedPlans.filter(item => item.kind === 'correction')) {
        let parent = correction.parentVersionId;
        while (parent && !superseded.has(parent)) { superseded.add(parent); parent = selectedPlans.find(item => item.id === parent)?.parentVersionId; }
    }
    const openingSide = bundle.executionEvidence.payload.episode.direction === 'long' ? 'buy' : 'sell';
    const firstOpening = bundle.executionEvidence.payload.executions.find(fill => actual?.executionIds.includes(fill.id) && fill.side === openingSide);
    const openingDecision = firstOpening ? bundle.decisions.find(decision => decision.executionIds.includes(firstOpening.id))?.id : undefined;
    const plan = selectedPlans.find(item => item.id === actual?.denominator?.planVersionId) ?? [...selectedPlans].reverse().find(item =>
        !superseded.has(item.id) && (item.kind === 'initial' || item.kind === 'correction') && (!openingDecision || item.decisionId === openingDecision));
    const p = plan?.input;
    const calculation = p ? calculateRecallPlan(p, plan.kind) : null;
    const m = actual?.metrics;
    const currency = p?.currency ?? '币种未知';
    let ratio = '资金基数未记录';
    try { if (p?.capital?.amount && p.capital.currency === p.currency && new Decimal(p.capital.amount).gt(0) && p.entry && p.resolvedQuantity) ratio = `${new Decimal(p.entry).mul(p.resolvedQuantity).div(p.capital.amount).mul(100).toDecimalPlaces(2)}%`; } catch { /* Missing values are explicit. */ }
    const risk = actual?.denominator;
    const actualDirection = !actual ? '未留存实际方向' : !actual.executionIds.length ? '成交方向尚未揭示' : bundle.executionEvidence.payload.episode.directionKnown === false ? '方向待确认' : openingSide === 'buy' ? '做多' : '做空';
    let openingQuantity = '待核对';
    if (actual && m?.remainingQuantity.value !== null) {
        const openings = bundle.executionEvidence.payload.executions.filter(fill => actual.executionIds.includes(fill.id) && fill.side === openingSide);
        try { if (openings.length) openingQuantity = openings.reduce((total, fill) => total.plus(fill.quantity), new Decimal(0)).toString(); } catch { /* Incomplete captured quantities stay unknown. */ }
    }
    const evaluations = (document.exitEvaluations?.versions ?? []).filter(item => bundle.evaluationRevisionIds?.includes(item.id));
    const label = { yes: '是', no: '否', uncertain: '不确定', 'as-planned': '按计划', deviated: '偏离计划', 'no-plan': '无计划', 'planned-partial': '计划内分批', 'structure-invalid': '结构失效', 'risk-reduction': '风险收缩', emotion: '情绪影响', 'capital-need': '资金需求', other: '其他' };
    const rows = [
        ['方向 / 价格口径', `${p?.direction === 'long' ? '做多' : p?.direction === 'short' ? '做空' : '未记录'} / ${p?.priceBasis === 'raw' ? '原始价' : p?.priceBasis === 'adjusted' ? '复权价' : '未知'}`, actualDirection],
        ['入场 / 止损', `${p?.entry ?? '未记录'} / ${p?.initialStop ?? '未记录'} ${currency}`, `入场均价 ${metric(m?.averageEntryPrice)}`],
        ['目标 / 退出均价', p?.targets.map(target => `${target.price ?? '未记录'}${target.quantity ? ` × ${target.quantity}` : target.ratio ? ` / 比例 ${target.ratio}` : ''}`).join('；') || '未记录', metric(m?.weightedExitPrice)],
        ['数量 / 名义金额', `${p?.resolvedQuantity ?? '未记录'} / ${decimalProduct(p?.entry, p?.resolvedQuantity)} ${currency}`, `建仓 ${openingQuantity}；剩余 ${metric(m?.remainingQuantity)}`],
        ['资金基数 / 仓位', p?.capital ? `${p.capital.amount ?? '金额未知'} ${p.capital.currency ?? '币种未知'} / ${ratio}` : '未记录', p?.capital ? `${p.capital.source === 'manual-reference' ? '手填参考资金' : '账户快照'} / ${p.capital.asOf ?? '时点未知'}` : '无资金基数'],
        ['初始风险 / R', risk ? `${risk.amount} ${risk.currency} / ${risk.method === 'fixed-budget' ? '预算 R' : '价格风险 R'}` : '未确认冻结风险基准', `实际 ${metric(m?.actualR)}`],
        ['预期 R / 兑现比例', calculation ? metric(calculation.expectedR) : '未记录', `净额 / 计划毛收益 ${metric(m?.targetRealization)}`],
        ['毛额 / 费用 / 净额', '原币口径；费用只扣一次', `${metric(m?.realizedGross)} / ${metric(m?.totalFees)} / ${metric(m?.netPnl)}`],
        ['执行偏差', '正入场偏差表示更不利', `${metric(m?.entryPriceDeviation)} / 数量 ${metric(m?.quantityDeviation)}`],
        ['提前退出 / 符合度', '人工事后评价', evaluations.length ? evaluations.map(e => `${label[e.earlyExit!] ?? '未评价'} / ${label[e.adherence!] ?? '未评价'}`).join('；') : '未留存评价'],
    ];
    const details: string[][] = [];
    if (!actual) details.push(['指标来源', '旧版成果未留存 actual-v1 指标；不使用最新成交或草稿重算']);
    for (const exit of actual?.exitAllocations ?? []) {
        const fill = bundle.executionEvidence.payload.executions.find(item => item.id === exit.executionId);
        details.push([`退出 ${fill?.executedAt ?? exit.executionId}`, `数量 ${exit.quantity}；价格 ${fill?.price ?? '未知'}；分配入场费 ${metric(exit.entryFee)}；退出费 ${metric(exit.exitFee)}；净额 ${metric(exit.netPnl)}`]);
    }
    const tags = { analysis: '判断', entry: '入场', exit: '退出', position: '仓位' };
    for (const e of evaluations) {
        details.push([`评价 ${e.decisionId}`, `提前退出 ${label[e.earlyExit!] ?? '未评价'}；${label[e.adherence!] ?? '未评价'}；原因 ${label[e.reason!] ?? '未记录'}${e.reasonDetail ? `：${e.reasonDetail}` : ''}；标签 ${e.tags.map(tag => tags[tag]).join('、') || '未标记'}`]);
        for (const evidence of e.evidence) details.push(['评价证据', evidence.kind === 'text' ? `Text ${evidence.drawingId}；修订 ${evidence.textRevision}；归属 ${evidence.ownerId}` : `快照 ${evidence.snapshotId}`]);
    }
    const manualEvaluations = (document.manualEvaluations?.versions ?? [])
        .filter(evaluation => bundle.manualEvaluationRevisionIds?.includes(evaluation.id));
    const manualLabels = { position: '仓位', entry: '入场', analysis: '判断' };
    for (const evaluation of manualEvaluations) {
        details.push(['回合人工标签', `标签 ${evaluation.tags.map(tag => manualLabels[tag]).join('、') || '未标记'}；词典 ${evaluation.tagDictionaryVersion}`]);
        for (const evidence of evaluation.evidence) {
            details.push(['人工标签证据', evidence.kind === 'text'
                ? `Text ${evidence.drawingId}；修订 ${evidence.textRevision}；归属 ${evidence.ownerId}`
                : `快照 ${evidence.snapshotId}`]);
        }
    }
    for (const version of selectedPlans) details.push([`计划 ${version.id}`, `入场 ${version.input.entry ?? '未记录'}；止损 ${version.input.initialStop ?? '未记录'}；目标 ${version.input.targets.map(t => t.price ?? '未记录').join(' / ')}；数量 ${version.input.resolvedQuantity ?? '未记录'}；${{ initial: '初始计划', adjustment: '持仓调整', correction: '录入更正' }[version.kind]}${version.reason ? `：${version.reason}` : ''}`]);
    if (risk) details.push(['风险来源', `${risk.riskBaselineId}；计划 ${risk.planVersionId}；作用范围 ${risk.scope === 'episode' ? '全回合' : '建仓决策'}；${risk.method === 'fixed-budget' ? '固定预算' : '价格推算风险'}`]);
    const metricLabels: Record<string, string> = { remainingQuantity: '剩余数量', averageEntryPrice: '入场均价', weightedExitPrice: '退出均价', realizedGross: '已实现毛额', realizedNet: '已实现净额', unrealizedGross: '持仓浮盈亏', remainingEntryFee: '剩余入场费', totalFees: '总费用', netPnl: '净盈亏', actualR: '实际 R', entryPriceDeviation: '入场偏差', quantityDeviation: '数量偏差', targetRealization: '目标兑现比例' };
    for (const [key, value] of Object.entries(m ?? {})) if (value.value === null) details.push([`缺失 ${metricLabels[key] ?? '指标'}`, reasonLabel(value.reason)]);
    return { rows, details };
}

/** Freeze all selected references synchronously before importing or rendering the deck. */
export function createRecallPptxManifest(input: RecallDocument, options: RecallPptxOptions = {}): RecallPptxManifest {
    const selected = selectRecallExportDocument(input, options.source);
    const document = structuredClone(selected.document);
    const generatedAt = options.generatedAt ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(generatedAt))) throw new RecallExportError('导出时间无效');
    const stages: RecallPptxStage[] = getRecallStoryboard(document).map(stage => ({
        phase: stage.phase, title: STORYBOARD_PHASE_LABELS[stage.phase], snapshot: stage.snapshot,
        bundle: stage.snapshot ? acceptedBundle(document, stage.snapshot) : null,
        warnings: [...stage.reasons.map(reason => STORYBOARD_REASON_LABELS[reason]), ...(stage.snapshot && !acceptedBundle(document, stage.snapshot) ? ['旧版或未确认快照：结构化版本未知'] : [])],
    }));
    const choices = recallPptxGlobalChoices(document);
    const global = options.globalBundleId ? choices.find(choice => choice.bundleId === options.globalBundleId) : choices[0];
    if (options.globalBundleId && !global) throw new RecallExportError('所选全局留存版本已不可用，请重新选择');
    const bundle = global ? document.retainedBundles!.find(item => item.id === global.bundleId)! : null;
    const texts: RecallPptxText[] = [];
    const seen = new Map<string, RecallPptxText>();
    const prior = new Map<string, { text: string; revision: string; ownerId: string }>();
    for (const stage of stages) for (const drawing of stage.snapshot?.drawings ?? []) {
        if (drawing.tool !== 'text' || typeof drawing.text !== 'string') continue;
        const revision = drawing.textRevision === undefined ? `legacy:${sha256(drawing.text)}` : String(drawing.textRevision);
        const old = prior.get(drawing.id);
        const ownerId = drawing.recallOwnerId?.trim() || (old?.text === drawing.text && old.revision === revision ? old.ownerId : stage.snapshot!.decisionId);
        const key = JSON.stringify([drawing.id, revision, ownerId]);
        const entry = seen.get(key);
        if (entry) { if (!entry.snapshotIds.includes(stage.snapshot!.id)) entry.snapshotIds.push(stage.snapshot!.id); }
        else { const next = { key, drawingId: drawing.id, revision, ownerId, text: drawing.text, snapshotIds: [stage.snapshot!.id] }; texts.push(next); seen.set(key, next); }
        prior.set(drawing.id, { text: drawing.text, revision, ownerId });
    }
    const symbol = bundle?.executionEvidence.payload.episode.instrument.symbol ?? '复盘';
    const name = Array.from(pptxText(`${symbol}_${selected.source === 'completed' ? '正式' : '草稿'}_${generatedAt.slice(0, 10)}`).replace(/[<>:"/\\|?*]/g, '_')).slice(0, 100).join('');
    return freeze({ version: 1, source: selected.source, documentRevision: document.revision, episodeId: document.episodeId, generatedAt, fileName: `${name}.pptx`, stages, texts,
        summary: { snapshotId: global?.snapshotId ?? null, bundle, ...summaryRows(document, bundle) } });
}
