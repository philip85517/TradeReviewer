'use client';

import { useEffect, useState } from 'react';
import type { TradeEpisode } from '../../lib/trades/types';
import type { RecallDocument, RecallPhase } from '../../lib/recall/types';
import {
  getCurrentRecallManualEvaluation,
  getRecallManualEvaluationEvidenceChoices,
  getRecallManualEvaluationEvidenceStatus,
  confirmRecallManualEvaluationAssociation,
  RECALL_MANUAL_EVALUATION_TAGS,
  upsertRecallManualEvaluationDraft,
  type RecallManualEvaluationDraft,
  type RecallManualEvaluationEvidence,
  type RecallManualEvaluationTarget,
  type RecallManualEvaluationTag,
} from '../../lib/recall/manual-evaluations';
import './recall-manual-evaluations.css';

export type RecallManualEvaluationsProps = {
  document: RecallDocument;
  episode: TradeEpisode;
  phase: RecallPhase;
  target: RecallManualEvaluationTarget;
  knowledgeCutoff: { cursor: string; executionCursor: string };
  hasSeenFuture: boolean;
  onChangeDocument: (document: RecallDocument) => void;
  onValidityChange?: (valid: boolean) => void;
  onValidationChange?: (error: string | null) => void;
  readOnly?: boolean;
  manualEvaluationRevisionIds?: string[];
};

function emptyDraft(props: RecallManualEvaluationsProps): RecallManualEvaluationDraft {
  return {
    id: `manual-draft:${props.episode.id}`,
    evaluationId: `manual-evaluation:${props.episode.id}`,
    target: props.target,
    tags: [],
    tagDictionaryVersion: 'manual-v1',
    evidence: [],
    source: 'manual-retrospective',
    recordedBy: 'user',
    recordedPhase: 'post-review',
    recordedAt: new Date().toISOString(),
    knowledgeCutoff: props.knowledgeCutoff,
    hasSeenFuture: props.hasSeenFuture,
  };
}

function evidenceLabel(evidence: RecallManualEvaluationEvidence): string {
  return evidence.kind === 'text'
    ? `Text ${evidence.drawingId} · 修订 ${evidence.textRevision} · 归属 ${evidence.ownerId}`
    : `快照 ${evidence.snapshotId}`;
}

export function RecallManualEvaluations(props: RecallManualEvaluationsProps) {
  const { document, phase, readOnly = false, onChangeDocument, onValidityChange, onValidationChange } = props;
  const retained = readOnly ? (document.manualEvaluations?.versions ?? []).filter(version => props.manualEvaluationRevisionIds?.includes(version.id)) : [];
  const saved = readOnly ? retained[0] : getCurrentRecallManualEvaluation(document);
  const [local, setLocal] = useState<RecallManualEvaluationDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draft = saved ?? local ?? emptyDraft(props);
  const valid = !error;
  useEffect(() => { onValidityChange?.(valid); }, [valid, onValidityChange]);
  useEffect(() => { onValidationChange?.(error); }, [error, onValidationChange]);
  useEffect(() => () => { onValidationChange?.(null); }, [onValidationChange]);

  if (phase !== 'post-review') return null;
  if (readOnly && !retained.length) return <section className="recall-manual-evaluations"><h3>回合人工标签</h3><p>此留存未记录回合人工标签</p></section>;

  function change(patch: Partial<RecallManualEvaluationDraft>) {
    if (readOnly) return;
    const next = { ...draft, ...patch, target: props.target, recordedAt: new Date().toISOString(), knowledgeCutoff: props.knowledgeCutoff, hasSeenFuture: props.hasSeenFuture };
    setLocal(next);
    try {
      const updated = upsertRecallManualEvaluationDraft(document, next);
      setError(null);
      onChangeDocument(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '人工标签暂未保存，请保留输入重试。');
    }
  }

  function toggleTag(tag: RecallManualEvaluationTag, checked: boolean) {
    const tags = checked ? [...draft.tags, tag] : draft.tags.filter(item => item !== tag);
    change({ tags });
  }

  function toggleEvidence(pointer: RecallManualEvaluationEvidence, checked: boolean) {
    const evidence = checked ? [...draft.evidence, pointer] : draft.evidence.filter(item => JSON.stringify(item) !== JSON.stringify(pointer));
    change({ evidence });
  }

  const evidenceChoices = getRecallManualEvaluationEvidenceChoices(document);
  const association = document.manualEvaluations?.associations.find(item => item.evaluationId === draft.evaluationId);
  return <section className="recall-manual-evaluations" aria-label="回合人工标签">
    <h3>回合人工标签</h3>
    <p className="recall-manual-note">人工补记 · 只记录仓位、入场与判断，不自动从盈亏推断。</p>
    {association?.status === 'needs-confirmation' && !readOnly ? <p className="recall-manual-pending" role="alert">
      成交集合已变化，当前标签需要确认归属。
      <button type="button" onClick={() => onChangeDocument(confirmRecallManualEvaluationAssociation(document, draft.evaluationId))}>确认使用当前回合成交</button>
    </p> : null}
    <fieldset aria-label="人工回合标签" disabled={readOnly}>
      <legend>人工归因标签</legend>
      {Object.entries(RECALL_MANUAL_EVALUATION_TAGS).map(([value, label]) => <label key={value}>
        <input type="checkbox" checked={draft.tags.includes(value as RecallManualEvaluationTag)} onChange={event => toggleTag(value as RecallManualEvaluationTag, event.target.checked)} />{label}
      </label>)}
    </fieldset>
    <details>
      <summary>关联图上证据</summary>
      {!evidenceChoices.length ? <p>暂无带修订标识的 Text 或留存快照</p> : evidenceChoices.map(({ pointer, label }) => <label className="recall-manual-evidence" key={JSON.stringify(pointer)}>
        <input type="checkbox" checked={draft.evidence.some(item => JSON.stringify(item) === JSON.stringify(pointer))} disabled={readOnly} onChange={event => toggleEvidence(pointer, event.target.checked)} />{label}
      </label>)}
    </details>
    {draft.evidence.map(evidence => getRecallManualEvaluationEvidenceStatus(document, evidence).available ? null : <p key={JSON.stringify(evidence)} className="recall-manual-missing">关联证据已缺失或修订变化，原引用保留：{evidenceLabel(evidence)}</p>)}
    {error ? <p role="alert">{error}</p> : null}
    {readOnly ? <p className="recall-manual-note">留存标签只读 · {draft.recordedAt}</p> : null}
  </section>;
}
