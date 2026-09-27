"use client";
import { useEffect, useState } from 'react';
import type { RecallDocument, RecallPhase, RecallPlanDraft, RecallPlanInput, RecallRiskBudget } from '../../lib/recall/types';
import type { TradeEpisode } from '../../lib/trades/types';
import { createRecallPlanRevision, recallPlanRiskBaseline, resolveRecallPlanAssociation, upsertRecallPlanDraft } from '../../lib/recall/plans';
import { RecallPlanFields } from './recall-plan-sidebar';
import './recall-plan-revisions.css';
type Props = {
    document: RecallDocument;
    episode: TradeEpisode;
    phase: RecallPhase;
    knowledgeCutoff: RecallPlanDraft['knowledgeCutoff'];
    hasSeenFuture: boolean;
    onChangeDocument: (document: RecallDocument) => void;
    planId?: string;
    onPlanIdChange?: (id: string) => void;
    onValidationChange?: (error: string | null) => void;
};
export function RecallPlanRevisionSection({ document, episode, phase, knowledgeCutoff, hasSeenFuture, onChangeDocument, onValidationChange, planId: controlledPlanId, onPlanIdChange }: Props) {
    const [planId, setPlanId] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const lineages = document.planAssociations ?? [];
    const activeId = controlledPlanId ?? (planId || lineages[0]?.planId);
    const association = lineages.find(a => a.planId === activeId);
    const draft = document.plans?.drafts.find(d => d.planId === activeId);
    const latest = [...document.plans?.versions ?? []].reverse().find(v => v.planId === activeId);
    const editable = draft?.kind !== 'initial' ? draft : undefined;
    const [input, setInput] = useState<RecallPlanInput | null>(editable?.input ?? null);
    const [budget, setBudget] = useState<RecallRiskBudget | null>(editable?.riskBudget ?? null);
    useEffect(() => { onValidationChange?.(error); return () => onValidationChange?.(null); }, [error, onValidationChange]);
    const signature = JSON.stringify([activeId, editable]);
    const [previousSignature, setPreviousSignature] = useState(signature);
    // Adjust only when authoritative data changes; rejected local edits stay intact.
    if (signature !== previousSignature) {
        setPreviousSignature(signature);
        setInput(editable?.input ?? null);
        setBudget(editable?.riskBudget ?? null);
        setError(null);
    }
    function save(value: RecallPlanInput, riskBudget = budget) {
        setInput(value);
        if (!editable)
            return;
        try {
            onChangeDocument(upsertRecallPlanDraft(document, { ...editable, input: value, recordedAt: new Date().toISOString(), recordedPhase: phase, knowledgeCutoff, hasSeenFuture, ...(riskBudget ? { riskBudget } : { riskBudget: undefined }) }));
            setError(null);
        }
        catch (e) {
            setError((e as Error).message);
        }
    }
    function create(kind: 'adjustment' | 'correction') {
        try {
            onChangeDocument(createRecallPlanRevision(document, { id: crypto.randomUUID(), planId: activeId!, kind, reason, recordedAt: new Date().toISOString(), recordedPhase: phase, knowledgeCutoff, hasSeenFuture }));
            setError(null);
        }
        catch (e) {
            setError((e as Error).message);
        }
    }
    const baseline = latest && recallPlanRiskBaseline(document, latest.id);
    return <section className="recall-plan-revisions" aria-label="计划修订">
 <h3>计划修订与初始风险</h3>
 {!lineages.length ? <p>先为建仓决策录入并留存原计划。</p> : <>
 <label>计划版本链<select aria-label="计划版本链" value={activeId} onChange={e => { setPlanId(e.target.value); onPlanIdChange?.(e.target.value); }}>{lineages.map(a => <option key={a.planId} value={a.planId}>{a.decisionId ? `决策 ${document.decisions.findIndex(d => d.id === a.decisionId) + 1}` : '待重新关联'} · 计划 {lineages.indexOf(a) + 1}</option>)}</select></label>
 {association?.status === 'needs-confirmation' && <label>重新关联现有决策<select aria-label="重新关联现有决策" value="" onChange={e => {
                    if (e.target.value)
                        onChangeDocument(resolveRecallPlanAssociation(document, activeId!, e.target.value));
                }}><option value="">选择决策</option>{document.decisions.map(d => <option key={d.id} value={d.id}>{`决策 ${document.decisions.indexOf(d) + 1}`}</option>)}</select></label>}
 <p>初始风险基准：{baseline ? `${baseline.amount} ${baseline.currency}（${baseline.method === 'fixed-budget' ? '预算 R' : '价格风险 R'}）` : '待确认：缺少原始止损或有来源的风险预算'}</p>
 <details><summary>查看原版与修订记录</summary>{document.plans?.versions.filter(v => v.planId === activeId).map(v => <p key={v.id}>{{ initial: "原计划", adjustment: "持仓调整", correction: "输入纠错" }[v.kind]} · {v.recordedAt} · 入场 {v.input.entry ?? '未知'} / 止损 {v.input.initialStop ?? '未知'} / 数量 {v.input.resolvedQuantity ?? '未知'} · {v.reason ?? '原计划'} · 观察截至 {v.knowledgeCutoff.cursor}</p>)}</details>
 <label>修订理由<input aria-label="修订理由" value={reason} onChange={e => setReason(e.target.value)}/></label>
 <div className="recall-plan-revision-actions"><button type="button" disabled={phase !== 'holding' || !latest || !reason.trim() || association?.status !== 'linked'} onClick={() => create('adjustment')}>调整持仓计划</button><button type="button" disabled={!latest || !reason.trim() || association?.status !== 'linked'} onClick={() => create('correction')}>显式更正初始输入</button></div>
 {editable && input && <><p>{editable.kind === 'correction' ? '更正将追加风险基准，成果需重新确认。' : '调整保留原风险分母。'} 留存快照后生成不可变版本。</p><RecallPlanFields input={input} onChange={value => save(value)}/>
 {editable.kind === 'correction' && <fieldset><legend>有来源固定风险预算（可选）</legend><button type="button" onClick={() => { const b: RecallRiskBudget = { amount: '', currency: episode.instrument.currency, scope: 'decision', sourceDescription: '', evidenceReference: null, provenance: 'retrospective', effectiveKnowledgeCutoff: knowledgeCutoff }; setBudget(b); save(input, b); }}>录入预算</button>{budget && <>
 <label>预算金额<input aria-label="预算金额" value={budget.amount} onChange={e => { const b = { ...budget, amount: e.target.value }; setBudget(b); save(input, b); }}/></label>
 <label>预算范围<select value={budget.scope} onChange={e => { const b = { ...budget, scope: e.target.value as 'decision' | 'episode' }; setBudget(b); save(input, b); }}><option value="decision">当前建仓决策</option><option value="episode">整个交易回合</option></select></label>
 <label>预算来源<input aria-label="预算来源" value={budget.sourceDescription} onChange={e => { const b = { ...budget, sourceDescription: e.target.value }; setBudget(b); save(input, b); }}/></label><p>回忆补录 · 生效观察截止 {budget.effectiveKnowledgeCutoff.cursor}。加仓后补录的全回合预算不能作为全回合 R。</p></>}</fieldset>}</>}
 </>}{error && <p role="alert">{error}</p>}</section>;
}
