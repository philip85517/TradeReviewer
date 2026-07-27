import Decimal from "decimal.js";

import type {
  EpisodeReviewRecord,
  EpisodeReviewStatus,
} from "./types";

type NetPnlMetric = {
  netPnl: string | null;
};

export function createEmptyEpisodeReviewRecord(
  episodeId: string,
  instrumentId: string,
  updatedAt = new Date(0).toISOString(),
): EpisodeReviewRecord {
  return {
    version: 1,
    episodeId,
    instrumentId,
    updatedAt,
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

export function normalizeEpisodeReviewRecord(
  record: EpisodeReviewRecord,
): EpisodeReviewRecord {
  return {
    ...record,
    episodeId: clean(record.episodeId),
    instrumentId: clean(record.instrumentId),
    plan: {
      ...record.plan,
      thesis: clean(record.plan.thesis),
      expectedPath: clean(record.plan.expectedPath),
      invalidationCondition: clean(record.plan.invalidationCondition),
      targetRange: clean(record.plan.targetRange),
      plannedRiskAmount: clean(record.plan.plannedRiskAmount),
    },
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
