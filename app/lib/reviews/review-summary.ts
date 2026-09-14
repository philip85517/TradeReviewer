import Decimal from "decimal.js";

import { marketTradingDate } from "../market/trading-date";
import type {
  TradeLibraryEntry,
  TradeLibraryEpisode,
} from "../trades/library";
import type { RuleCheck } from "./types";

export type ReviewScope = {
  accountId: string;
  accountLabel: string;
  market: string;
  tradeNature: "live" | "simulation" | "unknown";
  simulationRunId: string | null;
  currency: string;
};

export type ReviewScopeOption = {
  id: string;
  label: string;
  scope: ReviewScope;
};

export type ReviewSummaryRange = {
  id: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
};

export type TrackedRuleCandidate = {
  sourceEpisodeId: string;
  sourceUpdatedAt: string;
  ruleText: string;
  sourceInstrumentId: string;
  sourceLabel: string;
};

export type ReviewSummaryNote = {
  version: 1;
  scopeId: string;
  rangeId: string;
  updatedAt: string;
  keep: string;
  change: string;
  next: string;
  evidenceEpisodeIds: string[];
};

export type TrackedRuleSummary = TrackedRuleCandidate & {
  checks: Array<RuleCheck & { episodeId: string }>;
};

export type ReviewPhaseSummary = {
  scopeId: string;
  scopeLabel: string;
  range: ReviewSummaryRange;
  episodeCount: number;
  reviewedCount: number;
  trustedClosedCount: number;
  netPnl: string;
  fees: string;
  wins: number;
  losses: number;
  planAdherence: {
    followed: number;
    deviated: number;
    noPlan: number;
    unassessed: number;
  };
  episodeIds: string[];
  trackedRules: TrackedRuleSummary[];
};

type EpisodeContext = {
  entry: TradeLibraryEntry;
  item: TradeLibraryEpisode;
  scope: ReviewScope;
  scopeId: string;
  rangeDate: string;
};

function natureLabel(value: ReviewScope["tradeNature"]) {
  if (value === "live") return "实盘";
  if (value === "simulation") return "模拟盘";
  return "来源未知";
}

function episodeScope(
  entry: TradeLibraryEntry,
  item: TradeLibraryEpisode,
): ReviewScope {
  const episode = item.episode;
  return {
    accountId: episode.accountId,
    accountLabel: episode.accountLabel,
    market: episode.instrument.market,
    tradeNature: entry.tradeNature ?? episode.tradeNature ?? "unknown",
    simulationRunId:
      episode.simulationRunId ?? entry.simulationRunId ?? null,
    currency: episode.instrument.currency,
  };
}

export function reviewScopeId(scope: ReviewScope) {
  return `review-scope:v1:${[
    scope.accountId,
    scope.market,
    scope.tradeNature,
    scope.simulationRunId ?? "",
    scope.currency,
  ]
    .map(encodeURIComponent)
    .join(":")}`;
}

function scopeLabel(scope: ReviewScope) {
  const run =
    scope.tradeNature === "simulation" && scope.simulationRunId
      ? ` · ${scope.simulationRunId}`
      : "";
  return `${scope.accountLabel} · ${scope.market} · ${natureLabel(scope.tradeNature)}${run} · ${scope.currency}`;
}

function contexts(entries: TradeLibraryEntry[]): EpisodeContext[] {
  return entries.flatMap((entry) =>
    entry.episodes.map((item) => {
      const scope = episodeScope(entry, item);
      const scopeId = reviewScopeId(scope);
      const rangeTimestamp = item.episode.endedAt ?? item.episode.startedAt;
      return {
        entry,
        item,
        scope,
        scopeId,
        rangeDate: marketTradingDate(
          rangeTimestamp,
          item.episode.instrument.market,
        ),
      };
    }),
  );
}

export function reviewScopeOptions(
  entries: TradeLibraryEntry[],
): ReviewScopeOption[] {
  const unique = new Map<string, ReviewScope>();
  for (const context of contexts(entries)) {
    if (!unique.has(context.scopeId)) {
      unique.set(context.scopeId, context.scope);
    }
  }
  return [...unique.entries()]
    .map(([id, scope]) => ({ id, scope, label: scopeLabel(scope) }))
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, "zh-CN") || a.id.localeCompare(b.id),
    );
}

