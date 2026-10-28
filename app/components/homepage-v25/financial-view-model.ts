import {
  HomepageV25ProjectionInputError, projectHomepageV25Boundaries,
  type CurrentProjection, type HomepageV25Metric, type SourceRevisions,
} from "../../lib/reviews/homepage-v25-performance";
import { buildHomepageV25Series, type HomepageV25SeriesBundle } from "../../lib/reviews/homepage-v25-series";
import {
  beginHomepagePeriodApply, createHomepageState, editHomepageDraft, homepageScopeKey, normalizeHomepageSnapshot,
  type HomepagePeriod, type HomepageRequest, type HomepageSnapshot,
} from "../../lib/reviews/homepage-v25-state";
import { homepageProducerRequestKey, type HomepageOwnedFinancialSource, type HomepageSourceAllBounds } from "./source-contract";

export type HomepageFinancialViewQuery =
  | Readonly<{ domain: "global"; request: HomepageRequest; acceptedSnapshot: HomepageSnapshot }>
  | Readonly<{ domain: "period"; request: HomepageRequest<HomepagePeriod, "period"> }>;

export type HomepageFinancialViewStamp = Readonly<Pick<HomepageV25SeriesBundle,
  "sourceId" | "revisions" | "policies" | "requestGeneration"> & {
  selectionKey: string; asOf: string; reportCurrency: HomepageOwnedFinancialSource["reportCurrency"];
}>;

export type HomepagePeriodView = Readonly<{
  stamp: HomepageFinancialViewStamp;
  range: HomepagePeriod;
  bounds: HomepageSourceAllBounds;
  series: HomepageV25SeriesBundle | null;
  current: CurrentProjection;
  reasons: readonly string[];
}>;

const shanghaiDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
const revisionKeys = ["trades", "metadata", "quotes", "fx"] as const;
const fail = (code: string): never => { throw new HomepageV25ProjectionInputError(`financial-view-${code}`); };

function sameRevisions(left: SourceRevisions, right: SourceRevisions): boolean {
  return revisionKeys.every(key => typeof left[key] === "string" && left[key].length > 0 && left[key] === right[key]);
}

function rangeFor(source: HomepageOwnedFinancialSource, query: HomepageFinancialViewQuery): HomepagePeriod {
  const request = query.request;
  if (!request || (query.domain !== "global" && query.domain !== "period") || request.domain !== query.domain
    || !Number.isSafeInteger(request.generation) || request.generation < 1 || !Number.isFinite(request.startedAt)
    || typeof request.scopeKey !== "string" || !request.scopeKey.trim()
    || (request.purpose !== undefined && !["identity", "apply", "refresh", "navigation"].includes(request.purpose))) fail("request-invalid");

  // Ask S to validate/canonicalize the selection and form local request identity.
  // No private scopeKey serialization is repeated here.
  const state = (() => {
    try {
      const value = createHomepageState(source.selection.scope);
      const selected = editHomepageDraft(value, { ...source.selection.scope, attachments: source.selection.attachments });
      value.snapshot.attachments = selected.draft.attachments;
      return value;
    } catch { return fail("selection-invalid"); }
  })();
  if (query.domain === "global") {
    try { editHomepageDraft(state, query.request.target); } catch { fail("request-invalid"); }
    const accepted = normalizeHomepageSnapshot(query.acceptedSnapshot);
    if (!accepted) return fail("snapshot-invalid");
    if (homepageScopeKey(accepted.scope) !== homepageScopeKey(state.snapshot.scope)
      || JSON.stringify(accepted.attachments) !== JSON.stringify(state.snapshot.attachments)) fail("selection-mismatch");
    // Recovery may have changed accounts or restored a different period. The
    // host alone authorizes that recovery; the original target is not the range.
    return accepted.period;
  }
  if (request.purpose !== undefined) fail("request-invalid");
  const expected = (() => {
    try { return beginHomepagePeriodApply(state, query.request.target, request.startedAt).requests.period!; }
    catch { return fail("range-invalid"); }
  })();
  if (expected.scopeKey !== request.scopeKey) fail("selection-mismatch");
  return expected.target;
}

