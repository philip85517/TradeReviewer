"use client";

import { CheckCircle2, Tags } from "lucide-react";
import { useState, type ReactNode } from "react";
import { REVIEW_TAGS } from "../../lib/reviews/review-tags";
import { calculateRMultiple } from "../../lib/reviews/review-metrics";
import type { EpisodeReviewRecord, ReviewScore } from "../../lib/reviews/types";
import { useEpisodeReviewAutosave } from "./use-episode-review-autosave";

export type EpisodeNotesProps = {
  episodeId: string;
  instrumentId: string;
  record?: EpisodeReviewRecord;
  knowledgeCursor?: string;
  episodeStartedAt?: string;
  delayMs?: number;
  replayComplete?: boolean;
  onSave: (record: EpisodeReviewRecord) => Promise<void>;
  onComplete?: () => void;
  ruleContent?: (draft: EpisodeReviewRecord, update: (checks: NonNullable<EpisodeReviewRecord["review"]["ruleChecks"]>) => void) => ReactNode;
  suggestions?: ReactNode | ((onBusyChange: (busy: boolean) => void) => ReactNode);
  netPnl?: string | null;
};

function score(value: string): ReviewScore | null {
  return value === "" ? null : Number(value) as ReviewScore;
}

export function EpisodeNotesPanel({ episodeId, instrumentId, record, knowledgeCursor, episodeStartedAt, delayMs, onSave, onComplete, ruleContent, suggestions, netPnl }: EpisodeNotesProps) {
  const { draft, status, error, updatePlan, updateReview, toggleTag, retry, saveReview, savingReview } = useEpisodeReviewAutosave({ episodeId, instrumentId, record, knowledgeCursor, episodeStartedAt, delayMs, onSave });
  const [actionState, setActionState] = useState<{episodeId: string; error: string | null; busy: boolean}>({episodeId, error: null, busy: false});
  const [deferReason, setDeferReason] = useState({ episodeId, value: "" });
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const busy = suggestionBusy || savingReview || (actionState.episodeId === episodeId && actionState.busy);
  const actionError = actionState.episodeId === episodeId ? actionState.error : null;
  const finish = async (deferred = false) => {
    if (busy) return;
    const reason = deferReason.episodeId === episodeId ? deferReason.value.trim() : "";
    const hasConclusion = Boolean(draft.review.keyDecision?.trim() || draft.review.reusableRule.trim() || draft.review.riskManagement.trim() || draft.review.psychology.trim());
    if (deferred ? !reason : !hasConclusion) {
      setActionState({episodeId, error: deferred ? "请填写暂不复盘的原因" : "请留下一条结论或下次行动，也可以说明暂不复盘的原因", busy: false});
      return;
    }
    setActionState({episodeId, error: null, busy: true});
    const saved = await saveReview({ completed: !deferred, deferredReason: deferred ? reason : "" });
    setActionState({episodeId, error: null, busy: false});
    if (saved) onComplete?.();
  };
  const completed = draft.review.completed && status !== "error";
  const r = calculateRMultiple({netPnl: netPnl ?? null}, draft.plan.plannedRiskAmount);
  return (
    <section className="episode-notes-panel focused-review" aria-label="当前回合复盘" aria-busy={busy}>
      <header className="focused-review-heading"><strong>三问复盘</strong><span>留下一条能验证的改进</span></header>
      {r !== null && <span className="episode-r-preview">{r}R</span>}
      <fieldset disabled={busy} style={{display: "contents"}}>
      <fieldset className="focused-review-questions" disabled={busy}>
        <label><span>1 · 这笔最关键的决策是什么？</span><textarea aria-label="关键决策" placeholder="记一个决策，以及当时的依据" value={draft.review.keyDecision ?? ""} onChange={event => updateReview("keyDecision", event.target.value)} /></label>
        <div className="episode-review-row">
          <label><span>决策环节</span><select aria-label="决策环节" value={draft.review.decisionStage ?? "entry"} onChange={event => updateReview("decisionStage", event.target.value as "entry" | "management" | "exit")}><option value="entry">入场</option><option value="management">加减仓</option><option value="exit">离场</option></select></label>
          {knowledgeCursor && <button type="button" className="review-evidence-button" onClick={() => updateReview("evidenceAt", knowledgeCursor)}>关联当前图表时点</button>}
        </div>
        {draft.review.evidenceAt && <small>观察时点：{new Date(draft.review.evidenceAt).toLocaleString("zh-CN", {timeZone:"Asia/Shanghai"})}（复盘定位）</small>}
        <label><span>2 · 是否符合当时的计划？</span><select aria-label="计划符合度" value={draft.review.planAdherence ?? "unassessed"} onChange={event => updateReview("planAdherence", event.target.value as "followed" | "deviated" | "no-plan" | "unassessed")}><option value="unassessed">尚未评估</option><option value="followed">符合计划</option><option value="deviated">偏离计划</option><option value="no-plan">当时没有计划</option></select></label>
        <label><span>3 · 下次具体保持或改变什么？</span><textarea aria-label="下次行动" placeholder="当……时，我先……；或记录保持原做法 / 继续观察" value={draft.review.reusableRule} onChange={event => updateReview("reusableRule", event.target.value)} /></label>
        <label className="review-track-rule"><input type="checkbox" aria-label="追踪这条规则" disabled={!draft.review.reusableRule.trim()} checked={draft.review.ruleTracking ?? false} onChange={event => updateReview("ruleTracking", event.target.checked)} />追踪这条规则</label>
        {draft.review.ruleTracking && <label><span>规则状态</span><select aria-label="规则状态" value={draft.review.ruleStatus ?? "observing"} onChange={event => updateReview("ruleStatus", event.target.value as "observing" | "adopted" | "revised")}><option value="observing">观察中</option><option value="adopted">继续采用</option><option value="revised">已调整</option></select></label>}
      </fieldset>
      {ruleContent?.(draft, checks => updateReview("ruleChecks", checks))}
      {suggestions && <fieldset disabled={status !== "idle" && status !== "saved"} className="review-suggestion-actions">
        {status !== "idle" && status !== "saved" && <small>请先保存当前草稿，再处理标签建议。</small>}
        {typeof suggestions === "function" ? suggestions(setSuggestionBusy) : suggestions}
      </fieldset>}
      <details className="review-advanced" key={episodeId}><summary>补充分析 · 原始计划、风险与标签</summary>
        <p className="review-plan-note">历史计划可以留空。此处补记和回放中的判断，不代表真实交易前已记录的计划。</p>
      <div className="episode-review-sections" key={episodeId}>
        <details className="notes-stage" open><summary>事前计划</summary><fieldset><legend className="sr-only">事前计划</legend>
          <label><span>买入理由</span><textarea aria-label="买入理由" value={draft.plan.thesis} onChange={(event) => updatePlan("thesis", event.target.value)} /></label>
          <label><span>预期路径</span><textarea aria-label="预期路径" value={draft.plan.expectedPath} onChange={(event) => updatePlan("expectedPath", event.target.value)} /></label>
          <div className="episode-review-row"><label><span>失效条件</span><input aria-label="失效条件" value={draft.plan.invalidationCondition} onChange={(event) => updatePlan("invalidationCondition", event.target.value)} /></label><label><span>目标区间</span><input aria-label="目标区间" value={draft.plan.targetRange} onChange={(event) => updatePlan("targetRange", event.target.value)} /></label></div>
          <div className="episode-review-row"><label><span>计划风险金额</span><input type="text" inputMode="decimal" aria-label="计划风险金额" value={draft.plan.plannedRiskAmount} onChange={(event) => updatePlan("plannedRiskAmount", event.target.value)} /></label><label><span>信心等级</span><select aria-label="信心等级" value={draft.plan.confidence ?? ""} onChange={(event) => updatePlan("confidence", score(event.target.value))}><option value="">未填写</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div>
        </fieldset></details>
        <details className="notes-stage" ><summary>事后总结</summary><fieldset><legend className="sr-only">事后复盘</legend>
          <div className="episode-review-row"><label><span>决策质量</span><select aria-label="决策质量" value={draft.review.decisionQuality ?? ""} onChange={(event) => updateReview("decisionQuality", score(event.target.value))}><option value="">未评分</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label><span>执行质量</span><select aria-label="执行质量" value={draft.review.executionQuality ?? ""} onChange={(event) => updateReview("executionQuality", score(event.target.value))}><option value="">未评分</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div>
          <label><span>风险管理</span><textarea aria-label="风险管理" value={draft.review.riskManagement} onChange={(event) => updateReview("riskManagement", event.target.value)} /></label>
          <label><span>心理复盘</span><textarea aria-label="心理复盘" value={draft.review.psychology} onChange={(event) => updateReview("psychology", event.target.value)} /></label>
        </fieldset></details>
      </div>
      <div className="episode-review-tags"><span><Tags size={13} />用户确认标签</span><div>{REVIEW_TAGS.map(({ id, label }) => <label key={id}><input type="checkbox" checked={draft.confirmedTagIds.includes(id)} onChange={() => toggleTag(id)} />{label}</label>)}</div></div>
      </details>
      <footer className="episode-notes-status focused-review-footer">
        <div className="review-save-state">{status === "dirty" && <span role="status" aria-live="polite">等待自动保存</span>}{status === "saving" && <span role="status" aria-live="polite">正在自动保存</span>}{status === "saved" && <span role="status" aria-live="polite"><CheckCircle2 size={13} />已自动保存</span>}{(actionError || error) && <span role="alert">{actionError || error}</span>}{status === "error" && <button type="button" disabled={busy} onClick={() => void retry()}>重试保存</button>}</div>
        {completed ? <button type="button" disabled={busy} onClick={() => void saveReview({completed:false, deferredReason:""})}>重新打开复盘</button> : <button type="button" className="review-complete-button" disabled={busy} onClick={() => void finish()}>{busy ? "正在保存…" : onComplete ? "完成并下一回合" : "完成复盘"}</button>}
        {!completed && <details className="review-defer"><summary>暂不复盘</summary><label><span>暂不复盘的原因</span><input aria-label="暂不复盘的原因" value={deferReason.episodeId === episodeId ? deferReason.value : ""} onChange={event => setDeferReason({episodeId, value:event.target.value})} /></label><button type="button" disabled={busy} onClick={() => void finish(true)}>暂存原因并继续</button></details>}
        {draft.review.deferredReason && <p>暂不复盘：{draft.review.deferredReason} <button type="button" onClick={() => void saveReview({deferredReason:"", completed:false})}>返回待复盘</button></p>}
      </footer>
      </fieldset>
    </section>
  );
}
