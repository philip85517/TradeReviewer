import { prepareHomepageV25Source, projectHomepageV25Boundaries, type HomepageV25PrepareInput } from "../../lib/reviews/homepage-v25-performance";
import { replayExecutionAt } from "../../lib/import/statement-evidence";
import { canonicalInstrumentId } from "../../lib/instruments/display-name";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../../lib/trades/library";
import type { TradeExecution } from "../../lib/trades/types";
import { homepageAttachmentEpisodeCoverage, homepageAttachmentGroupKey, qualifyHomepageAttachmentGroups, type HomepageAttachmentGroup, type HomepageAttachmentInput } from "./attachment-groups";
import type { HomepageFinancialRawSource, HomepageFinancialSelection, HomepageOwnedFinancialSource, HomepageSourceAllBounds } from "./source-contract";

const selectionPolicy = "HV25-exact-original-groups-1";
const shanghaiDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
const unique = (items: readonly string[]) => [...new Set(items)];
const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Date input means the explicit Shanghai business-day close, without changing the retained input. */
function cursor(value: string | null, allowBusinessDay = true): string | null {
  if (value === null) return null;
  if (allowBusinessDay && validDay(value)) return `${value}T15:59:59.999Z`;
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || !validDay(parts[1]) || Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59 || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([left], [right]) => compare(left, right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function freezeOwned<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const child of Object.values(value)) freezeOwned(child, seen);
    Object.freeze(value);
  }
  return value;
}

/** Original entry fields and raw object order survive full-group qualification. */
function originalEntries(entries: readonly TradeLibraryEntry[], groups: readonly HomepageAttachmentGroup[]): TradeLibraryEntry[] {
  const selected = new Map<TradeLibraryEntry, { fills: Set<TradeExecution>; episodes: Set<TradeLibraryEpisode> }>();
  for (const group of groups) for (const source of group.sources) {
    let lineage = selected.get(source.entry);
    if (!lineage) {
      lineage = { fills: new Set(), episodes: new Set() };
      selected.set(source.entry, lineage);
    }
    source.executions.forEach(fill => lineage.fills.add(fill));
    source.episodes.forEach(episode => lineage.episodes.add(episode));
  }
  return entries.flatMap(entry => {
    const lineage = selected.get(entry);
    return lineage ? [{ ...entry, executions: entry.executions.filter(fill => lineage.fills.has(fill)), episodes: entry.episodes.filter(episode => lineage.episodes.has(episode)) }] : [];
  });
}

function universeReasons(raw: HomepageFinancialRawSource, asOfCursor: string): string[] {
  const coverage = raw.universeCoverage;
  const reasons = [...coverage.reasons.map(reason => `universe:${reason}`)];
  if (coverage.state !== "complete") reasons.push(`universe:${coverage.state}`);
  if (!coverage.evidenceIds.length) reasons.push("universe:provenance-missing");
  const knownAt = cursor(coverage.knownAt, false);
  if (!knownAt) reasons.push("universe:knowledge-missing-or-invalid");
  else if (Date.parse(knownAt) > Date.parse(asOfCursor)) reasons.push("universe:knowledge-after-asof");
  return unique(reasons);
}

function selectionReasons(groups: readonly HomepageAttachmentGroup[]): string[] {
  return groups.flatMap(group => group.exclusionReasons.flatMap(reason => [
    `group:${group.key}:${reason}`,
    ...(reason === "open-unknown" ? group.open.reasons : reason === "pending-review-unknown" ? group.pendingReview.reasons : reason === "category-unknown" ? group.category.reasons : [])
      .map(detail => `group:${group.key}:${detail}`),
  ]));
}

function rawFillDay(fill: TradeExecution): string | null {
  if (fill.source.timePrecision === "date-only" || fill.executedAt.length === 10) {
    const sourceDate = fill.source.sourceTimestampText?.trim();
    const declaredDay = fill.source.marketCalendarDate ?? fill.source.tradingDate ??
      (sourceDate && /^\d{4}-\d{2}-\d{2}$/.test(sourceDate) ? sourceDate : undefined);
    // replayExecutionAt normalizes legacy date input; normalization cannot prove
    // a day that a month-only or invalid original value never supplied.
    if (declaredDay !== undefined ? !validDay(declaredDay) : !cursor(fill.executedAt)) return null;
    const day = replayExecutionAt(fill).slice(0, 10);
    return validDay(day) ? day : null;
  }
  const at = cursor(fill.executedAt);
  return at ? shanghaiDay.format(new Date(at)) : null;
}