export function filterTradeLibraryEntriesByScope(
  entries: TradeLibraryEntry[],
  scopeId: string,
  range?: ReviewSummaryRange,
): TradeLibraryEntry[] {
  return entries.flatMap((entry) => {
    const episodes = entry.episodes.filter(
      (item) => {
        if (reviewScopeId(episodeScope(entry, item)) !== scopeId) return false;
        const date = marketTradingDate(item.episode.endedAt ?? item.episode.startedAt, item.episode.instrument.market);
        return !range || ((!range.startDate || date >= range.startDate) && (!range.endDate || date <= range.endDate));
      },
    );
    if (episodes.length === 0) return [];
    const executionIds = new Set(
      episodes.flatMap(({ episode }) =>
        episode.executions.map(({ id }) => id),
      ),
    );
    return [
      {
        ...entry,
        episodes,
        executions: entry.executions.filter(({ id }) => executionIds.has(id)),
        episodeCount: episodes.length,
        tradeCount: executionIds.size,
      },
    ];
  });
}

function sameRuleScope(a: EpisodeContext, b: EpisodeContext) {
  return a.scopeId === b.scopeId;
}

function candidateFromContext(context: EpisodeContext): TrackedRuleCandidate | null {
  const review = context.item.review;
  const ruleText = review?.review.reusableRule.trim() ?? "";
  if (!review?.review.ruleTracking || ruleText.length === 0) return null;
  return {
    sourceEpisodeId: context.item.episode.id,
    sourceUpdatedAt: review.updatedAt,
    ruleText,
    sourceInstrumentId: context.entry.instrument.id,
    sourceLabel: `${context.entry.instrument.name} · ${marketTradingDate(
      context.item.episode.startedAt,
      context.entry.instrument.market,
    )}`,
  };
}

export function trackedRuleCandidates(
  entries: TradeLibraryEntry[],
  currentEpisodeId: string,
): TrackedRuleCandidate[] {
  const all = contexts(entries);
  const current = all.find(
    ({ item }) => item.episode.id === currentEpisodeId,
  );
  if (!current) return [];
  return all
    .filter(
      (context) =>
        context.item.episode.id !== currentEpisodeId &&
        context.item.episode.startedAt < current.item.episode.startedAt &&
        sameRuleScope(context, current),
    )
    .map(candidateFromContext)
    .filter((candidate): candidate is TrackedRuleCandidate => Boolean(candidate))
    .sort(
      (a, b) =>
        b.sourceUpdatedAt.localeCompare(a.sourceUpdatedAt) ||
        a.sourceEpisodeId.localeCompare(b.sourceEpisodeId),
    );
}

export function updateRuleCheck(
  checks: RuleCheck[],
  candidate: TrackedRuleCandidate,
  result: RuleCheck["result"],
): RuleCheck[] {
  const existing = checks.find(
    ({ sourceEpisodeId }) => sourceEpisodeId === candidate.sourceEpisodeId,
  );
  const next: RuleCheck = existing
    ? { ...existing, result }
    : {
        sourceEpisodeId: candidate.sourceEpisodeId,
        sourceUpdatedAt: candidate.sourceUpdatedAt,
        ruleText: candidate.ruleText,
        result,
      };
  return [
    ...checks.filter(
      ({ sourceEpisodeId }) => sourceEpisodeId !== candidate.sourceEpisodeId,
    ),
    next,
  ];
}

function withinRange(context: EpisodeContext, range: ReviewSummaryRange) {
  return (
    (range.startDate === null || context.rangeDate >= range.startDate) &&
    (range.endDate === null || context.rangeDate <= range.endDate)
  );
}

function trackedRulesForContexts(selected: EpisodeContext[], all: EpisodeContext[]) {
  const sources = new Map(all.map(context => [context.item.episode.id, context]));
  const rules = new Map<string, TrackedRuleSummary>();
  for (const context of selected) {
    const candidate = candidateFromContext(context);
    if (candidate) rules.set(candidate.sourceEpisodeId, { ...candidate, checks: [] });
  }
  for (const { item, scopeId } of selected) {
    for (const check of item.review?.review.ruleChecks ?? []) {
      const source = sources.get(check.sourceEpisodeId);
      if (check.sourceEpisodeId === item.episode.id || (source && (source.scopeId !== scopeId || source.item.episode.startedAt >= item.episode.startedAt))) continue;
      let rule = rules.get(check.sourceEpisodeId);
      if (!rule) {
        // A saved check remains evidence even after tracking is disabled or the source text is cleared.
        rule = {
          sourceEpisodeId: check.sourceEpisodeId,
          sourceUpdatedAt: check.sourceUpdatedAt,
          ruleText: check.ruleText,
          sourceInstrumentId: source?.entry.instrument.id ?? "",
          sourceLabel: source ? `${source.entry.instrument.name} · ${marketTradingDate(source.item.episode.startedAt, source.entry.instrument.market)}` : "已保存的来源回合",
          checks: [],
        };
        rules.set(check.sourceEpisodeId, rule);
      }
      rule.checks.push({ ...check, episodeId: item.episode.id });
    }
  }
  return [...rules.values()];
}

