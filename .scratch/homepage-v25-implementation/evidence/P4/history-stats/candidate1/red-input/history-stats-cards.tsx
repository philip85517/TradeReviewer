"use client";

import type { HomepageV25Metric } from "../../lib/reviews/homepage-v25-performance";

export type HistoryStatsObservation = Readonly<{ value: string | null; available: boolean; reasons: readonly string[] }>;
export type HistoryStatsMoney = Readonly<Omit<HomepageV25Metric, "coverage" | "reasons" | "money"> & {
  coverage: Readonly<HomepageV25Metric["coverage"]>;
  reasons: readonly string[];
  money: Readonly<Omit<HomepageV25Metric["money"], "fx"> & { fx: Readonly<NonNullable<HomepageV25Metric["money"]["fx"]>> | null }>;
}>;
export type HistoryStatsSummary = Readonly<{
  closedNet: HistoryStatsMoney;
  allocatedFees: HistoryStatsMoney;
  closedRounds: HistoryStatsObservation;
  winningRounds: HistoryStatsObservation;
  /** Already committed percentage in 0..100 units, never a ratio to calculate here. */
  winRate: HistoryStatsObservation;
}>;
export type HistoryStatsCardsProps = Readonly<{
  /** Caller retains the complete committed summary through pending/error. No local financial cache. */
  summary: HistoryStatsSummary | null;
  reportCurrency: string;
  sourceId: string | null;
  requestGeneration: string | null;
  status: Readonly<{ kind: "ready" }> | Readonly<{ kind: "pending" | "error" | "empty"; reason: string }>;
}>;

export function HistoryStatsCards(_props: HistoryStatsCardsProps) {
  return null;
}
