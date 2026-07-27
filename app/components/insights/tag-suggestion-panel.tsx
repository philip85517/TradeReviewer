"use client";

import { Check, ExternalLink, Sparkles, X } from "lucide-react";
import { useState } from "react";

import type { TagSuggestionRecord } from "../../lib/insights/types";
import {
  reviewTagLabel,
  REVIEW_TAGS,
} from "../../lib/reviews/review-tags";

export type SuggestionEpisodeContext = {
  instrumentId: string;
  instrumentName: string;
  instrumentSymbol: string;
  episodeLabel: string;
  dateRange: string;
};

type Props = {
  suggestions: TagSuggestionRecord[];
  episodeContexts: Record<string, SuggestionEpisodeContext>;
  onConfirm: (suggestion: TagSuggestionRecord) => void | Promise<void>;
  onEdit: (
    suggestion: TagSuggestionRecord,
    finalTagId: string,
  ) => void | Promise<void>;
  onReject: (suggestion: TagSuggestionRecord) => void | Promise<void>;
  onOpenEpisode: (instrumentId: string, episodeId: string) => void;
};

function evidenceLabel(suggestion: TagSuggestionRecord) {
  const evidence = suggestion.evidence[0];
  if (!evidence) return "规则证据已记录";
  if (evidence.kind === "execution-count") {
    return `同一回合有 ${evidence.observed} 笔开仓方向成交`;
  }
  if (evidence.kind === "breakout-pullback") {
    return `入场价 ${evidence.observed} 回到突破参考位 ${evidence.reference} 附近`;
  }
  return `入场价 ${evidence.observed} 高于前 20 日参考高点 ${evidence.reference}`;
}

export function TagSuggestionPanel({
  suggestions,
  episodeContexts,
  onConfirm,
  onEdit,
  onReject,
  onOpenEpisode,
}: Props) {
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<
    Record<string, string>
  >({});
  const pending = suggestions.filter(
    ({ id, status }) => status === "suggested" && !resolved.has(id),
  );

  const decide = async (
    suggestion: TagSuggestionRecord,
    action: (suggestion: TagSuggestionRecord) => void | Promise<void>,
  ) => {
    setBusyId(suggestion.id);
    setError(null);
    try {
      await action(suggestion);
      setResolved((current) => new Set(current).add(suggestion.id));
    } catch {
      setError("建议处理失败，请检查本机存储后重试");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="tag-suggestion-panel" aria-label="待确认规则建议">
      <header>
        <div>
          <span className="eyebrow">Rule Suggestions</span>
          <h2>待确认规则建议</h2>
        </div>
        <span>{pending.length} 条</span>
      </header>
      <p>
        系统只根据成交与入场前 K 线提出建议；确认后才会进入正式统计。
      </p>
      {error && <p role="alert">{error}</p>}
      {pending.length === 0 ? (
        <div className="suggestion-empty">
          <Sparkles size={16} />
          暂无待确认建议
        </div>
      ) : (
        <div className="suggestion-list">
          {pending.map((suggestion) => {
            const context = episodeContexts[suggestion.episodeId];
            const tagLabel = reviewTagLabel(suggestion.tagId);
            const instrumentName =
              context?.instrumentName ?? suggestion.instrumentId;
            const episodeLabel = context?.episodeLabel ?? "该回合";
            const disabled = busyId === suggestion.id;
            const selectedTagId =
              selectedTagIds[suggestion.id] ?? suggestion.tagId;
            const selectedTagLabel = reviewTagLabel(selectedTagId);
            return (
              <article key={suggestion.id}>
                <div className="suggestion-card-heading">
                  <div>
                    <strong>
                      {instrumentName}
                      {context
                        ? `（${context.instrumentSymbol}）· ${episodeLabel}`
                        : ` · ${episodeLabel}`}
                    </strong>
                    <span>{context?.dateRange}</span>
                  </div>
                  <b>{tagLabel}</b>
                </div>
                <p>{evidenceLabel(suggestion)}</p>
                <small>
                  规则 {suggestion.ruleId} · v{suggestion.ruleVersion}
                </small>
                <label className="suggestion-tag-edit">
                  <span>最终标签</span>
                  <select
                    aria-label={`调整“${tagLabel}”建议标签`}
                    value={selectedTagId}
                    disabled={disabled}
                    onChange={(event) =>
                      setSelectedTagIds((current) => ({
                        ...current,
                        [suggestion.id]: event.target.value,
                      }))
                    }
                  >
                    {REVIEW_TAGS.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="suggestion-actions">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onOpenEpisode(
                        context?.instrumentId ?? suggestion.instrumentId,
                        suggestion.episodeId,
                      )
                    }
                    aria-label={`查看${instrumentName}${episodeLabel}`}
                  >
                    <ExternalLink size={13} />
                    查看回合
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void decide(suggestion, onReject)}
                    aria-label={`否决“${tagLabel}”`}
                  >
                    <X size={13} />
                    否决
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      void decide(
                        suggestion,
                        selectedTagId === suggestion.tagId
                          ? onConfirm
                          : (item) => onEdit(item, selectedTagId),
                      )
                    }
                    aria-label={
                      selectedTagId === suggestion.tagId
                        ? `确认“${tagLabel}”`
                        : `确认改为“${selectedTagLabel}”`
                    }
                  >
                    <Check size={13} />
                    确认
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