export function buildReviewPhaseSummary(
  entries: TradeLibraryEntry[],
  scopeId: string,
  range: ReviewSummaryRange,
): ReviewPhaseSummary {
  const scope = reviewScopeOptions(entries).find(({ id }) => id === scopeId);
  if (!scope) {
    return {
      scopeId,
      scopeLabel: "当前范围",
      range,
      episodeCount: 0,
      reviewedCount: 0,
      trustedClosedCount: 0,
      netPnl: "0",
      fees: "0",
      wins: 0,
      losses: 0,
      planAdherence: { followed: 0, deviated: 0, noPlan: 0, unassessed: 0 },
      episodeIds: [],
      trackedRules: [],
    };
  }
  const selected = contexts(entries)
    .filter(
      (context) => context.scopeId === scopeId && withinRange(context, range),
    )
    .sort(
      (a, b) =>
        b.rangeDate.localeCompare(a.rangeDate) ||
        b.item.episode.id.localeCompare(a.item.episode.id),
    );
  const trusted = selected.filter(
    ({ item }) =>
      item.episode.status === "closed" &&
      item.metrics.pnlAvailable !== false &&
      item.metrics.netPnl !== null,
  );
  const planAdherence = {
    followed: 0,
    deviated: 0,
    noPlan: 0,
    unassessed: 0,
  };
  for (const { item } of selected) {
    const value = item.review?.review.planAdherence ?? "unassessed";
    if (value === "followed") planAdherence.followed += 1;
    else if (value === "deviated") planAdherence.deviated += 1;
    else if (value === "no-plan") planAdherence.noPlan += 1;
    else planAdherence.unassessed += 1;
  }
  return {
    scopeId,
    scopeLabel: scope.label,
    range,
    episodeCount: selected.length,
    reviewedCount: selected.filter(
      ({ item }) => item.review?.review.completed,
    ).length,
    trustedClosedCount: trusted.length,
    netPnl: trusted
      .reduce(
        (sum, { item }) => sum.plus(item.metrics.netPnl as string),
        new Decimal(0),
      )
      .toString(),
    fees: trusted
      .reduce(
        (sum, { item }) => sum.plus(item.metrics.fees),
        new Decimal(0),
      )
      .toString(),
    wins: trusted.filter(
      ({ item }) => new Decimal(item.metrics.netPnl as string).greaterThan(0),
    ).length,
    losses: trusted.filter(
      ({ item }) => new Decimal(item.metrics.netPnl as string).lessThan(0),
    ).length,
    planAdherence,
    episodeIds: selected.map(({ item }) => item.episode.id),
    trackedRules: trackedRulesForContexts(selected, contexts(entries)),
  };
}

export function isReviewSummaryNote(value: unknown): value is ReviewSummaryNote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const note = value as Record<string, unknown>;
  return (
    note.version === 1 &&
    typeof note.scopeId === "string" &&
    note.scopeId.startsWith("review-scope:v1:") &&
    typeof note.rangeId === "string" &&
    note.rangeId.length > 0 &&
    typeof note.updatedAt === "string" &&
    Number.isFinite(Date.parse(note.updatedAt)) &&
    typeof note.keep === "string" &&
    typeof note.change === "string" &&
    typeof note.next === "string" &&
    Array.isArray(note.evidenceEpisodeIds) &&
    note.evidenceEpisodeIds.every(
      (episodeId) => typeof episodeId === "string" && episodeId.length > 0,
    )
  );
}

export function reviewSummarySettingKey(scopeId: string, rangeId: string) {
  return `review-summary:v1:${encodeURIComponent(scopeId)}:${encodeURIComponent(rangeId)}`;
}
