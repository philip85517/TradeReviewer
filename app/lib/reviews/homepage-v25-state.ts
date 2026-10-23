/** Pure, versioned UI contract. Business rows belong to the consumer, never here. */
export type HomepageMarket = "all" | "a" | "hk" | "us";
export type HomepageRangeMode = "all" | "custom" | "date";
export type ContributionMode = "current" | "history";
export type HomepageFocus = "title" | "holdings" | "history" | "contribution" | "search" | null;
export type HomepageScope = {
  live: true; market: HomepageMarket; accounts: string[]; rangeMode: HomepageRangeMode;
  from?: string; to?: string; date?: string; symbolIdentity?: string;
};
export type HomepageAttachments = { categories: string[]; openOnly: boolean; pendingReview: boolean[] };
export type HomepageDraft = HomepageScope & { attachments: HomepageAttachments };
export type HomepageApplied = HomepageDraft;
export type HomepagePeriod =
  | { preset: "all"; from: null; to: null }
  | { preset: "week" | "month" | "ytd" | "custom"; from: string; to: string };
export type HomepageHistoryRange =
  | { mode: "all" }
  | { mode: "year" | "this-year"; year: number }
  | { mode: "years"; fromYear: number; toYear: number };
export type HomepageHistoryChartMode = "period-pnl" | "cumulative-pnl" | "win-rate" | "round-count";
export type HomepageContributionView = {
  category: "long" | "short" | "ipo"; sort: "profit-desc" | "loss-asc"; page: number;
  market: Exclude<HomepageMarket, "all"> | null; symbol: string | null; drilldown: "markets" | "symbols";
};
export type HomepageSnapshot = {
  version: 3;
  scope: HomepageScope;
  attachments: HomepageAttachments;
  holdings: { query: string; sort: string; page: number };
  period: HomepagePeriod;
  history: { range: HomepageHistoryRange; chartMode: HomepageHistoryChartMode };
  contribution: {
    mode: ContributionMode;
    current: HomepageContributionView & { openOnly: boolean };
    history: HomepageContributionView;
  };
  search: { query: string; open: boolean; resultsScrollTop: number; selectedSymbol: string | null; triggerFocusId: string | null };
  returnState: { source: "home" | "trades" | "detail" | null; container: Exclude<HomepageFocus, "title">; detailId: string | null; triggerFocusId: string | null; missingContainerTitle: string | null };
  scrollTop: number; focus: HomepageFocus; futureDisclosureSources: string[];
};
export type HomepageRequestDomain = "global" | "period" | "history";
export type HomepageReadPurpose = "identity" | "apply" | "refresh" | "navigation";
export type HomepageReadIntent =
  | { purpose: "identity" | "navigation"; scope: HomepageScope }
  | { purpose: "apply"; draft?: HomepageDraft }
  | { purpose: "refresh" };
export type HomepageRequest<T = HomepageDraft, D extends HomepageRequestDomain = "global"> = {
  domain: D; generation: number; scopeKey: string; startedAt: number; target: T;
  /** Present on global reads; omitted on independent period/history reads. */
  purpose?: HomepageReadPurpose;
};
type Requests = {
  global: HomepageRequest | null;
  period: HomepageRequest<HomepagePeriod, "period"> | null;
  history: HomepageRequest<HomepageHistoryRange, "history"> | null;
};
type StateCore = {
  snapshot: HomepageSnapshot; draft: HomepageDraft; periodDraft: HomepagePeriod; historyDraft: HomepageHistoryRange;
  requests: Requests; errors: Record<HomepageRequestDomain, string | null>;
  timeouts: Record<HomepageRequestDomain, boolean>; requestCounter: number;
  /** Retry intent only, never committed UI or persisted business data. */
  lastGlobalRead: { purpose: HomepageReadPurpose; navigationScope?: HomepageScope } | null;
};
export type HomepageState = StateCore & {
  /** Compatibility projections; snapshot is the sole committed authority. */
  readonly applied: HomepageApplied; readonly desired: HomepageDraft;
  readonly request: HomepageRequest | null; readonly error: string | null; readonly timedOut: boolean;
};
type ResultToken = { generation: number; scopeKey: string; ok: boolean; error?: string };
export type HomepageApplyResult = ResultToken & { domain?: "global"; applied?: HomepageApplied };
export type HomepageRequestResult = HomepageApplyResult
  | (ResultToken & { domain: "period"; period?: HomepagePeriod })
  | (ResultToken & { domain: "history"; historyRange?: HomepageHistoryRange });