function allBounds(raw: HomepageFinancialRawSource, groups: readonly HomepageAttachmentGroup[], allGroups: readonly HomepageAttachmentGroup[], asOfCursor: string, incompleteUniverse: readonly string[]): HomepageSourceAllBounds {
  const reasons = [...incompleteUniverse];
  for (const group of allGroups) for (const reason of group.exclusionReasons) {
    if (reason.endsWith("-unknown")) reasons.push(`group:${group.key}:${reason}`);
  }
  const days: string[] = [];
  for (const group of groups) {
    const prefix = `group:${group.key}:`;
    const coverage = raw.lifetimeSourceCoverage.filter(row => homepageAttachmentGroupKey(row) === group.key);
    if (coverage.length !== 1) reasons.push(`${prefix}lifetime-coverage-missing-or-conflicting`);
    else {
      const row = coverage[0], knownAt = cursor(row.knownAt, false), through = cursor(row.through);
      if (row.state !== "complete") reasons.push(`${prefix}lifetime-${row.state}`);
      if (!row.coversInception) reasons.push(`${prefix}inception-unproved`);
      if (!row.evidenceIds.length) reasons.push(`${prefix}lifetime-provenance-missing`);
      if (!knownAt || Date.parse(knownAt) > Date.parse(asOfCursor)) reasons.push(`${prefix}lifetime-knowledge-unavailable`);
      if (!through || Date.parse(through) < Date.parse(asOfCursor)) reasons.push(`${prefix}lifetime-through-incomplete`);
      reasons.push(...row.reasons.map(reason => `${prefix}${reason}`));
    }
    const fills = group.sources.flatMap(source => source.executions);
    const episodes = group.sources.flatMap(source => source.episodes);
    const evidenceFills = [...fills, ...episodes.flatMap(({ episode }) => episode.executions)];
    if (!fills.length) reasons.push(`${prefix}raw-lineage-missing`);
    if (evidenceFills.some(fill => fill.source.historyIncomplete?.length || fill.source.openingPosition ||
      fill.source.statementPositions?.some(position => position.phase === "opening"))) reasons.push(`${prefix}history-incomplete-or-initial-position`);
    if (episodes.some(({ episode }) => episode.initialPosition || episode.directionKnown === false ||
      episode.warnings?.some(warning => warning.code === "statement-coverage-gap") ||
      episode.accuracy?.reasons.some(reason => ["history-incomplete", "ambiguous-event-order", "ambiguous-opening"].includes(reason)))) reasons.push(`${prefix}episode-inception-unproved`);
    const instrument = fills[0]?.instrument ?? episodes[0]?.episode.instrument;
    const accountEvents = [
      ...fills.flatMap(fill => fill.source.positionEvents ?? []),
      ...episodes.flatMap(({ episode }) => [...episode.positionEvents ?? [], ...episode.executions.flatMap(fill => fill.source.positionEvents ?? [])]),
    ].filter(event => event.accountId === group.identity.accountId);
    if (accountEvents.some(event => !event.market || !event.symbol)) reasons.push(`${prefix}event-identity-unproved`);
    const events = accountEvents.filter(event => event.market && event.symbol && instrument &&
      canonicalInstrumentId(event.symbol, event.market) === canonicalInstrumentId(instrument.symbol, instrument.market));
    if (events.some(event => !validDay(event.date) && !cursor(event.date))) reasons.push(`${prefix}event-day-unproved`);
    let visibleFill = false;
    for (const fill of fills) {
      const day = rawFillDay(fill);
      if (!day) { reasons.push(`${prefix}execution-business-day-unproved`); continue; }
      // Preserve future carriers in the prepared source; they cannot establish an already-known inception.
      if (Date.parse(replayExecutionAt(fill)) <= Date.parse(asOfCursor)) { days.push(day); visibleFill = true; }
    }
    if (!visibleFill) reasons.push(`${prefix}visible-inception-unproved`);
    for (const event of events) {
      const at = cursor(event.date);
      if (at && Date.parse(at) <= Date.parse(asOfCursor)) days.push(validDay(event.date) ? event.date : shanghaiDay.format(new Date(at)));
    }
  }
  if (reasons.length) return { state: "unknown", start: null, end: null, reasons: unique(reasons).sort(compare) };
  if (!groups.length) return { state: "empty", start: null, end: null, reasons: [] };
  return { state: "known", start: days.sort(compare)[0], end: shanghaiDay.format(new Date(asOfCursor)), reasons: [] };
}

