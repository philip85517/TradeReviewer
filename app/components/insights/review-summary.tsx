"use client";

import { BookOpenCheck, ExternalLink, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";

import {
  buildReviewPhaseSummary,
  reviewScopeOptions,
  type ReviewSummaryNote,
  type ReviewSummaryRange,
} from "../../lib/reviews/review-summary";
import type { ReviewSummaryClient } from "../../lib/storage/review-summary-client";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import styles from "./review-summary.module.css";

type Props = {
  entries: TradeLibraryEntry[];
  draftStore?: { drafts: ReviewSummaryDrafts; setDrafts: Dispatch<SetStateAction<ReviewSummaryDrafts>> };
  filterStore?: { filters: ReviewSummaryFilters; setFilters: Dispatch<SetStateAction<ReviewSummaryFilters>> };
  scopeId: string;
  onScopeChange: (scopeId: string) => void;
  client: ReviewSummaryClient;
  onOpenEpisode: (instrumentId: string, episodeId: string) => void;
  today?: string;
  children?: (range: ReviewSummaryRange) => ReactNode;
  activeTab?: ReviewSummaryTab;
  onTabChange?: (tab: ReviewSummaryTab) => void;
  onImport?: () => void;
};

export type ReviewSummaryTab = "summary" | "patterns";

type Preset = "all" | "last-30" | "last-90" | "custom";
export type ReviewSummaryFilters = { preset: Preset; customStart: string; customEnd: string };
export function initialReviewSummaryFilters(today = new Intl.DateTimeFormat("sv-SE").format(new Date())): ReviewSummaryFilters {
  return { preset: "all", customStart: today, customEnd: today };
}
export type ReviewSummaryDrafts = Record<string, Draft>;
type Draft = {
  note: ReviewSummaryNote;
  loaded: boolean;
  dirty: boolean;
};

function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function rangeFor(
  preset: Preset,
  today: string,
  customStart: string,
  customEnd: string,
): ReviewSummaryRange {
  if (preset === "all") {
    return { id: "all", label: "全部", startDate: null, endDate: null };
  }
  if (preset === "last-30" || preset === "last-90") {
    const days = preset === "last-30" ? 30 : 90;
    const startDate = subtractDays(today, days - 1);
    return {
      id: `custom:${startDate}:${today}`,
      label: `最近 ${days} 天（${startDate}—${today}）`,
      startDate,
      endDate: today,
    };
  }
  const startDate = customStart || today;
  const endDate = customEnd || today;
  return {
    id: `custom:${startDate}:${endDate}`,
    label: `${startDate}—${endDate}`,
    startDate,
    endDate,
  };
}

function emptyNote(scopeId: string, rangeId: string): ReviewSummaryNote {
  return {
    version: 1,
    scopeId,
    rangeId,
    updatedAt: "",
    keep: "",
    change: "",
    next: "",
    evidenceEpisodeIds: [],
    tag: "",
    sentence: "",
    observationVersion: "v1",
    followUpStartDate: null,
    followUpEndDate: null,
  };
}

function money(value: string, currency: string, signDisplay: Intl.NumberFormatOptions["signDisplay"] = "always") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay,
  }).format(Number(value));
}