type UnknownKeys = "reject" | "strip";
type ObjectValue = Record<string, unknown>;
const MARKETS: readonly HomepageMarket[] = ["all", "a", "hk", "us"];
const CHART_MODES: readonly HomepageHistoryChartMode[] = ["period-pnl", "cumulative-pnl", "win-rate", "round-count"];
const DOMAINS: readonly HomepageRequestDomain[] = ["global", "period", "history"];
export const ALL_ACCOUNTS = "*";

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function object(value: unknown, requiredKeys: readonly string[], optionalKeys: readonly string[], policy: UnknownKeys): ObjectValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as ObjectValue;
  if (requiredKeys.some(key => !Object.hasOwn(result, key))) return null;
  if (policy === "reject" && Object.keys(result).some(key => !requiredKeys.includes(key) && !optionalKeys.includes(key))) return null;
  return result;
}
function required<T>(value: T | null): T {
  if (value === null) throw new Error("invalid-homepage-ui-state");
  return value;
}
function text(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.trim() === value; }
function nullableText(value: unknown): value is string | null { return value === null || text(value); }
function positiveInteger(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 1; }
function offset(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function stringSet(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(text) ? [...new Set(value)].sort() : null;
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  try { return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value; } catch { return false; }
}
function validSymbol(value: unknown): value is string {
  if (!text(value)) return false;
  const segments = value.split(":");
  return (segments.length === 2 || segments.length === 3) && segments.every(segment => segment.length > 0
    && [...segment].every(character => !/\s/.test(character) && character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127));
}
function normalizeAccounts(value: unknown): string[] | null {
  const accounts = stringSet(value);
  if (!accounts?.length || accounts.some(account => account !== ALL_ACCOUNTS && !/^[A-Za-z0-9_.:-]+$/.test(account))) return null;
  return accounts.includes(ALL_ACCOUNTS) && accounts.length !== 1 ? null : accounts;
}
function normalizeScope(value: unknown, policy: UnknownKeys): HomepageScope | null {
  const v = object(value, ["live", "market", "accounts", "rangeMode"], ["from", "to", "date", "symbolIdentity"], policy);
  if (!v || v.live !== true || !MARKETS.includes(v.market as HomepageMarket)) return null;
  const accounts = normalizeAccounts(v.accounts);
  if (!accounts || (v.symbolIdentity !== undefined && !validSymbol(v.symbolIdentity))) return null;
  const base = { live: true as const, market: v.market as HomepageMarket, accounts };
  const symbol = v.symbolIdentity === undefined ? {} : { symbolIdentity: v.symbolIdentity as string };
  if (v.rangeMode === "all" && v.from === undefined && v.to === undefined && v.date === undefined) return { ...base, rangeMode: "all", ...symbol };
  if (v.rangeMode === "date" && validDate(v.date) && v.from === undefined && v.to === undefined) return { ...base, rangeMode: "date", date: v.date, ...symbol };
  if (v.rangeMode === "custom" && validDate(v.from) && validDate(v.to) && v.from <= v.to && v.date === undefined) return { ...base, rangeMode: "custom", from: v.from, to: v.to, ...symbol };
  return null;
}
function normalizeAttachments(value: unknown, policy: UnknownKeys, legacy = false): HomepageAttachments | null {
  const v = object(value, ["categories", "openOnly", "pendingReview"], [], policy);
  if (!v || typeof v.openOnly !== "boolean") return null;
  if (legacy ? typeof v.pendingReview !== "boolean" : !Array.isArray(v.pendingReview) || !v.pendingReview.every(choice => typeof choice === "boolean")) return null;
  const categories = stringSet(v.categories);
  const pendingReview = legacy ? (v.pendingReview ? [true] : [])
    : [false, true].filter(choice => (v.pendingReview as boolean[]).includes(choice));
  return categories && { categories, openOnly: v.openOnly, pendingReview };
}
function normalizeDraft(value: unknown): HomepageDraft | null {
  const v = object(value, ["live", "market", "accounts", "rangeMode", "attachments"], ["from", "to", "date", "symbolIdentity"], "reject");
  if (!v) return null;
  const { attachments: rawAttachments, ...rawScope } = v;
  const scope = normalizeScope(rawScope, "reject");
  const attachments = normalizeAttachments(rawAttachments, "reject");
  return scope && attachments ? { ...scope, attachments } : null;
}
function normalizePeriod(value: unknown, policy: UnknownKeys): HomepagePeriod | null {
  const v = object(value, ["preset", "from", "to"], [], policy);
  if (!v) return null;
  if (v.preset === "all") return v.from === null && v.to === null ? { preset: "all", from: null, to: null } : null;
  if (!["week", "month", "ytd", "custom"].includes(String(v.preset)) || !validDate(v.from) || !validDate(v.to) || v.from > v.to) return null;
  return { preset: v.preset as Exclude<HomepagePeriod["preset"], "all">, from: v.from, to: v.to };
}
function periodFromScope(scope: HomepageScope): HomepagePeriod {
  if (scope.rangeMode === "all") return { preset: "all", from: null, to: null };
  return { preset: "custom", from: scope.rangeMode === "date" ? scope.date! : scope.from!, to: scope.rangeMode === "date" ? scope.date! : scope.to! };
}
/** Scope's route dates are a checked projection of the applied period. */
function scopeWithPeriod(scope: HomepageScope, period: HomepagePeriod, preserveDate = true): HomepageScope {
  const base = { live: scope.live, market: scope.market, accounts: scope.accounts,
    ...(scope.symbolIdentity === undefined ? {} : { symbolIdentity: scope.symbolIdentity }) };
  if (period.preset === "all") return { ...base, rangeMode: "all" };
  if (preserveDate && scope.rangeMode === "date" && scope.date === period.from && period.from === period.to) return { ...base, rangeMode: "date", date: scope.date };
  return { ...base, rangeMode: "custom", from: period.from, to: period.to };
}
function validYear(value: unknown): value is number { return positiveInteger(value) && value <= 9999; }
function normalizeHistoryRange(value: unknown, policy: UnknownKeys): HomepageHistoryRange | null {
  const v = object(value, ["mode"], ["year", "fromYear", "toYear"], policy);
  if (!v) return null;
  if (v.mode === "all" && v.year === undefined && v.fromYear === undefined && v.toYear === undefined) return { mode: "all" };
  if ((v.mode === "year" || v.mode === "this-year") && validYear(v.year) && v.fromYear === undefined && v.toYear === undefined) return { mode: v.mode, year: v.year };
  if (v.mode === "years" && validYear(v.fromYear) && validYear(v.toYear) && v.fromYear <= v.toYear && v.year === undefined) return { mode: "years", fromYear: v.fromYear, toYear: v.toYear };
  return null;
}
function normalizeContributionView(value: unknown, current: true, policy: UnknownKeys): (HomepageContributionView & { openOnly: boolean }) | null;
function normalizeContributionView(value: unknown, current: false, policy: UnknownKeys): HomepageContributionView | null;
function normalizeContributionView(value: unknown, current: boolean, policy: UnknownKeys): (HomepageContributionView & { openOnly?: boolean }) | null {
  const keys = ["category", "sort", "page", "market", "symbol", "drilldown"];
  const v = object(value, current ? [...keys, "openOnly"] : keys, [], policy);
  if (!v || !["long", "short", "ipo"].includes(String(v.category)) || !["profit-desc", "loss-asc"].includes(String(v.sort)) || !positiveInteger(v.page)) return null;
  if (v.market !== null && !["a", "hk", "us"].includes(String(v.market))) return null;
  if (v.symbol !== null && !validSymbol(v.symbol)) return null;
  if (v.drilldown !== "markets" && v.drilldown !== "symbols") return null;
  if (v.drilldown === "markets" && (v.market !== null || v.symbol !== null)) return null;
  if (current && typeof v.openOnly !== "boolean") return null;
  const view: HomepageContributionView = {
    category: v.category as HomepageContributionView["category"], sort: v.sort as HomepageContributionView["sort"], page: v.page,
    market: v.market as HomepageContributionView["market"], symbol: v.symbol as string | null, drilldown: v.drilldown,
  };
  return current ? { ...view, openOnly: v.openOnly as boolean } : view;
}

/** One projection for persistence, restoration, transitions and semantic keys. */
export function normalizeHomepageSnapshot(value: unknown, policy: UnknownKeys = "reject"): HomepageSnapshot | null {
  // Migration validates the entire legacy object before converting any field.
  if (value && typeof value === "object" && "version" in value && value.version === 2) policy = "reject";
  const v = object(value, ["version", "scope", "attachments", "holdings", "period", "history", "contribution", "search", "returnState", "scrollTop", "focus", "futureDisclosureSources"], [], policy);
  if (!v || (v.version !== 2 && v.version !== 3)) return null;
  let scope = normalizeScope(v.scope, policy);
  const attachments = normalizeAttachments(v.attachments, policy, v.version === 2);
  const holdings = object(v.holdings, ["query", "sort", "page"], [], policy);
  let period = normalizePeriod(v.period, policy);
  const h = object(v.history, ["range", "chartMode"], [], policy);
  const range = h && normalizeHistoryRange(h.range, policy);
  const c = object(v.contribution, ["mode", "current", "history"], [], policy);
  const current = c && normalizeContributionView(c.current, true, policy);
  const history = c && normalizeContributionView(c.history, false, policy);
  const search = object(v.search, ["query", "open", "resultsScrollTop", "selectedSymbol", "triggerFocusId"], [], policy);
  const r = object(v.returnState, ["source", "container", "detailId", "triggerFocusId", "missingContainerTitle"], [], policy);
  const futureDisclosureSources = stringSet(v.futureDisclosureSources);
  if (!scope || !attachments || !holdings || typeof holdings.query !== "string" || !text(holdings.sort) || !positiveInteger(holdings.page) || !period) return null;
  if (!h || !range || !CHART_MODES.includes(h.chartMode as HomepageHistoryChartMode) || !c || !["current", "history"].includes(String(c.mode)) || !current || !history) return null;
  if (!search || typeof search.query !== "string" || typeof search.open !== "boolean" || !offset(search.resultsScrollTop)
    || (search.selectedSymbol !== null && !validSymbol(search.selectedSymbol)) || !nullableText(search.triggerFocusId)) return null;
  if (!r || ![null, "home", "trades", "detail"].includes(r.source as null | string)
    || ![null, "holdings", "history", "contribution", "search"].includes(r.container as null | string)
    || !nullableText(r.detailId) || !nullableText(r.triggerFocusId) || !nullableText(r.missingContainerTitle)) return null;
  if (!offset(v.scrollTop) || ![null, "title", "holdings", "history", "contribution", "search"].includes(v.focus as null | string) || !futureDisclosureSources) return null;
  // v2 used an uninitialized All alongside a native URL date. Its navigation
  // contract gave a non-All period precedence; otherwise the native date won.
  if (v.version === 2) {
    if (period.preset === "all") period = periodFromScope(scope);
    scope = scopeWithPeriod(scope, period);
  } else if (JSON.stringify(scope) !== JSON.stringify(required(normalizeScope(scopeWithPeriod(scope, period), "reject")))) return null;
  return {
    version: 3, scope, attachments,
    holdings: { query: holdings.query, sort: holdings.sort, page: holdings.page }, period,
    history: { range, chartMode: h.chartMode as HomepageHistoryChartMode },
    contribution: { mode: c.mode as ContributionMode, current, history },
    search: { query: search.query, open: search.open, resultsScrollTop: search.resultsScrollTop, selectedSymbol: search.selectedSymbol as string | null, triggerFocusId: search.triggerFocusId },
    returnState: { source: r.source as HomepageSnapshot["returnState"]["source"], container: r.container as HomepageSnapshot["returnState"]["container"], detailId: r.detailId, triggerFocusId: r.triggerFocusId, missingContainerTitle: r.missingContainerTitle },
    scrollTop: v.scrollTop, focus: v.focus as HomepageFocus, futureDisclosureSources,
  };
}
function appliedFrom(snapshot: HomepageSnapshot): HomepageApplied { return clone({ ...snapshot.scope, attachments: snapshot.attachments }); }
function makeState(core: StateCore): HomepageState {
  const v = clone(core);
  return {
    snapshot: v.snapshot, draft: v.draft, periodDraft: v.periodDraft, historyDraft: v.historyDraft,
    requests: v.requests, errors: v.errors, timeouts: v.timeouts, requestCounter: v.requestCounter, lastGlobalRead: v.lastGlobalRead,
    get applied() { return appliedFrom(this.snapshot); }, get desired() { return clone(this.draft); },
    get request() { return this.requests.global; }, get error() { return this.errors.global; }, get timedOut() { return this.timeouts.global; },
  };
}
function stateFromSnapshot(snapshot: HomepageSnapshot, requestCounter = 0): HomepageState {
  return makeState({ snapshot, draft: appliedFrom(snapshot), periodDraft: snapshot.period, historyDraft: snapshot.history.range,
    requests: { global: null, period: null, history: null }, errors: { global: null, period: null, history: null },
    timeouts: { global: false, period: false, history: false }, requestCounter, lastGlobalRead: null });
}
const emptyAttachments = (): HomepageAttachments => ({ categories: [], openOnly: false, pendingReview: [] });
function initialSnapshot(scope: HomepageScope): HomepageSnapshot {
  const view: HomepageContributionView = { category: "long", sort: "profit-desc", page: 1, market: null, symbol: null, drilldown: "markets" };
  return required(normalizeHomepageSnapshot({ version: 3, scope, attachments: emptyAttachments(), holdings: { query: "", sort: "name", page: 1 },
    period: periodFromScope(scope), history: { range: { mode: "all" }, chartMode: "period-pnl" },
    contribution: { mode: "current", current: { ...view, openOnly: false }, history: view },
    search: { query: "", open: false, resultsScrollTop: 0, selectedSymbol: null, triggerFocusId: null },
    returnState: { source: null, container: null, detailId: null, triggerFocusId: null, missingContainerTitle: null },
    scrollTop: 0, focus: "title", futureDisclosureSources: [] }));
}
export function homepageScopeKey(scope: HomepageScope): string { return JSON.stringify(required(normalizeScope(scope, "reject"))); }
export function createHomepageState(scope: HomepageScope, previous?: HomepageState): HomepageState {
  const normalized = required(normalizeScope(scope, "reject"));
  if (!previous) return stateFromSnapshot(initialSnapshot(normalized));
  return makeState({ ...previous, draft: { ...normalized, attachments: previous.draft.attachments },
    requests: { global: null, period: null, history: null }, errors: { global: null, period: null, history: null },
    timeouts: { global: false, period: false, history: false }, requestCounter: previous.requestCounter + 1, lastGlobalRead: null });
}
export function editHomepageDraft(state: HomepageState, draft: HomepageDraft): HomepageState {
  return makeState({ ...state, draft: required(normalizeDraft(draft)) });
}
export function editHomepagePeriodDraft(state: HomepageState, period: HomepagePeriod): HomepageState {
  return makeState({ ...state, periodDraft: required(normalizePeriod(period, "reject")) });
}
export function editHomepageHistoryDraft(state: HomepageState, range: HomepageHistoryRange): HomepageState {
  return makeState({ ...state, historyDraft: required(normalizeHistoryRange(range, "reject")) });
}
function requestKey(snapshot: HomepageSnapshot, domain: HomepageRequestDomain, target: HomepageDraft | HomepagePeriod | HomepageHistoryRange, purpose: HomepageReadPurpose = "apply"): string {
  if (domain === "global") return JSON.stringify({ domain, purpose, target: required(normalizeDraft(target)), period: required(normalizePeriod(snapshot.period, "reject")), historyRange: required(normalizeHistoryRange(snapshot.history.range, "reject")) });
  // Current-period dates are projected into scope, but are not an identity
  // dependency of history. The two date domains remain independently writable.
  const { live, market, accounts, symbolIdentity } = snapshot.scope;
  const global = { live, market, accounts, ...(symbolIdentity === undefined ? {} : { symbolIdentity }), attachments: snapshot.attachments };
  return JSON.stringify({ domain, global, target: domain === "period" ? required(normalizePeriod(target, "reject")) : required(normalizeHistoryRange(target, "reject")) });
}
function begin(state: HomepageState, domain: HomepageRequestDomain, rawTarget: HomepageDraft | HomepagePeriod | HomepageHistoryRange, now: number, purpose: HomepageReadPurpose = "apply"): HomepageState {
  if (!Number.isFinite(now)) throw new Error("invalid-request-time");
  const draft = domain === "global" ? required(normalizeDraft(rawTarget)) : null;
  const target = draft ? required(normalizeDraft({ ...(purpose === "navigation" ? draft : scopeWithPeriod(draft, state.snapshot.period)), attachments: draft.attachments }))
    : domain === "period" ? required(normalizePeriod(rawTarget, "reject")) : required(normalizeHistoryRange(rawTarget, "reject"));
  const generation = state.requestCounter + 1;
  const next = makeState(state);
  const token = { domain, generation, scopeKey: requestKey(state.snapshot, domain, target, purpose), startedAt: now, target };
  if (domain === "global") {
    if (purpose !== "refresh") next.draft = target as HomepageDraft;
    next.requests.global = { ...token, purpose } as HomepageRequest;
    const scope = required(normalizeScope(target, "strip"));
    next.lastGlobalRead = purpose === "navigation" ? { purpose, navigationScope: scope } : { purpose };
    if (purpose === "navigation") next.periodDraft = periodFromScope(scope);
  }
  if (domain === "period") { next.periodDraft = target as HomepagePeriod; next.requests.period = token as HomepageRequest<HomepagePeriod, "period">; }
  if (domain === "history") { next.historyDraft = target as HomepageHistoryRange; next.requests.history = token as HomepageRequest<HomepageHistoryRange, "history">; }
  next.requestCounter = generation; next.errors[domain] = null; next.timeouts[domain] = false;
  return makeState(next);
}
/** A single read boundary distinguishes URL dates from ordinary identity changes. */
export function beginHomepageRead(state: HomepageState, intent: HomepageReadIntent, now = Date.now()): HomepageState {
  if (intent.purpose === "identity" || intent.purpose === "navigation") {
    const prepared = changeHomepageIdentity(state, intent.scope);
    return begin(prepared, "global", prepared.draft, now, intent.purpose);
  }
  if (intent.purpose === "apply") return begin(state, "global", intent.draft ?? state.draft, now, "apply");
  if (intent.purpose === "refresh") return begin(state, "global", state.applied, now, "refresh");
  throw new Error("invalid-homepage-read-intent");
}
export function beginHomepageApply(state: HomepageState, draft: HomepageDraft, now = Date.now()): HomepageState { return beginHomepageRead(state, { purpose: "apply", draft }, now); }
export function beginHomepagePeriodApply(state: HomepageState, period: HomepagePeriod, now = Date.now()): HomepageState { return begin(state, "period", period, now); }
export function beginHomepageHistoryApply(state: HomepageState, range: HomepageHistoryRange, now = Date.now()): HomepageState { return begin(state, "history", range, now); }
function endRequest(state: HomepageState, domain: HomepageRequestDomain, error: string | null): HomepageState {
  const next = makeState(state);
  next.requests[domain] = null; next.errors[domain] = error; next.timeouts[domain] = error === "timeout";
  return makeState(next);
}
/** Data consumers must commit their matching payload only when accepted is true. */
export function completeHomepageRequest(state: HomepageState, result: HomepageRequestResult): { state: HomepageState; accepted: boolean } {
  const domain = result.domain ?? "global";
  const pending = state.requests[domain];
  if (!pending || pending.generation !== result.generation || pending.scopeKey !== result.scopeKey) return { state, accepted: false };
  if (requestKey(state.snapshot, domain, pending.target, pending.purpose) !== pending.scopeKey) return { state: endRequest(state, domain, "superseded"), accepted: false };
  const payload = result.domain === "period" ? normalizePeriod(result.period, "reject") : result.domain === "history" ? normalizeHistoryRange(result.historyRange, "reject") : normalizeDraft(result.applied);
  if (!result.ok || !payload || JSON.stringify(payload) !== JSON.stringify(pending.target)) return { state: endRequest(state, domain, result.error ?? "update-failed"), accepted: false };
  const next = endRequest(state, domain, null);
  const snapshot = clone(state.snapshot);
  if (domain === "global") {
    const { attachments, ...scope } = payload as HomepageDraft;
    snapshot.scope = scope; snapshot.attachments = attachments;
    if (pending.purpose === "navigation") {
      snapshot.period = periodFromScope(scope);
      next.draft = { ...scopeWithPeriod(next.draft, snapshot.period), attachments: next.draft.attachments };
    }
  } else if (domain === "period") {
    snapshot.period = payload as HomepagePeriod;
    snapshot.scope = scopeWithPeriod(snapshot.scope, snapshot.period, false);
    next.draft = { ...scopeWithPeriod(next.draft, snapshot.period, false), attachments: next.draft.attachments };
  }
  else snapshot.history.range = payload as HomepageHistoryRange;
  next.snapshot = required(normalizeHomepageSnapshot(snapshot));
  let completed = makeState(next);
  for (const other of DOMAINS) {
    const token = completed.requests[other];
    if (token && requestKey(completed.snapshot, other, token.target, token.purpose) !== token.scopeKey) completed = endRequest(completed, other, "superseded");
  }
  return { state: completed, accepted: true };
}
export function applyHomepageResult(state: HomepageState, result: HomepageApplyResult): HomepageState { return completeHomepageRequest(state, result).state; }
export function retryHomepageRequest(state: HomepageState, domain: HomepageRequestDomain, now = Date.now()): HomepageState {
  if (domain === "global") {
    const last = state.lastGlobalRead;
    if (last?.purpose === "refresh") return beginHomepageRead(state, { purpose: "refresh" }, now);
    if (last?.purpose === "navigation" && last.navigationScope) return beginHomepageRead(state, { purpose: "navigation", scope: last.navigationScope }, now);
    return begin(state, "global", state.draft, now, last?.purpose ?? "apply");
  }
  return begin(state, domain, domain === "period" ? state.periodDraft : state.historyDraft, now);
}
export function retryHomepageApply(state: HomepageState, now = Date.now()): HomepageState { return retryHomepageRequest(state, "global", now); }
export function homepageRequestTimedOut(state: HomepageState, now = Date.now(), timeoutMs = 15_000, domain: HomepageRequestDomain = "global"): boolean {
  const request = state.requests[domain];
  return Boolean(request && now - request.startedAt >= timeoutMs);
}
export function markHomepageRequestTimedOut(state: HomepageState, now = Date.now(), timeoutMs = 15_000, domain: HomepageRequestDomain = "global"): HomepageState {
  return homepageRequestTimedOut(state, now, timeoutMs, domain) ? endRequest(state, domain, "timeout") : state;
}
export function cancelHomepageRequest(state: HomepageState, domain: HomepageRequestDomain): HomepageState {
  const next = endRequest(state, domain, null);
  next.requestCounter += 1;
  if (domain === "period") next.periodDraft = clone(state.snapshot.period);
  if (domain === "history") next.historyDraft = clone(state.snapshot.history.range);
  return makeState(next);
}
export function cancelHomepageDraft(state: HomepageState): HomepageState { return cancelHomepageRequest(state, "global"); }
/** Changing identity prepares a new draft; the old committed title remains until success. */
export function changeHomepageIdentity(state: HomepageState, scope: HomepageScope): HomepageState {
  const next = createHomepageState(scope, state);
  return editHomepageDraft(next, { ...next.draft, attachments: emptyAttachments() });
}
export function clearHomepageAttachments(state: HomepageState): HomepageState { return editHomepageDraft(state, { ...state.draft, attachments: emptyAttachments() }); }
export function resetHomepageDefaults(state: HomepageState): HomepageState {
  return editHomepageDraft(state, { ...state.draft, market: "all", accounts: [ALL_ACCOUNTS], attachments: emptyAttachments() });
}
export type HomepageUiPatch = Partial<Pick<HomepageSnapshot, "holdings" | "contribution" | "search" | "returnState" | "scrollTop" | "focus" | "futureDisclosureSources">> & { historyChartMode?: HomepageHistoryChartMode };
export function updateHomepageUi(state: HomepageState, patch: HomepageUiPatch): HomepageState {
  const { historyChartMode, ...ui } = patch;
  const allowed = ["holdings", "contribution", "search", "returnState", "scrollTop", "focus", "futureDisclosureSources"];
  if (Object.keys(ui).some(key => !allowed.includes(key))) throw new Error("applied-ui-requires-request");
  const snapshot = required(normalizeHomepageSnapshot({ ...state.snapshot, ...ui, history: { ...state.snapshot.history, chartMode: historyChartMode ?? state.snapshot.history.chartMode } }));
  return makeState({ ...state, snapshot });
}
/** Strip non-UI properties recursively; malformed UI values are never defaulted. */
export function encodeHomepageSnapshot(snapshot: HomepageSnapshot): string { return JSON.stringify(required(normalizeHomepageSnapshot(snapshot, "strip"))); }
export type HomepageSnapshotRead = { ok: true; snapshot: HomepageSnapshot } | { ok: false; error: "missing-snapshot" | "invalid-json" | "unsupported-version" | "invalid-snapshot" };
export function readHomepageSnapshot(serialized: string | null): HomepageSnapshotRead {
  if (!serialized) return { ok: false, error: "missing-snapshot" };
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { return { ok: false, error: "invalid-json" }; }
  if (value && typeof value === "object" && "version" in value && value.version !== 2 && value.version !== 3) return { ok: false, error: "unsupported-version" };
  const snapshot = normalizeHomepageSnapshot(value);
  return snapshot ? { ok: true, snapshot } : { ok: false, error: "invalid-snapshot" };
}
export function decodeHomepageSnapshot(serialized: string | null): HomepageSnapshot | null {
  const result = readHomepageSnapshot(serialized);
  return result.ok ? result.snapshot : null;
}
/** Restoring creates no active request and loads no business data. */
export function restoreHomepageState(serialized: string | null, previous?: HomepageState): { ok: true; state: HomepageState } | Exclude<HomepageSnapshotRead, { ok: true }> {
  const result = readHomepageSnapshot(serialized);
  return result.ok ? { ok: true, state: stateFromSnapshot(result.snapshot, previous ? previous.requestCounter + 1 : 0) } : result;
}
export function restoreHomepageFocus(snapshot: HomepageSnapshot, objectExists: boolean): { focus: HomepageFocus; triggerFocusId: string | null; fallbackTitle: string | null } {
  if (!objectExists) return { focus: "title", triggerFocusId: null, fallbackTitle: snapshot.returnState.missingContainerTitle };
  const focus = snapshot.returnState.container ?? snapshot.focus;
  return { focus, triggerFocusId: snapshot.returnState.triggerFocusId ?? (focus === "search" ? snapshot.search.triggerFocusId : null), fallbackTitle: null };
}

/** Navigation reads committed UI only; null explicitly removes a source symbol. */
export function homepageNavigationScope(snapshot: HomepageSnapshot, symbolIdentity?: string | null): HomepageScope {
  const safe = required(normalizeHomepageSnapshot(snapshot));
  const scope = clone(safe.scope);
  if (symbolIdentity === null) delete scope.symbolIdentity;
  else if (symbolIdentity !== undefined) scope.symbolIdentity = symbolIdentity;
  return required(normalizeScope(scope, "reject"));
}

export type HomepageNavigation = { ok: true; scope: HomepageScope; query: string; warning?: "invalid-market" } | { ok: false; error: "invalid-scope" | "invalid-account" | "invalid-symbol" | "invalid-range" | "missing-accounts"; query: string };
export type HomepageNavigationOptions = { allowedAccounts?: readonly string[]; allowedSymbols?: readonly string[] };
export function parseHomepageNavigation(input: string | URL, options: HomepageNavigationOptions = {}): HomepageNavigation {
  let url: URL;
  try { url = typeof input === "string" ? new URL(input, "http://localhost") : input; } catch { return { ok: false, error: "invalid-scope", query: "" }; }
  const params = url.searchParams; const query = url.search;
  if (params.has("queue") || params.getAll("scope").length !== 1 || params.get("scope") !== "live") return { ok: false, error: "invalid-scope", query };
  const accountRaw = params.get("accounts");
  if (accountRaw === null) return { ok: false, error: "missing-accounts", query };
  if (params.getAll("accounts").length !== 1) return { ok: false, error: "invalid-account", query };
  const accounts = normalizeAccounts(accountRaw.split(",").map(account => account.trim()));
  if (!accounts || (options.allowedAccounts && accounts.some(account => account !== ALL_ACCOUNTS && !options.allowedAccounts!.includes(account)))) return { ok: false, error: "invalid-account", query };
  if (params.getAll("market").length > 1) return { ok: false, error: "invalid-scope", query };
  const rawMarket = params.get("market") ?? "all";
  const market = MARKETS.includes(rawMarket as HomepageMarket) ? rawMarket as HomepageMarket : "all";
  const warning = rawMarket === market ? undefined : "invalid-market" as const;
  if (["rangeMode", "from", "to", "date"].some(key => params.getAll(key).length > 1)) return { ok: false, error: "invalid-range", query };
  const symbol = params.get("symbol");
  if (params.getAll("symbol").length > 1 || (symbol !== null && (!validSymbol(symbol) || (options.allowedSymbols && !options.allowedSymbols.includes(symbol))))) return { ok: false, error: "invalid-symbol", query };
  const candidate: ObjectValue = { live: true, market, accounts, rangeMode: params.get("rangeMode") ?? (params.has("date") ? "date" : "all") };
  for (const key of ["from", "to", "date"] as const) if (params.has(key)) candidate[key] = params.get(key);
  if (symbol !== null) candidate.symbolIdentity = symbol;
  const scope = normalizeScope(candidate, "reject");
  if (!scope) return { ok: false, error: "invalid-range", query };
  return warning ? { ok: true, scope, query, warning } : { ok: true, scope, query };
}
export function serializeHomepageNavigation(scope: HomepageScope, path = "/trades"): string {
  // Applied is a structural subtype of Scope; only target navigation fields leave here.
  const safe = required(normalizeScope(scope, "strip"));
  if (!/^\/[^?#]*$/.test(path)) throw new Error("invalid-navigation-path");
  const params = new URLSearchParams({ scope: "live", market: safe.market, accounts: safe.accounts.join(","), rangeMode: safe.rangeMode });
  for (const key of ["from", "to", "date", "symbolIdentity"] as const) if (safe[key] !== undefined) params.set(key === "symbolIdentity" ? "symbol" : key, safe[key]);
  return `${path}?${params.toString()}`;
}
