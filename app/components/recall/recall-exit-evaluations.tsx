'use client';

import { useEffect, useState } from 'react';
import type { TradeEpisode } from '../../lib/trades/types';
import type { RecallPhase } from '../../lib/recall/types';
import {
  RECALL_EVALUATION_TAGS, RECALL_EXIT_REASONS, calculateRecallExitEvaluationCoverage,
  getRecallEvaluationEvidenceChoices, getRecallEvaluationEvidenceStatus, getRecallExitDecisions,
  upsertRecallExitEvaluationDraft, resolveRecallExitEvaluationAssociation, getCurrentRecallExitEvaluation, selectRecallExitEvaluation,
  type RecallEvaluationDocument, type RecallEvaluationEvidence, type RecallExitEvaluationDraft,
} from '../../lib/recall/exit-evaluations';
import './recall-exit-evaluations.css';

export type RecallExitEvaluationsProps = {
  document: RecallEvaluationDocument;
  episode: TradeEpisode;
  phase: RecallPhase;
  knowledgeCutoff: { cursor: string; executionCursor: string };
  hasSeenFuture: boolean;
  onChangeDocument: (document: RecallEvaluationDocument) => void;
  /** Parent capture actions must be disabled while local reason text is invalid. */
  onValidityChange?: (valid: boolean) => void;
  onValidationChange?: (error: string | null) => void;
  readOnly?: boolean;
  evaluationRevisionIds?: string[];
};

function emptyDraft(decisionId: string, props: RecallExitEvaluationsProps): RecallExitEvaluationDraft {
  return {
    id: `exit-draft:${decisionId}`, evaluationId: `exit-evaluation:${decisionId}`, decisionId,
    earlyExit: null, adherence: null, reason: null, reasonDetail: null,
    comparedPlanVersionId: null, comparedTargetId: null, tags: [], tagDictionaryVersion: 'manual-v1', evidence: [],
    source: 'manual-retrospective', recordedBy: 'user', recordedPhase: 'post-review',
    recordedAt: new Date().toISOString(), knowledgeCutoff: props.knowledgeCutoff, hasSeenFuture: props.hasSeenFuture,
  };
}