/** Own one exact selected source. No range clipping, financial equations, IO, or global handle cache. */
export function ownHomepageFinancialSource(raw: HomepageFinancialRawSource, selection: HomepageFinancialSelection): HomepageOwnedFinancialSource {
  const asOfCursor = cursor(raw.asOf);
  if (!asOfCursor) throw new TypeError("as-of-invalid");
  // Qualification and bounds only borrow raw during this synchronous call.
  // F captures its complete input; S1 detaches only the graph retained below.
  const ownedSelection = structuredClone(selection);
  const reportCurrency = ownedSelection.scope.market === "hk" ? "HKD" : ownedSelection.scope.market === "us" ? "USD" : "CNY";
  const prepareInput = (entries: readonly TradeLibraryEntry[], lifetime = raw.lifetimeSourceCoverage): HomepageV25PrepareInput => ({
    entries, scope: { nature: "live" }, instrumentMetadata: raw.instrumentMetadata,
    candlesByInstrument: raw.candlesByInstrument, fxObservations: raw.fxObservations,
    currentFxSnapshot: raw.currentFxSnapshot, lifetimeSourceCoverage: lifetime, revisions: raw.revisions,
  });
  // Only openOnly needs the candidate projection. Its transient handle is not retained in the result.
  const candidateCurrent = ownedSelection.attachments.openOnly
    ? projectHomepageV25Boundaries(prepareHomepageV25Source(prepareInput(raw.entries)), {
      periodStart: shanghaiDay.format(new Date(asOfCursor)), asOf: asOfCursor, endpoints: [], targetCurrency: reportCurrency,
    }).current : undefined;
  const input: HomepageAttachmentInput = {
    entries: raw.entries, ...ownedSelection, asOf: asOfCursor,
    instrumentMetadata: raw.instrumentMetadata, candlesByInstrument: raw.candlesByInstrument,
    marketDataStatuses: raw.marketDataStatuses,
    episodeCoverage: homepageAttachmentEpisodeCoverage(raw.entries, asOfCursor, raw.reviewSummariesComplete),
    ...(candidateCurrent ? { current: { boundary: { asOf: candidateCurrent.asOf }, instruments: candidateCurrent.instruments } } : {}),
  };
  const qualified = qualifyHomepageAttachmentGroups(input);
  const eligibleGroupKeys = qualified.eligibleGroups.map(group => group.key).sort(compare);
  const selectedEntries = originalEntries(raw.entries, qualified.eligibleGroups);
  const selectedKeys = new Set(eligibleGroupKeys);
  const lifetime = raw.lifetimeSourceCoverage.filter(row => selectedKeys.has(homepageAttachmentGroupKey(row)));
  const prepared = prepareHomepageV25Source(prepareInput(selectedEntries, lifetime));
  const incompleteUniverse = universeReasons(raw, asOfCursor);
  const bounds = allBounds(raw, qualified.eligibleGroups, qualified.groups, asOfCursor, incompleteUniverse);
  const selectionKey = `${selectionPolicy}:${stableJson({ ...ownedSelection, eligibleGroupKeys })}`;
  const retained = structuredClone({ selectedEntries, coverage: { universe: raw.universeCoverage, lifetime } });
  return freezeOwned({
    prepared, asOf: raw.asOf, reportCurrency, selection: ownedSelection,
    receipt: { sourceId: prepared.sourceId, selectionKey, eligibleGroupKeys, universeComplete: incompleteUniverse.length === 0,
      reasons: unique([...incompleteUniverse, ...selectionReasons(qualified.groups)]).sort(compare) },
    periodAllBounds: bounds, historyAllBounds: { ...bounds, reasons: [...bounds.reasons] }, selectedEntries: retained.selectedEntries,
    coverage: retained.coverage, revisions: prepared.revisions,
  });
}
