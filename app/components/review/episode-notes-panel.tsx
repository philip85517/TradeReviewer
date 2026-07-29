"use client";

import { CheckCircle2, Tags } from "lucide-react";

import { REVIEW_TAGS } from "../../lib/reviews/review-tags";
import type { EpisodeReviewRecord, ReviewScore } from "../../lib/reviews/types";
import { useEpisodeReviewAutosave } from "./use-episode-review-autosave";

type Props = {
  episodeId: string;
  instrumentId: string;
  record?: EpisodeReviewRecord;
  delayMs?: number;
  onSave: (record: EpisodeReviewRecord) => Promise<void>;
};

function score(value: string): ReviewScore | null {
  return value === "" ? null : Number(value) as ReviewScore;
}

export function EpisodeNotesPanel({ episodeId, instrumentId, record, delayMs, onSave }: Props) {
  const { draft, status, error, updatePlan, updateReview, toggleTag, retry } = useEpisodeReviewAutosave({ episodeId, instrumentId, record, delayMs, onSave });
  return (
    <section className="episode-notes-panel" aria-label="当前回合复盘">
      <div className="episode-review-sections">
        <fieldset><legend>事前计划</legend>
          <label><span>买入理由</span><textarea aria-label="买入理由" value={draft.plan.thesis} onChange={(event) => updatePlan("thesis", event.target.value)} /></label>
          <label><span>预期路径</span><textarea aria-label="预期路径" value={draft.plan.expectedPath} onChange={(event) => updatePlan("expectedPath", event.target.value)} /></label>
          <div className="episode-review-row"><label><span>失效条件</span><input aria-label="失效条件" value={draft.plan.invalidationCondition} onChange={(event) => updatePlan("invalidationCondition", event.target.value)} /></label><label><span>目标区间</span><input aria-label="目标区间" value={draft.plan.targetRange} onChange={(event) => updatePlan("targetRange", event.target.value)} /></label></div>
          <div className="episode-review-row"><label><span>计划风险金额</span><input type="text" inputMode="decimal" aria-label="计划风险金额" value={draft.plan.plannedRiskAmount} onChange={(event) => updatePlan("plannedRiskAmount", event.target.value)} /></label><label><span>信心等级</span><select aria-label="信心等级" value={draft.plan.confidence ?? ""} onChange={(event) => updatePlan("confidence", score(event.target.value))}><option value="">未填写</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div>
        </fieldset>
        <fieldset><legend>事后复盘</legend>
          <div className="episode-review-row"><label><span>决策质量</span><select aria-label="决策质量" value={draft.review.decisionQuality ?? ""} onChange={(event) => updateReview("decisionQuality", score(event.target.value))}><option value="">未评分</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label><span>执行质量</span><select aria-label="执行质量" value={draft.review.executionQuality ?? ""} onChange={(event) => updateReview("executionQuality", score(event.target.value))}><option value="">未评分</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div>
          <label><span>风险管理</span><textarea aria-label="风险管理" value={draft.review.riskManagement} onChange={(event) => updateReview("riskManagement", event.target.value)} /></label>
          <label><span>心理复盘</span><textarea aria-label="心理复盘" value={draft.review.psychology} onChange={(event) => updateReview("psychology", event.target.value)} /></label>
          <label><span>可复用规则</span><textarea aria-label="可复用规则" value={draft.review.reusableRule} onChange={(event) => updateReview("reusableRule", event.target.value)} /></label>
        </fieldset>
      </div>
      <div className="episode-review-tags"><span><Tags size={13} />用户确认标签</span><div>{REVIEW_TAGS.map(({ id, label }) => <label key={id}><input type="checkbox" checked={draft.confirmedTagIds.includes(id)} onChange={() => toggleTag(id)} />{label}</label>)}</div></div>
      <footer className="episode-notes-status"><label><input type="checkbox" aria-label="标记为已完成复盘" checked={draft.review.completed} onChange={(event) => updateReview("completed", event.target.checked)} />标记为已完成复盘</label>{status === "dirty" && <span role="status" aria-live="polite">等待自动保存</span>}{status === "saving" && <span role="status" aria-live="polite">正在自动保存</span>}{status === "saved" && <span role="status" aria-live="polite"><CheckCircle2 size={13} />已自动保存</span>}{error && <span role="alert">{error}</span>}{status === "error" && <button type="button" onClick={() => void retry()}>重试保存</button>}</footer>
    </section>
  );
}
