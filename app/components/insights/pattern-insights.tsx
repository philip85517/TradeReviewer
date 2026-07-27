"use client";

import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  Database,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  InsightEpisodeExclusion,
  InsightEpisodeFact,
} from "../../lib/insights/episode-facts";
import type {
  InsightCategory,
  PatternInsight,
  PatternInsightReport,
} from "../../lib/insights/insight-engine";
import type { TagSuggestionRecord } from "../../lib/insights/types";
import { formatMarketTradingDate } from "../../lib/market/trading-date";
import {
  TagSuggestionPanel,
  type SuggestionEpisodeContext,
} from "./tag-suggestion-panel";

type Category = "all" | InsightCategory;

type Props = {
  report: PatternInsightReport;
  facts: InsightEpisodeFact[];
  suggestions: TagSuggestionRecord[];
  episodeContexts: Record<string, SuggestionEpisodeContext>;
  onConfirmSuggestion: (
    suggestion: TagSuggestionRecord,
  ) => void | Promise<void>;
  onEditSuggestion: (
    suggestion: TagSuggestionRecord,
    finalTagId: string,
  ) => void | Promise<void>;
  onRejectSuggestion: (
    suggestion: TagSuggestionRecord,
  ) => void | Promise<void>;
  onOpenEpisode: (instrumentId: string, episodeId: string) => void;
};

const CATEGORY_OPTIONS: Array<{
  id: Category;
  label: string;
  ariaLabel: string;
}> = [
  { id: "all", label: "全部", ariaLabel: "查看全部洞察" },
  {
    id: "condition",
    label: "交易条件",
    ariaLabel: "只看交易条件",
  },
  { id: "pattern", label: "图形模式", ariaLabel: "只看图形模式" },
  {
    id: "execution-psychology",
    label: "执行与心理",
    ariaLabel: "只看执行与心理",
  },
];

function percent(value: string) {
  return `${value}%`;
}

function basisLabel(insight: PatternInsight) {
  return insight.metricBasis === "r-multiple"
    ? "计划风险 R"
    : "费用后收益率";
}

function confidenceLabel(insight: PatternInsight) {
  if (insight.confidence === "high-confidence") return "高可信洞察";
  if (insight.confidence === "usable") return "可用洞察";
  return "早期线索";
}

function metricSuffix(insight: PatternInsight) {
  return insight.metricBasis === "r-multiple" ? "R" : "%";
}

function versionLabel(insight: PatternInsight) {
  const tags =
    insight.tagDictionaryVersion === null
      ? []
      : [`标签字典 v${insight.tagDictionaryVersion}`];
  const rules = insight.ruleVersions.map(
    ({ ruleId, ruleVersion }) => `${ruleId} v${ruleVersion}`,
  );
  return [...tags, `计算 v${insight.calculationVersion}`, ...rules].join(
    " · ",
  );
}

function EpisodeLink({
  fact,
  kind,
  metricBasis,
  onOpenEpisode,
}: {
  fact: InsightEpisodeFact;
  kind: "证据" | "反例" | "基准";
  metricBasis: PatternInsight["metricBasis"];
  onOpenEpisode: Props["onOpenEpisode"];
}) {
  return (
    <button
      type="button"
      className="insight-episode-row"
      aria-label={`查看${kind} ${fact.instrumentName} ${fact.instrumentSymbol}`}
      onClick={() => onOpenEpisode(fact.instrumentId, fact.episodeId)}
    >
      <span>
        <strong>
          {fact.instrumentName}（{fact.instrumentSymbol}）
        </strong>
        <small>
          {formatMarketTradingDate(fact.startedAt, fact.market)}—
          {formatMarketTradingDate(fact.endedAt, fact.market)}
        </small>
      </span>
      <b>
        {metricBasis === "r-multiple"
          ? `${fact.rMultiple ?? "—"}R`
          : `${fact.returnPercent ?? "—"}%`}
      </b>
      <ChevronRight size={14} />
    </button>
  );
}

