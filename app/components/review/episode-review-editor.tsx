"use client";

import { CheckCircle2, Save, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import {
  calculateRMultiple,
  isValidPlannedRiskAmount,
  normalizeEpisodeReviewRecord,
} from "../../lib/reviews/review-metrics";
import { REVIEW_TAGS } from "../../lib/reviews/review-tags";
import type {
  EpisodeReviewRecord,
  ReviewScore,
} from "../../lib/reviews/types";

type Props = {
  episodeId: string;
  instrumentId: string;
  netPnl: string | null;
  record?: EpisodeReviewRecord;
  onSave: (record: EpisodeReviewRecord) => void | Promise<void>;
};

function emptyRecord(
  episodeId: string,
  instrumentId: string,
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId,
    updatedAt: new Date(0).toISOString(),
    plan: {
      thesis: "",
      expectedPath: "",
      invalidationCondition: "",
      targetRange: "",
      plannedRiskAmount: "",
      confidence: null,
    },
    review: {
      decisionQuality: null,
      executionQuality: null,
      riskManagement: "",
      psychology: "",
      reusableRule: "",
      completed: false,
    },
    confirmedTagIds: [],
  };
}

function score(value: string): ReviewScore | null {
  return value === "" ? null : (Number(value) as ReviewScore);
}

export function EpisodeReviewEditor({
  episodeId,
  instrumentId,
  netPnl,
  record,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(() =>
    record ?? emptyRecord(episodeId, instrumentId),
  );
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState(
    record?.updatedAt,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  if (record && loadedUpdatedAt !== record.updatedAt) {
    setLoadedUpdatedAt(record.updatedAt);
    if (!dirty && draft.updatedAt !== record.updatedAt) {
      setDraft(record);
      setError(null);
      setSaved(false);
    }
  }

  const rMultiple = useMemo(
    () =>
      calculateRMultiple(
        { netPnl },
        draft.plan.plannedRiskAmount,
      ),
    [draft.plan.plannedRiskAmount, netPnl],
  );

  const updatePlan = (
    field: keyof EpisodeReviewRecord["plan"],
    value: string | ReviewScore | null,
  ) => {
    setSaved(false);
    setDirty(true);
    setDraft((current) => ({
      ...current,
      plan: { ...current.plan, [field]: value },
    }));
  };

  const updateReview = (
    field: keyof EpisodeReviewRecord["review"],
    value: string | ReviewScore | boolean | null,
  ) => {
    setSaved(false);
    setDirty(true);
    setDraft((current) => ({
      ...current,
      review: { ...current.review, [field]: value },
    }));
  };

  const toggleTag = (tagId: string) => {
    setSaved(false);
    setDirty(true);
    setDraft((current) => ({
      ...current,
      confirmedTagIds: current.confirmedTagIds.includes(tagId)
        ? current.confirmedTagIds.filter((id) => id !== tagId)
        : [...current.confirmedTagIds, tagId],
    }));
  };

  const save = async () => {
    const riskText = draft.plan.plannedRiskAmount.trim();
    if (!isValidPlannedRiskAmount(riskText)) {
      setError("计划风险必须大于 0");
      return;
    }
    setError(null);
    setSaving(true);
    const next = normalizeEpisodeReviewRecord({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    try {
      await onSave(next);
      setDraft(next);
      setLoadedUpdatedAt(next.updatedAt);
      setDirty(false);
      setSaved(true);
    } catch {
      setSaved(false);
      setError("保存失败，请检查本机存储后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="episode-review-editor" aria-label="当前回合复盘">
      <header className="episode-review-editor-header">
        <div>
          <span className="eyebrow">Episode Review</span>
          <h3>当前回合计划与复盘</h3>
        </div>
        <span className="episode-r-preview">
          {rMultiple === null ? "R —" : `${rMultiple}R`}
        </span>
      </header>

      <div className="episode-review-sections">
        <fieldset>
          <legend>事前计划</legend>
          <label>
            <span>买入理由</span>
            <textarea
              aria-label="买入理由"
              value={draft.plan.thesis}
              onChange={(event) => updatePlan("thesis", event.target.value)}
            />
          </label>
          <label>
            <span>预期路径</span>
            <textarea
              aria-label="预期路径"
              value={draft.plan.expectedPath}
              onChange={(event) =>
                updatePlan("expectedPath", event.target.value)
              }
            />
          </label>
          <div className="episode-review-row">
            <label>
              <span>失效条件</span>
              <input
                aria-label="失效条件"
                value={draft.plan.invalidationCondition}
                onChange={(event) =>
                  updatePlan("invalidationCondition", event.target.value)
                }
              />
            </label>
            <label>
              <span>目标区间</span>
              <input
                aria-label="目标区间"
                value={draft.plan.targetRange}
                onChange={(event) =>
                  updatePlan("targetRange", event.target.value)
                }
              />
            </label>
          </div>
          <div className="episode-review-row">
            <label>
              <span>计划风险金额</span>
              <input
                type="text"
                inputMode="decimal"
                aria-label="计划风险金额"
                value={draft.plan.plannedRiskAmount}
                onChange={(event) =>
                  updatePlan("plannedRiskAmount", event.target.value)
                }
              />
            </label>
            <label>
              <span>信心等级</span>
              <select
                aria-label="信心等级"
                value={draft.plan.confidence ?? ""}
                onChange={(event) =>
                  updatePlan("confidence", score(event.target.value))
                }
              >
                <option value="">未填写</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>事后复盘</legend>
          <div className="episode-review-row">
            <label>
              <span>决策质量</span>
              <select
                aria-label="决策质量"
                value={draft.review.decisionQuality ?? ""}
                onChange={(event) =>
                  updateReview("decisionQuality", score(event.target.value))
                }
              >
                <option value="">未评分</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>执行质量</span>
              <select
                aria-label="执行质量"
                value={draft.review.executionQuality ?? ""}
                onChange={(event) =>
                  updateReview("executionQuality", score(event.target.value))
                }
              >
                <option value="">未评分</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>风险管理</span>
            <textarea
              aria-label="风险管理"
              value={draft.review.riskManagement}
              onChange={(event) =>
                updateReview("riskManagement", event.target.value)
              }
            />
          </label>
          <label>
            <span>心理复盘</span>
            <textarea
              aria-label="心理复盘"
              value={draft.review.psychology}
              onChange={(event) =>
                updateReview("psychology", event.target.value)
              }
            />
          </label>
          <label>
            <span>可复用规则</span>
            <textarea
              aria-label="可复用规则"
              value={draft.review.reusableRule}
              onChange={(event) =>
                updateReview("reusableRule", event.target.value)
              }
            />
          </label>
        </fieldset>
      </div>

      <div className="episode-review-tags">
        <span>
          <Tags size={13} />
          用户确认标签
        </span>
        <div>
          {REVIEW_TAGS.map(({ id, label }) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={draft.confirmedTagIds.includes(id)}
                onChange={() => toggleTag(id)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="episode-review-actions">
        <label>
          <input
            type="checkbox"
            aria-label="标记为已完成复盘"
            checked={draft.review.completed}
            onChange={(event) =>
              updateReview("completed", event.target.checked)
            }
          />
          标记为已完成复盘
        </label>
        {error && <span role="alert">{error}</span>}
        {saved && (
          <span
            className="episode-review-saved"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 size={13} />
            已保存在本机
          </span>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          <Save size={14} />
          {saving ? "正在保存…" : "保存当前回合复盘"}
        </button>
      </div>
    </section>
  );
}
