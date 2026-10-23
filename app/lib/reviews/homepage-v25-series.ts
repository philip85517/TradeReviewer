import {
  projectHomepageV25Boundaries,
  HomepageV25ProjectionInputError,
  type EndpointMetrics,
  type HomepageV25BoundaryBatch,
  type HomepageV25BoundaryPoint,
  type HomepageV25Period,
  type HomepageV25PreparedSource,
} from "./homepage-v25-performance";

export const HOMEPAGE_V25_TOOLTIP_FIELDS = Object.freeze([
  "marketValue", "unrealizedNet", "lifetimeRealizedNet", "lifetimeNet", "net", "periodFees",
] as const satisfies readonly (keyof EndpointMetrics)[]);

export type HomepageV25SeriesInput = Readonly<{
  period: Readonly<HomepageV25Period>;
  asOf: string;
  targetCurrency?: string;
  requestGeneration: string;
}>;
export type HomepageV25SeriesBundle = Readonly<Pick<HomepageV25BoundaryBatch,
  "sourceId" | "revisions" | "policies" | "scope" | "points" | "current" | "feeFacts">> & Readonly<{
  requestGeneration: string;
  boundary: Readonly<{
    businessTimezone: "Asia/Shanghai";
    asOf: string;
    periodStart: string;
    requestedEnd: string;
    effectiveEnd: string | null;
  }>;
  periodSummary: HomepageV25BoundaryPoint | null;
  summaryState: HomepageV25BoundaryPoint["state"];
  tooltipFields: typeof HOMEPAGE_V25_TOOLTIP_FIELDS;
}>;

const DAY_MS = 86_400_000;
function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day))
    && new Date(day).toISOString().slice(0, 10) === day;
}

/** Calendar composition only: A owns all financial values and their evidence. */
export function buildHomepageV25Series(source: HomepageV25PreparedSource, input: HomepageV25SeriesInput): HomepageV25SeriesBundle {
  const { start, end } = input.period;
  if (!validDay(start) || !validDay(end) || start > end) throw new HomepageV25ProjectionInputError("period-invalid");
  const endpoints: { key: string; at: string }[] = [];
  for (let cursor = Date.parse(start), endCursor = Date.parse(end); cursor <= endCursor; cursor += DAY_MS) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    // Keep day precision. Converting to an instant changes date-only fill visibility.
    endpoints.push({ key: day, at: day });
  }
  const batch = projectHomepageV25Boundaries(source, {
    periodStart: start, asOf: input.asOf, endpoints,
    ...(input.targetCurrency === undefined ? {} : { targetCurrency: input.targetCurrency }),
  });
  let periodSummary: HomepageV25BoundaryPoint | null = null;
  for (let index = batch.points.length - 1; index >= 0; index--) {
    if (batch.points[index].state !== "future") { periodSummary = batch.points[index]; break; }
  }
  // The last known date may be missing. Never substitute an earlier plotted value.
  return Object.freeze({ sourceId: batch.sourceId, revisions: batch.revisions, policies: batch.policies, scope: batch.scope,
    requestGeneration: input.requestGeneration, boundary: Object.freeze({ businessTimezone: "Asia/Shanghai" as const, asOf: batch.asOf,
      periodStart: batch.periodStart, requestedEnd: end, effectiveEnd: periodSummary?.businessDate ?? null }),
    points: batch.points, periodSummary, summaryState: periodSummary?.state ?? "future", tooltipFields: HOMEPAGE_V25_TOOLTIP_FIELDS,
    current: batch.current, feeFacts: batch.feeFacts });
}