function InsightCard({
  insight,
  factsByEpisode,
  onOpenEpisode,
  early = false,
}: {
  insight: PatternInsight;
  factsByEpisode: Map<string, InsightEpisodeFact>;
  onOpenEpisode: Props["onOpenEpisode"];
  early?: boolean;
}) {
  const suffix = metricSuffix(insight);
  const evidence = insight.evidenceEpisodeIds
    .map((id) => factsByEpisode.get(id))
    .filter((item): item is InsightEpisodeFact => Boolean(item));
  const counterexamples = insight.counterexampleEpisodeIds
    .map((id) => factsByEpisode.get(id))
    .filter((item): item is InsightEpisodeFact => Boolean(item));
  const baseline = insight.baselineEpisodeIds
    .map((id) => factsByEpisode.get(id))
    .filter((item): item is InsightEpisodeFact => Boolean(item));
  return (
    <article className={`insight-card ${early ? "early" : ""}`}>
      <header>
        <div>
          <span className="insight-confidence">
            {confidenceLabel(insight)}
          </span>
          {early && <b>样本不足，仅供观察</b>}
          <h3>{insight.dimension.label}</h3>
        </div>
        <span>
          {insight.sampleCount} 个标签样本 · {insight.baselineCount} 个基准样本
        </span>
      </header>
      <p>{insight.conclusion}</p>
      <div className="insight-basis">
        <span>口径：{basisLabel(insight)}</span>
        <span>
          {new Date(insight.timeRange.start).toLocaleDateString("zh-CN")}—
          {new Date(insight.timeRange.end).toLocaleDateString("zh-CN")}
        </span>
      </div>
      <div className="insight-metrics">
        <span>中位 {insight.medianTagged}{suffix}</span>
        <span>
          基准{" "}
          {insight.medianBaseline === null
            ? "不足"
            : `${insight.medianBaseline}${suffix}`}
        </span>
        <span>胜率 {percent(insight.winRate)}</span>
        <span>净盈亏 {insight.netPnl}</span>
        <span>MFE {percent(insight.medianMfePercent)}</span>
        <span>MAE {percent(insight.medianMaePercent)}</span>
        <span>回吐 {percent(insight.medianGivebackPercent)}</span>
        {insight.planAdherenceRate !== null && (
          <span>计划遵守 {percent(insight.planAdherenceRate)}</span>
        )}
      </div>
      <div className="insight-version">{versionLabel(insight)}</div>
      <div className="insight-evidence-grid">
        <details open>
          <summary>证据交易（{evidence.length}）</summary>
          {evidence.map((fact) => (
            <EpisodeLink
              key={fact.episodeId}
              fact={fact}
              kind="证据"
              metricBasis={insight.metricBasis}
              onOpenEpisode={onOpenEpisode}
            />
          ))}
          {evidence.length === 0 && <p>当前样本没有正结果证据。</p>}
        </details>
        <details open>
          <summary>反例（{counterexamples.length}）</summary>
          {counterexamples.map((fact) => (
            <EpisodeLink
              key={fact.episodeId}
              fact={fact}
              kind="反例"
              metricBasis={insight.metricBasis}
              onOpenEpisode={onOpenEpisode}
            />
          ))}
          {counterexamples.length === 0 && <p>当前样本没有负结果反例。</p>}
        </details>
        <details>
          <summary>基准组（{baseline.length}）</summary>
          {baseline.map((fact) => (
            <EpisodeLink
              key={fact.episodeId}
              fact={fact}
              kind="基准"
              metricBasis={insight.metricBasis}
              onOpenEpisode={onOpenEpisode}
            />
          ))}
        </details>
      </div>
    </article>
  );
}