function RecallExitChoiceGroup({ label, name, value, options, onChange }: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return <fieldset className="recall-exit-segmented" aria-label={label}>
    <legend>{label}</legend>
    <div className="recall-exit-segmented-options">
      {options.map(option => <label key={option.value || 'unset'}>
        <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={event => onChange(event.target.value)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

const earlyExitOptions = [
  { value: '', label: '未评价' }, { value: 'yes', label: '是' }, { value: 'no', label: '否' }, { value: 'uncertain', label: '不确定' },
];
const adherenceOptions = [
  { value: '', label: '未评价' }, { value: 'as-planned', label: '按计划' }, { value: 'deviated', label: '偏离' }, { value: 'no-plan', label: '无原计划' },
];

/** Inner side-panel section; the workspace owns layout, save status and the capture command. */
export function RecallExitEvaluations(props: RecallExitEvaluationsProps) {
  const { document, episode, phase, readOnly = false, onChangeDocument, onValidityChange, onValidationChange } = props;
  const exits = getRecallExitDecisions(document, episode);
  const retained = readOnly ? (document.exitEvaluations?.versions ?? []).filter(v => props.evaluationRevisionIds?.includes(v.id)) : [];
  const [selectedId, setSelectedId] = useState('');
  const [local, setLocal] = useState<Record<string, RecallExitEvaluationDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const valid = Object.values(errors).every(error => !error);
  const validationError = Object.values(errors).find(Boolean) ?? null;
  useEffect(() => { onValidityChange?.(valid); }, [valid, onValidityChange]);
  useEffect(() => { onValidationChange?.(validationError); }, [validationError, onValidationChange]);
  useEffect(() => () => { onValidationChange?.(null); }, [onValidationChange]);
  const choices = readOnly ? retained.map(v => ({ decisionId: v.decisionId, key: v.id })) : exits.map(e => ({ decisionId: e.decisionId, key: e.decisionId }));
  const selected = choices.find(c => c.key === selectedId) ?? choices[0];
  const decisionId = selected?.decisionId;
  const association = document.exitEvaluations?.associations.filter(a => a.status === 'linked' && a.decisionId === decisionId) ?? [];
  const saved = decisionId ? getCurrentRecallExitEvaluation(document,decisionId) : undefined;
  const draft = readOnly ? retained.find(v => v.id === selected?.key) : decisionId ? local[saved?.evaluationId ?? `exit-evaluation:${decisionId}`] ?? saved ?? emptyDraft(decisionId, props) : undefined;
  const exit = exits.find(e => e.decisionId === decisionId);
  const evidenceChoices = getRecallEvaluationEvidenceChoices(document);

  function change(patch: Partial<RecallExitEvaluationDraft>) {
    if (!draft || !decisionId || readOnly) return;
    const next = { ...draft, ...patch, decisionId, recordedAt: new Date().toISOString(), knowledgeCutoff: props.knowledgeCutoff, hasSeenFuture: props.hasSeenFuture };
    setLocal(current => ({ ...current, [next.evaluationId]: next }));
    if (next.reason === 'other' && !next.reasonDetail?.trim()) {
      setErrors(current => ({ ...current, [next.evaluationId]: '选择其他原因后，请补充简短说明。' }));
      return;
    }
    try {
      // Include other valid unsaved local decisions so rapidly switching cannot drop their input.
      let updated = document;
      for (const [id, other] of Object.entries(local)) {
        if (id !== next.evaluationId && !errors[id]) updated = upsertRecallExitEvaluationDraft(updated, other);
      }
      updated = upsertRecallExitEvaluationDraft(updated, next);
      setErrors(current => ({ ...current, [next.evaluationId]: '' }));
      onChangeDocument(updated);
    } catch (error) {
      setErrors(current => ({ ...current, [next.evaluationId]: error instanceof Error ? error.message : '评价暂未保存，请保留输入重试。' }));
    }
  }

  if (phase !== 'post-review') return null;
  if (readOnly && !retained.length) return <section className="recall-exit-evaluations"><h3>退出评价</h3><p>此留存未记录退出评价</p></section>;
  if (!choices.length) return <section className="recall-exit-evaluations"><h3>退出评价</h3><p>暂无可确认的退出决策</p></section>;
  if (!draft) return null;
  const comparison = document.plans?.versions.find(v => v.id === draft.comparedPlanVersionId);
  const coverage = readOnly ? null : calculateRecallExitEvaluationCoverage(document, episode);
  const exitLabel = (id: string, index: number) => {
    const facts = exits.find(exit => exit.decisionId === id);
    const action = facts?.action === 'close' ? '清仓' : facts?.action === 'reduce' ? '减仓' : '动作未知';
    return `退出 ${index+1} · ${facts?.executedAt?.slice(0,10) ?? '日期未知'} · ${action} · ${episode.direction === 'short' ? '买入平仓' : '卖出'} · 数量 ${facts?.quantity ?? '未知'} · 均价 ${facts?.averagePrice ?? '未知'}`;
  };
  const kindLabels = {initial:'初始计划',adjustment:'计划调整',correction:'录入纠错'};
  const toggleEvidence = (pointer: RecallEvaluationEvidence, checked: boolean) => change({ evidence: checked ? [...draft.evidence, pointer] : draft.evidence.filter(e => JSON.stringify(e) !== JSON.stringify(pointer)) });
  return <section className="recall-exit-evaluations" aria-label="退出执行评价">
    <h3>退出评价</h3>
    {!readOnly ? document.exitEvaluations?.associations.filter(a => a.status === 'needs-confirmation').map((association,index) => <label key={association.evaluationId}>
      评价 {index+1} 待重新关联
      <select aria-label={`重新关联退出评价 ${index+1}`} value="" onChange={event => {
        if(event.target.value) onChangeDocument(resolveRecallExitEvaluationAssociation(document,association.evaluationId,event.target.value));
      }}><option value="">选择对应的实际退出</option>{exits.map((exit,exitIndex)=><option key={exit.decisionId} value={exit.decisionId}>{exitLabel(exit.decisionId,exitIndex)}</option>)}</select>
    </label>) : null}
    <p className="recall-exit-note">人工补记 · 提前退出不等于错误；不按盈亏自动评价。</p>
    <label>退出决策<select aria-label="退出决策" value={selected?.key ?? ''} onChange={event => setSelectedId(event.target.value)}>
      {choices.map((c, index) => <option key={c.key} value={c.key}>{exitLabel(c.decisionId,index)}</option>)}
    </select></label>
    <p className="recall-exit-facts"><span>实际退出数量：{exit?.quantity ?? '未知'}</span>{exit?.executionIds.length ? <span>{` · ${exit.executionIds.length} 笔成交`}</span> : null}<span> · 真实加权均价：{exit?.averagePrice ?? '未知'}</span></p>
    {association.length > 1 && !readOnly ? <label>选择此退出当前采用的评价
      {!saved ? <p role="alert">合并后存在多次评价，请明确当前采用哪一条；全部历史仍保留。</p> : <p className="recall-exit-note">仅当前选择用于编辑、覆盖率和新留存；可随时切换。</p>}
      <select aria-label="当前采用的退出评价" value={saved?.evaluationId ?? ''} onChange={event => {
        if(event.target.value && decisionId) onChangeDocument(selectRecallExitEvaluation(document,decisionId,event.target.value));
      }}><option value="">请选择当前评价</option>{association.map((a,index)=>{
        const candidate=document.exitEvaluations?.drafts.find(d=>d.evaluationId===a.evaluationId);
        const early={yes:'是',no:'否',uncertain:'不确定'};
        return <option key={a.evaluationId} value={a.evaluationId}>评价 {index+1} · 提前退出{candidate?.earlyExit?early[candidate.earlyExit]:'未评价'} · {candidate?.recordedAt.slice(0,10)}</option>;
      })}</select>
    </label> : null}
    <fieldset disabled={readOnly || (association.length > 1 && !saved)}>
      <RecallExitChoiceGroup label="提前退出" name={`recall-exit-early:${decisionId}`} value={draft.earlyExit ?? ''} options={earlyExitOptions} onChange={value => change({ earlyExit: (value || null) as RecallExitEvaluationDraft['earlyExit'] })} />
      <RecallExitChoiceGroup label="执行符合度" name={`recall-exit-adherence:${decisionId}`} value={draft.adherence ?? ''} options={adherenceOptions} onChange={value => change({ adherence: (value || null) as RecallExitEvaluationDraft['adherence'], ...(value === 'no-plan' ? { comparedPlanVersionId: null, comparedTargetId: null } : {}) })} />
      <label>退出原因<select aria-label="退出原因" value={draft.reason ?? ''} onChange={event => change({ reason: (event.target.value || null) as RecallExitEvaluationDraft['reason'] })}>
        <option value="">未填写</option>{Object.entries(RECALL_EXIT_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {draft.reason === 'other' ? <label>其他原因说明<textarea aria-label="其他原因说明" maxLength={500} value={draft.reasonDetail ?? ''} onChange={event => change({ reasonDetail: event.target.value || null })} /></label> : null}
      <details><summary>比较计划与目标</summary>
        <label>比较计划版本<select aria-label="比较计划版本" value={draft.comparedPlanVersionId ?? ''} onChange={event => change({ comparedPlanVersionId: event.target.value || null, comparedTargetId: null, ...(draft.adherence === 'no-plan' && event.target.value ? { adherence: null } : {}) })}>
          <option value="">未选择／未记录</option>{document.plans?.versions.map(v => <option key={v.id} value={v.id}>{kindLabels[v.kind]} · {new Date(v.retainedAt).toLocaleString()}</option>)}
        </select></label>
        <label>比较目标<select aria-label="比较目标" value={draft.comparedTargetId ?? ''} onChange={event => change({ comparedTargetId: event.target.value || null })}>
          <option value="">未选择</option>{comparison?.input.targets.map((t,index) => <option key={t.id} value={t.id}>目标 {index+1} · {t.price ?? '未知价格'}</option>)}
        </select></label>
      </details>
      <fieldset className="recall-exit-tags"><legend>人工归因标签</legend>{Object.entries(RECALL_EVALUATION_TAGS).map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.tags.includes(value as keyof typeof RECALL_EVALUATION_TAGS)} onChange={event => change({ tags: event.target.checked ? [...draft.tags, value as keyof typeof RECALL_EVALUATION_TAGS] : draft.tags.filter(t => t !== value) })} />{label}</label>)}</fieldset>
      <details><summary>关联图上证据</summary>
        {!evidenceChoices.length ? <p>暂无带修订标识的 Text 或留存快照</p> : evidenceChoices.map(({ pointer, label }) => <label className="recall-exit-evidence" key={JSON.stringify(pointer)}><input type="checkbox" checked={draft.evidence.some(e => JSON.stringify(e) === JSON.stringify(pointer))} onChange={event => toggleEvidence(pointer, event.target.checked)} />{label}</label>)}
      </details>
    </fieldset>
    {draft.evidence.map(e => getRecallEvaluationEvidenceStatus(document, e).available ? null : <p key={JSON.stringify(e)} className="recall-exit-missing">关联证据已缺失或修订变化：{e.kind === 'text' ? `${e.drawingId} r${e.textRevision}` : e.snapshotId}（原引用保留）</p>)}
    {errors[draft.evaluationId] ? <p role="alert">{errors[draft.evaluationId]}</p> : null}
    {readOnly ? <p className="recall-exit-note">留存评价只读 · {draft.recordedAt}</p> : <p className="recall-exit-note">已评价 {coverage!.evaluatedDecisions}/{coverage!.totalExitDecisions} 次；不确定 {coverage!.uncertain} 次。覆盖率按提前退出的已填状态计算。</p>}
  </section>;
}