function projectionAsOf(value: string): string {
  // S1 owns clock provenance. A business day is its explicit Shanghai day-end,
  // never a reason to invent a current clock or an FX observation timestamp.
  const day = value.slice(0, 10), parsedDay = Date.parse(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsedDay)
    || new Date(parsedDay).toISOString().slice(0, 10) !== day) return fail("as-of-invalid");
  const instant = value.length === 10 ? `${value}T15:59:59.999Z` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(instant)
    || Number(instant.slice(11, 13)) > 23 || Number(instant.slice(14, 16)) > 59 || Number(instant.slice(17, 19)) > 59
    || !Number.isFinite(Date.parse(instant))) return fail("as-of-invalid");
  return new Date(instant).toISOString();
}

function incompleteSelection(source: HomepageOwnedFinancialSource): string[] {
  const reasons = source.receipt.reasons.filter(reason => reason.startsWith("universe:")
    || /^group:.*:(?:category|open|pending-review)-unknown$/.test(reason));
  if (!source.receipt.universeComplete && !reasons.some(reason => reason.startsWith("universe:"))) reasons.push("universe:incomplete");
  return reasons;
}

function unavailableTotal(metric: HomepageV25Metric, incomplete: readonly string[]): HomepageV25Metric {
  const reasons = [...new Set([...metric.reasons, ...incomplete])];
  Object.freeze(reasons);
  // Retain F's observed-subset native money and coverage, never recompute it.
  return Object.freeze({ ...metric, value: null, available: false, reasons });
}

/** One owned source → one F batch → one immutable view. No IO, ownership, ledger or cache. */
export function projectHomepageFinancialView(source: HomepageOwnedFinancialSource, query: HomepageFinancialViewQuery): HomepagePeriodView {
  const range = Object.freeze({ ...rangeFor(source, query) });
  if (!source.receipt.selectionKey || source.receipt.sourceId !== source.prepared.sourceId) fail("source-mismatch");
  if (!sameRevisions(source.revisions, source.prepared.revisions)) fail("revisions-mismatch");
  const currency = source.selection.scope.market === "hk" ? "HKD" : source.selection.scope.market === "us" ? "USD" : "CNY";
  if (source.reportCurrency !== currency) fail("currency-mismatch");
  const asOf = projectionAsOf(source.asOf);
  const requestGeneration = homepageProducerRequestKey<unknown, "global" | "period">(query.request);
  const rawBounds: HomepageSourceAllBounds = range.preset === "all" ? source.periodAllBounds
    : { state: "known", start: range.from, end: range.to, reasons: [] };
  const bounds = Object.freeze({ ...rawBounds, reasons: Object.freeze([...rawBounds.reasons]) });
  const incomplete = incompleteSelection(source);
  const series = bounds.state === "known" && !incomplete.length
    ? buildHomepageV25Series(source.prepared, { period: { start: bounds.start, end: bounds.end }, asOf, targetCurrency: currency, requestGeneration })
    : null;
  // Endpointless current requires a syntactic periodStart, not an invented all
  // inception. This day is never exposed as all bounds or a historical point.
  const projected = series ?? projectHomepageV25Boundaries(source.prepared, {
    periodStart: shanghaiDay.format(new Date(asOf)), asOf, endpoints: [], targetCurrency: currency,
  });
  if (projected.sourceId !== source.receipt.sourceId) fail("source-mismatch");
  if (!sameRevisions(projected.revisions, source.revisions)) fail("revisions-mismatch");
  const original = projected.current;
  if ([original.currentMarketValue, original.currentUnrealized, original.currentOpenFees]
    .some(metric => metric.money.targetCurrency !== currency)) fail("currency-mismatch");
  const current = incomplete.length ? Object.freeze({ ...original,
    currentMarketValue: unavailableTotal(original.currentMarketValue, incomplete),
    currentUnrealized: unavailableTotal(original.currentUnrealized, incomplete),
    currentOpenFees: unavailableTotal(original.currentOpenFees, incomplete),
  }) : original;
  return Object.freeze({ range, bounds, series, current,
    stamp: Object.freeze({ sourceId: projected.sourceId, revisions: projected.revisions, policies: projected.policies,
      requestGeneration, selectionKey: source.receipt.selectionKey, asOf: original.asOf, reportCurrency: currency }),
    reasons: Object.freeze([...new Set([...bounds.reasons, ...incomplete])]),
  });
}