function ExclusionList({
  exclusions,
}: {
  exclusions: InsightEpisodeExclusion[];
}) {
  if (exclusions.length === 0) return null;
  return (
    <section className="insight-exclusions" aria-label="未进入统计的回合">
      <header>
        <AlertTriangle size={15} />
        <h2>未进入统计的回合</h2>
        <span>{exclusions.length}</span>
      </header>
      <div>
        {exclusions.map((item) => (
          <article key={`${item.episodeId}:${item.reason}`}>
            <span>
              <strong>{item.instrumentName}</strong>
              <small>
                {new Date(item.startedAt).toLocaleDateString("zh-CN")}
              </small>
            </span>
            <b>{item.reasonLabel}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PatternInsights({
  report,
  facts,
  suggestions,
  episodeContexts,
  onConfirmSuggestion,
  onEditSuggestion,
  onRejectSuggestion,
  onOpenEpisode,
}: Props) {
  const [category, setCategory] = useState<Category>("all");
  const factsByEpisode = useMemo(
    () => new Map(facts.map((fact) => [fact.episodeId, fact])),
    [facts],
  );
  const matches = (insight: PatternInsight) =>
    category === "all" || insight.category === category;
  const formal = report.formalInsights.filter(matches).slice(0, 5);
  const early = report.earlySignals.filter(matches);
  const descriptive = report.descriptiveStatistics.filter(matches);
  const hasAny =
    formal.length > 0 || early.length > 0 || descriptive.length > 0;

  return (
    <section className="pattern-insights" aria-label="模式洞察页面">
      <header className="insights-header">
        <div>
          <span className="eyebrow">Pattern Insights</span>
          <h1>模式洞察</h1>
          <p>
            只使用本机结构化事实与用户确认标签；结论描述相关性，不提供交易建议。
          </p>
        </div>
        <div className="insights-summary">
          <Database size={15} />
          <span>{facts.length} 个合格回合</span>
          <b>
            {report.metricBasis === "r-multiple" ? "R 口径" : "收益率口径"}
          </b>
        </div>
      </header>

      <TagSuggestionPanel
        suggestions={suggestions}
        episodeContexts={episodeContexts}
        onConfirm={onConfirmSuggestion}
        onEdit={onEditSuggestion}
        onReject={onRejectSuggestion}
        onOpenEpisode={onOpenEpisode}
      />

      <nav className="insight-category-tabs" aria-label="洞察分类">
        {CATEGORY_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.id}
            className={category === option.id ? "active" : ""}
            aria-label={option.ariaLabel}
            aria-current={category === option.id ? "page" : undefined}
            onClick={() => setCategory(option.id)}
          >
            {option.label}
          </button>
        ))}
      </nav>

      {!hasAny && (
        <section className="insights-empty">
          <BarChart3 size={22} />
          <h2>还没有足够样本形成模式</h2>
          <p>至少需要 3 个可比较回合才会显示早期线索。</p>
        </section>
      )}

      {formal.length > 0 && (
        <section className="insight-section" aria-label="正式洞察">
          <header>
            <BookOpenCheck size={16} />
            <h2>正式洞察</h2>
            <span>首页最多显示 5 条</span>
          </header>
          <div className="insight-card-list">
            {formal.map((item) => (
              <InsightCard
                key={item.id}
                insight={item}
                factsByEpisode={factsByEpisode}
                onOpenEpisode={onOpenEpisode}
              />
            ))}
          </div>
        </section>
      )}

      {early.length > 0 && (
        <section className="insight-section" aria-label="早期线索">
          <header>
            <BarChart3 size={16} />
            <h2>早期线索</h2>
            <span>3–4 个样本</span>
          </header>
          <div className="insight-card-list">
            {early.map((item) => (
              <InsightCard
                key={item.id}
                insight={item}
                factsByEpisode={factsByEpisode}
                onOpenEpisode={onOpenEpisode}
                early
              />
            ))}
          </div>
        </section>
      )}

      {descriptive.length > 0 && (
        <section className="insight-section" aria-label="描述统计">
          <header>
            <Database size={16} />
            <h2>描述统计</h2>
            <span>基准样本少于 3，不比较差异</span>
          </header>
          <div className="insight-card-list">
            {descriptive.map((item) => (
              <InsightCard
                key={item.id}
                insight={item}
                factsByEpisode={factsByEpisode}
                onOpenEpisode={onOpenEpisode}
              />
            ))}
          </div>
        </section>
      )}

      <ExclusionList exclusions={report.excluded} />
    </section>
  );
}