export function ReviewSummary({
  entries,
  draftStore,
  filterStore,
  scopeId,
  onScopeChange,
  client,
  onOpenEpisode,
  children,
  today = new Intl.DateTimeFormat("sv-SE").format(new Date()),
  activeTab,
  onTabChange,
  onImport,
}: Props) {
  const scopes = useMemo(() => reviewScopeOptions(entries), [entries]);
  const [localActiveTab, setLocalActiveTab] = useState<ReviewSummaryTab>("summary");
  const selectedTab = activeTab ?? localActiveTab;
  const changeTab = (tab: ReviewSummaryTab) => {
    if (activeTab === undefined) setLocalActiveTab(tab);
    onTabChange?.(tab);
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
    const currentIndex = tabs.indexOf(document.activeElement as HTMLElement);
    if (currentIndex < 0) return;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab.focus();
    changeTab(nextTab.dataset.tab as ReviewSummaryTab);
  };
  const [localFilters, setLocalFilters] = useState(() => initialReviewSummaryFilters(today));
  const { filters, setFilters } = filterStore ?? { filters: localFilters, setFilters: setLocalFilters };
  const { preset, customStart, customEnd } = filters;
  const [localDrafts, setLocalDrafts] = useState<ReviewSummaryDrafts>({});
  const { drafts, setDrafts } = draftStore ?? { drafts: localDrafts, setDrafts: setLocalDrafts };
  const draftsRef = useRef(drafts);
  useEffect(() => { draftsRef.current = drafts; }, [drafts]);
  const [retry, setRetry] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const range = useMemo(
    () => rangeFor(preset, today, customStart, customEnd),
    [customEnd, customStart, preset, today],
  );
  const key = `${scopeId}|${range.id}`;
  const current = drafts[key] ?? {
    note: emptyNote(scopeId, range.id),
    loaded: false,
    dirty: false,
  };
  const summary = useMemo(
    () => buildReviewPhaseSummary(entries, scopeId, range),
    [entries, range, scopeId],
  );
  const scope = scopes.find(({ id }) => id === scopeId);

  useEffect(() => {
    if (!scopeId) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setMessage("");
      setLoadFailed(false);
    });
    if (draftsRef.current[key]?.loaded) return () => { active = false; };
    void client
      .get(scopeId, range.id)
      .then((saved) => {
        if (!active) return;
        setDrafts((all) => {
          const existing = all[key];
          if (existing?.dirty || existing?.loaded) return all;
          return {
            ...all,
            [key]: {
              note: saved ?? emptyNote(scopeId, range.id),
              loaded: true,
              dirty: false,
            },
          };
        });
      })
      .catch(() => {
        if (!active) return;
        setLoadFailed(true);
        setMessage("阶段总结读取失败，可稍后重试");
      });
    return () => {
      active = false;
    };
  }, [client, key, range.id, scopeId, retry, setDrafts]);

  const update = (patch: Partial<ReviewSummaryNote>) => {
    if (!current.loaded || saving) return;
    setDrafts((all) => ({
      ...all,
      [key]: {
        note: { ...(all[key]?.note ?? current.note), ...patch },
        loaded: true,
        dirty: true,
      },
    }));
    setMessage("");
  };

  const validRange = !range.startDate || !range.endDate || range.startDate <= range.endDate;
  const save = async () => {
    if (!current.loaded || saving || !validRange) return;
    setSaving(true);
    setMessage("");
    const note = {
      ...current.note,
      version: 1 as const,
      scopeId,
      rangeId: range.id,
      updatedAt: new Date().toISOString(),
    };
    try {
      const saved = await client.put(note);
      setDrafts((all) => {
        // A remounted editor may already have a newer draft while this write finishes.
        if (all[key]?.note !== current.note) return all;
        return {
          ...all,
          [key]: { note: saved, loaded: true, dirty: false },
        };
      });
      setMessage("阶段总结已保存");
    } catch {
      setMessage("保存失败：记录已更新或本机存储不可用");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="review-summary" aria-label="模式洞察">
      <header>
        <div>
          <span className="eyebrow">Trading Insights</span>
          <h1>模式洞察</h1>
        </div>
        <BookOpenCheck size={20} />
      </header>

      <nav className="module-tabs" role="tablist" aria-label="模式洞察视图" onKeyDown={handleTabKeyDown}>
        <button
          type="button"
          role="tab"
          id="review-summary-tab-summary"
          data-tab="summary"
          aria-selected={selectedTab === "summary"}
          aria-controls="review-summary-panel-summary"
          onClick={() => changeTab("summary")}
        >
          阶段总结
        </button>
        <button
          type="button"
          role="tab"
          id="review-summary-tab-patterns"
          data-tab="patterns"
          aria-selected={selectedTab === "patterns"}
          aria-controls="review-summary-panel-patterns"
          onClick={() => changeTab("patterns")}
        >
          模式分析
        </button>
      </nav>

      {scopes.length === 0 ? (
        <section className="review-summary-empty" aria-label="暂无交易范围">
          <h2>还没有可用的交易范围</h2>
          <p>导入交易数据后，才能查看阶段总结和模式分析。</p>
          {onImport && (
            <button type="button" onClick={onImport}>
              导入交易数据
            </button>
          )}
        </section>
      ) : <>
      <fieldset disabled={saving} className="review-summary-controls">
        <label>
          <span>统计范围</span>
          <select
            aria-label="总结统计范围"
            value={scopeId}
            onChange={(event) => onScopeChange(event.target.value)}
          >
            {scopes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>日期</span>
          <select
            aria-label="总结日期范围"
            value={preset}
            onChange={(event) => setFilters(current => ({...current, preset: event.target.value as Preset}))}
          >
            <option value="all">全部</option>
            <option value="last-30">最近 30 天</option>
            <option value="last-90">最近 90 天</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        {preset === "custom" && (
          <div className="review-summary-custom-range">
            <label>
              <span>开始日期</span>
              <input
                type="date"
                value={customStart}
                onChange={(event) => setFilters(current => ({...current, customStart: event.target.value}))}
              />
            </label>
            <label>
              <span>结束日期</span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setFilters(current => ({...current, customEnd: event.target.value}))}
              />
            </label>
          </div>
        )}
      </fieldset>

      {!validRange && <p role="alert">开始日期不能晚于结束日期</p>}
      <div
        role="tabpanel"
        id="review-summary-panel-summary"
        aria-labelledby="review-summary-tab-summary"
        hidden={selectedTab !== "summary"}
      >
      <p className="review-summary-scope">
        {summary.scopeLabel} · {range.label} · 共 {summary.episodeCount} 个回合
      </p>
      <p className="review-summary-basis">
        日期按已平仓回合结束日；未平仓回合按开始日。
      </p>

      <div className="review-summary-metrics">
        <article>
          <span>复盘覆盖</span>
          <strong>{summary.reviewedCount} / {summary.episodeCount}</strong>
        </article>
        <article>
          <span>可信已平仓</span>
          <strong>{summary.trustedClosedCount}</strong>
        </article>
        <article>
          <span>净盈亏</span>
          <strong>{summary.trustedClosedCount ? money(summary.netPnl, scope?.scope.currency ?? "USD") : "—"}</strong>
        </article>
        <article>
          <span>费用</span>
          <strong>{summary.trustedClosedCount ? money(summary.fees, scope?.scope.currency ?? "USD", "auto") : "—"}</strong>
        </article>
        <article>
          <span>胜 / 负</span>
          <strong>{summary.wins} / {summary.losses}</strong>
        </article>
        <article>
          <span>计划符合 / 偏离</span>
          <strong>{summary.planAdherence.followed} / {summary.planAdherence.deviated}</strong>
        </article>
      </div>

      <p className="review-summary-basis">当时无计划 {summary.planAdherence.noPlan} 个 · 尚未评估 {summary.planAdherence.unassessed} 个。过程判断由你记录，盈亏不代表过程质量。</p>

      {summary.trackedRules.length > 0 && (
        <details className="review-summary-rules">
          <summary>此前行动与后续检查（{summary.trackedRules.length}）</summary>
          {summary.trackedRules.map((rule) => (
            <article key={rule.sourceEpisodeId}>
              <p>{rule.ruleText}</p>
              <small>
                {rule.sourceLabel} · 后续检查 {rule.checks.length} 次
              </small>
              {rule.checks.map(check => <p key={check.episodeId}>当时规则：{check.ruleText} · {{ followed: "遵守", deviated: "偏离", "not-applicable": "不适用" }[check.result]}</p>)}
              {rule.sourceInstrumentId && <button
                type="button"
                disabled={saving}
                onClick={() =>
                  onOpenEpisode(rule.sourceInstrumentId, rule.sourceEpisodeId)
                }
              >
                <ExternalLink size={13} />
                来源回合
              </button>}
            </article>
          ))}
        </details>
      )}

      <fieldset disabled={!current.loaded || saving || !validRange} className={`${styles.notes} review-summary-notes`}>
        <label>
          <span>本期标签（可选）</span>
          <input
            aria-label="本期标签（可选）"
            value={current.note.tag ?? ""}
            onChange={(event) => update({ tag: event.target.value })}
          />
        </label>
        <label>
          <span>一句话判断（可选）</span>
          <textarea
            aria-label="一句话判断（可选）"
            value={current.note.sentence ?? ""}
            onChange={(event) => update({ sentence: event.target.value })}
          />
        </label>
        <label>
          <span>观察口径版本</span>
          <input aria-label="观察口径版本" value={current.note.observationVersion ?? "v1"} onChange={event => update({ observationVersion: event.target.value })} />
        </label>
        <label>
          <span>后续观察期（可选）</span>
          <span className={styles.followUpDates}>
            <input aria-label="后续观察开始日期" type="date" value={current.note.followUpStartDate ?? ""} onChange={event => update({ followUpStartDate: event.target.value || null })} />
            <input aria-label="后续观察结束日期" type="date" value={current.note.followUpEndDate ?? ""} onChange={event => update({ followUpEndDate: event.target.value || null })} />
          </span>
        </label>
        <details className={styles.legacyDetails}>
          <summary>兼容旧版三栏记录（可选）</summary>
          <label><span>保持</span><textarea aria-label="保持" value={current.note.keep} onChange={(event) => update({ keep: event.target.value })} /></label>
          <label><span>修正</span><textarea aria-label="修正" value={current.note.change} onChange={(event) => update({ change: event.target.value })} /></label>
          <label><span>下期重点</span><textarea aria-label="下期重点" value={current.note.next} onChange={(event) => update({ next: event.target.value })} /></label>
        </details>
      </fieldset>

      <details className="review-summary-evidence">
        <summary>总结证据（{current.note.evidenceEpisodeIds.length}）</summary>
        {summary.episodeIds.map((episodeId) => {
          const entry = entries.find(entry => entry.episodes.some(item => item.episode.id === episodeId));
          const item = entry?.episodes.find(item => item.episode.id === episodeId);
          const label = `${entry?.instrument.name ?? "回合"} · ${item?.episode.startedAt.slice(0, 10) ?? ""}`;
          return <div key={episodeId}><label>
            <input
              type="checkbox"
              disabled={!current.loaded || saving || !validRange}
              aria-label={`作为总结证据 ${episodeId}`}
              checked={current.note.evidenceEpisodeIds.includes(episodeId)}
              onChange={(event) =>
                update({
                  evidenceEpisodeIds: event.target.checked
                    ? [...current.note.evidenceEpisodeIds, episodeId]
                    : current.note.evidenceEpisodeIds.filter(
                        (id) => id !== episodeId,
                      ),
                })
              }
            />
            <span>{label}</span>
          </label>{entry && <button type="button" disabled={saving} onClick={() => onOpenEpisode(entry.instrument.id, episodeId)}>查看回合</button>}</div>;
        })}
      </details>

      <footer>
        {message && <span role="status">{message}</span>}
        {loadFailed && <button type="button" onClick={() => setRetry(value => value + 1)}>重试读取阶段总结</button>}
        <button
          type="button"
          disabled={saving || !current.loaded || !validRange}
          onClick={() => void save()}
          aria-label="保存阶段总结"
        >
          <Save size={14} />
          {saving ? "保存中…" : "保存阶段总结"}
        </button>
      </footer>
      </div>
      <div
        role="tabpanel"
        id="review-summary-panel-patterns"
        aria-labelledby="review-summary-tab-patterns"
        hidden={selectedTab !== "patterns" || !validRange}
      >{validRange ? children?.(range) : null}</div>
      </>}
    </section>
  );
}
