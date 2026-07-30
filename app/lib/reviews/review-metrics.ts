import Decimal from "decimal.js";

import type {
  EpisodePlan,
  EpisodeReviewRecord,
  EpisodeReviewStatus,
} from "./types";

type NetPnlMetric = {
  netPnl: string | null;
};

export function episodeReviewStatus(
  record?: EpisodeReviewRecord,
): EpisodeReviewStatus {
  return record?.review.completed ? "completed" : "pending";
}

export function calculateRMultiple(
  metrics: NetPnlMetric,
  plannedRiskAmount: string,
) {
  if (metrics.netPnl === null || plannedRiskAmount.trim() === "") {
    return null;
  }
  try {
    const risk = new Decimal(plannedRiskAmount);
    const netPnl = new Decimal(metrics.netPnl);
    if (!risk.isFinite() || !risk.gt(0) || !netPnl.isFinite()) {
      return null;
    }
    const result = netPnl.div(risk);
    return result.isFinite() ? result.toString() : null;
  } catch {
    return null;
  }
}

export function isValidPlannedRiskAmount(value: string) {
  if (value.trim() === "") return true;
  try {
    const risk = new Decimal(value);
    return risk.isFinite() && risk.gt(0);
  } catch {
    return false;
  }
}

function clean(value: string) {
  return value.trim();
}

function normalizePlan(plan: EpisodePlan): EpisodePlan {
  return {
    ...plan,
    thesis: clean(plan.thesis),
    expectedPath: clean(plan.expectedPath),
    invalidationCondition: clean(plan.invalidationCondition),
    targetRange: clean(plan.targetRange),
    plannedRiskAmount: clean(plan.plannedRiskAmount),
  };
}

function normalizedPlanRevisions(record: EpisodeReviewRecord) {
  if (!record.planRevisions) return undefined;
  const revisions = new Map(
    record.planRevisions
      .filter((revision) => !Number.isNaN(Date.parse(revision.knowledgeAt)))
      .map((revision) => [
        revision.knowledgeAt,
        {
          knowledgeAt: revision.knowledgeAt,
          plan: normalizePlan(revision.plan),
        },
      ]),
  );
  return [...revisions.values()].sort((left, right) =>
    left.knowledgeAt.localeCompare(right.knowledgeAt),
  );
}

export function episodePlanAtCursor(
  record: EpisodeReviewRecord | undefined,
  cursor: string,
): EpisodePlan | undefined {
  if (!record) return undefined;
  if (!record.planRevisions) return record.plan;
  return normalizedPlanRevisions(record)
    ?.findLast((revision) => revision.knowledgeAt <= cursor)
    ?.plan;
}

export function mergeEpisodePlanRevision(input: {
  record: EpisodeReviewRecord;
  knowledgeAt: string;
  episodeStartedAt: string;
  plan: EpisodePlan;
}): EpisodeReviewRecord {
  const existing = normalizedPlanRevisions(input.record) ?? [
    {
      knowledgeAt: input.episodeStartedAt,
      plan: normalizePlan(input.record.plan),
    },
  ];
  const revisions = [
    ...existing.filter(
      (revision) => revision.knowledgeAt !== input.knowledgeAt,
    ),
    {
      knowledgeAt: input.knowledgeAt,
      plan: normalizePlan(input.plan),
    },
  ].sort((left, right) =>
    left.knowledgeAt.localeCompare(right.knowledgeAt),
  );

  return {
    ...input.record,
    plan: revisions.at(-1)?.plan ?? normalizePlan(input.plan),
    planRevisions: revisions,
  };
}

export function normalizeEpisodeReviewRecord(
  record: EpisodeReviewRecord,
): EpisodeReviewRecord {
  const planRevisions = normalizedPlanRevisions(record);
  return {
    ...record,
    episodeId: clean(record.episodeId),
    instrumentId: clean(record.instrumentId),
    plan: normalizePlan(record.plan),
    ...(planRevisions ? { planRevisions } : {}),
    review: {
      ...record.review,
      riskManagement: clean(record.review.riskManagement),
      psychology: clean(record.review.psychology),
      reusableRule: clean(record.review.reusableRule),
    },
    confirmedTagIds: [
      ...new Set(record.confirmedTagIds.map(clean).filter(Boolean)),
    ],
  };
}
