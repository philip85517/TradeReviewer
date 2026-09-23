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
  onRevoke?: (suggestion: TagSuggestionRecord) => void | Promise<void>;
  onOpenEpisode: (instrumentId: string, episodeId: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

function evidenceLabel(suggestion: TagSuggestionRecord) {
  const evidence = suggestion.evidence[0];
  if (!evidence) return "规则证据已记录";
  if (evidence.kind === "execution-count") {
    return `同一回合记录到 ${evidence.observed} 笔开仓方向成交（可能是一个订单的多笔成交，需订单标识或人工核对）`;
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
  onRevoke,
  onOpenEpisode,
  onBusyChange,
}: Props) {
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());
  const [showHistory, setShowHistory] = useState(false);
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
    onBusyChange?.(true);
    setBusyId(suggestion.id);
    setError(null);
    try {
      await action(suggestion);
      setResolved((current) => new Set(current).add(suggestion.id));
    } catch {
      setError("建议处理失败，请检查本机存储后重试");
    } finally {
      setBusyId(null);
      onBusyChange?.(false);
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
      {suggestions.some(item => item.status !== "suggested") && <button type="button" onClick={() => setShowHistory(value => !value)} aria-expanded={showHistory}>{showHistory ? "收起标签确认历史" : `查看标签确认历史（${suggestions.filter(item => item.status !== "suggested").length}）`}</button>}
      {showHistory && <div className="suggestion-history" aria-label="标签确认历史">{suggestions.filter(item => item.status !== "suggested").map(item => <article key={item.id}><span>{reviewTagLabel(item.finalTagId ?? item.tagId)} · {item.status === "rejected" ? "已否决" : "已确认"}</span>{item.status !== "rejected" && onRevoke && <button type="button" disabled={busyId !== null} onClick={() => void decide(item, onRevoke)}>撤销确认</button>}</article>)}</div>}
      <p>
        系统只根据成交与入场前 K 线提出自动标签建议；确认标签只记录分类，不表示策略已验证。
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
            const disabled = busyId !== null;
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
                <details><summary>计算规则</summary><small>
                  规则 {suggestion.ruleId} · v{suggestion.ruleVersion}
                </small></details>
                <label className="suggestion-tag-edit">
                  <span>最终标签（确认分类）</span>
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
                        ? `确认标签“${tagLabel}”`
                        : `确认标签改为“${selectedTagLabel}”`
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
