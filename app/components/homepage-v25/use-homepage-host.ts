"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  beginHomepageHistoryApply, beginHomepagePeriodApply, cancelHomepageDraft, cancelHomepageRequest, clearHomepageAttachments, completeHomepageRequest,
  createHomepageState, editHomepageDraft, editHomepageHistoryDraft, editHomepagePeriodDraft, encodeHomepageSnapshot, homepageScopeKey,
  markHomepageRequestTimedOut, parseHomepageNavigation, restoreHomepageState, retryHomepageRequest, serializeHomepageNavigation,
  resetHomepageDefaults, updateHomepageUi, type HomepageApplied, type HomepageAttachments, type HomepageDraft, type HomepageHistoryRange,
  type HomepagePeriod, type HomepageReadIntent, type HomepageRequest, type HomepageScope, type HomepageSnapshot, type HomepageUiPatch,
} from "../../lib/reviews/homepage-v25-state";
import { cancelHomepageLocalReads, completeHomepageGlobalRead, completeHomepageHistoryRead, completeHomepagePeriodRead, createHomepageSession,
  homepageGlobalReadState, homepageReadTarget, homepageRequestMatches, homepageTradeUrl, startHomepageRead, type HomepageDomainData } from "./session-model";

const DEFAULT_SCOPE: HomepageScope = { live: true, market: "all", accounts: ["*"], rangeMode: "all" };
const STORAGE_KEY = "tradereview:homepage-v25:source-ui:v3";
const LEGACY_STORAGE_KEY = "tradereview:homepage-v25:source-ui:v2";
type Page = "home" | "trades";
export type HomepageHostReadContext = { destination: Page; request: HomepageRequest; readTarget: HomepageDraft; ranges: { period: HomepagePeriod; historyRange: HomepageHistoryRange } };
export type HomepageHostDomainSource<T> = { data: T; applied: Pick<HomepageApplied, "live" | "market" | "accounts" | "symbolIdentity" | "attachments"> };
export type HomepageHostPeriodReadContext<T> = { domain: "period"; destination: "home"; request: HomepageRequest<HomepagePeriod, "period">; source: HomepageHostDomainSource<T> };
export type HomepageHostHistoryReadContext<T> = { domain: "history"; destination: "home"; request: HomepageRequest<HomepageHistoryRange, "history">; source: HomepageHostDomainSource<T> };
export type HomepageHostPeriodReadResult<TP> = { request: HomepageRequest<HomepagePeriod, "period">; data: TP };
export type HomepageHostHistoryReadResult<TH> = { request: HomepageRequest<HomepageHistoryRange, "history">; data: TH };
export type HomepageHostDomainAccepted<T, TP, TH> =
  | { domain: "period"; data: TP; context: HomepageHostPeriodReadContext<T> }
  | { domain: "history"; data: TH; context: HomepageHostHistoryReadContext<T> };
export type HomepageHostDomains<T, TP, TH> = {
  seed: HomepageDomainData<TP, TH>;
  fromGlobal: (data: T, context: HomepageHostReadContext, accepted: HomepageSnapshot) => HomepageDomainData<TP, TH>;
  reloadPeriod: (context: HomepageHostPeriodReadContext<T>) => Promise<HomepageHostPeriodReadResult<TP>>;
  reloadHistory: (context: HomepageHostHistoryReadContext<T>) => Promise<HomepageHostHistoryReadResult<TH>>;
  onReadAccepted?: (event: HomepageHostDomainAccepted<T, TP, TH>) => void;
};
export type HomepageHostDomainActions = {
  onPeriodDraft: (period: HomepagePeriod) => void; applyPeriod: (period: HomepagePeriod) => boolean; retryPeriodRead: () => boolean; cancelPeriodRead: () => void;
  onHistoryDraft: (range: HomepageHistoryRange) => void; applyHistory: (range: HomepageHistoryRange) => boolean; retryHistoryRead: () => boolean; cancelHistoryRead: () => void;
};
type Route = { page: Page; scope: HomepageScope; collectionOrigin: "global" | "homepage"; error: string | null; key: number };
export type HomepageHostOptions<T, TP = never, TH = never> = {
  enabled: boolean; ready: boolean; readOnInitialize?: boolean; readCollections?: boolean; revision: number; data: T;
  accounts: readonly { id: string; label: string }[];
  identities: Readonly<Record<string, string | readonly string[]>>;
  catalogFor?: (data: T) => { accounts: readonly { id: string; label: string }[]; identities: Readonly<Record<string, string | readonly string[]>> };
  reload: (requestId: number, context?: HomepageHostReadContext) => Promise<{ requestId: number; data: T; kind?: "collection" }>;
  onReadAccepted?: (data: T) => void;
  guard: (page: Page) => Promise<boolean>;
  domains?: HomepageHostDomains<T, TP, TH>;
};
type Pending = { token: HomepageRequest; source?: string };
type SourceRecovery = { generation: number; source?: string };
function routeError(code: string) {
  return code === "invalid-account" ? "目标账户已不存在或不可用，请选择有效账户。" : code === "invalid-symbol" ? "目标证券身份无法解析，请重新选择证券。" : code === "invalid-range" ? "目标成交日期范围无效，请检查 URL。" : "目标交易范围无效，请检查 URL。";
}

/** Owns UI-only restoration and guarded native addresses within the persistent workspace. */
export function useHomepageHost<T, TP = never, TH = never>(options: HomepageHostOptions<T, TP, TH>) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  // Capability and data slots are mount seeds; ambient props never publish data.
  const [configured] = useState(() => Boolean(options.domains));
  const mounted = useRef(true);
  const [session, setSession] = useState(() => createHomepageSession(createHomepageState(DEFAULT_SCOPE), options.data, options.domains?.seed));
  const sessionRef = useRef(session);
  const [initialized, setInitialized] = useState(false);
  const initializedRef = useRef(false);
  const initializingRead = useRef(false);
  const [route, setRoute] = useState<Route>({ page: "home", scope: DEFAULT_SCOPE, collectionOrigin: "homepage", error: null, key: 0 });
  const routeRef = useRef(route);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoreKey, setRestoreKey] = useState(0);
  // A collection owns only the catalog for this native route, never a second
  // committed homepage scope or a partially completed financial bundle.
  const [collection, setCollection] = useState<{ routeKey: number; data: T; target: HomepageDraft } | null>(null);
  const pending = useRef<Pending | null>(null);
  const localPending = useRef<{ period: HomepageRequest<HomepagePeriod, "period"> | null; history: HomepageRequest<HomepageHistoryRange, "history"> | null }>({ period: null, history: null });
  // A failed/timed-out read ends its active request, not its readonly source.
  // Only a matching owned success can give committed UI source-write authority.
  const sourceRecovery = useRef<SourceRecovery | null>(null);
  const source = useRef<string | null>(null);
  const address = useRef("/home");
  const index = useRef(0);
  const navigationIntent = useRef(0);
  const skipPop = useRef(false);
  const afterPopReverted = useRef<(() => void) | null>(null);
  const allowedPop = useRef(false);
  const popBusy = useRef(false);
  const update = useCallback((next: typeof session) => { sessionRef.current = next; setSession(next); }, []);
  const abandonLocalReads = useCallback(() => {
    localPending.current = { period: null, history: null };
    const ui = cancelHomepageLocalReads(sessionRef.current.ui);
    if (ui !== sessionRef.current.ui) update({ ...sessionRef.current, ui });
  }, [update]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; localPending.current = { period: null, history: null }; }; }, []);
  useEffect(() => { if (!options.enabled) abandonLocalReads(); }, [abandonLocalReads, options.enabled]);
  const setAddressRoute = useCallback((next: Omit<Route, "key" | "collectionOrigin"> & { collectionOrigin?: Route["collectionOrigin"] }) => {
    const value = { ...next, collectionOrigin: next.collectionOrigin ?? "homepage", key: routeRef.current.key + 1 }; routeRef.current = value; setRoute(value);
  }, []);
  const validate = useCallback((url: URL) => parseHomepageNavigation(url, {
    allowedAccounts: latest.current.accounts.map(account => account.id),
    allowedSymbols: Object.keys(latest.current.identities),
  }), []);
  const validateSource = useCallback((bytes: string | null) => {
    const restored = restoreHomepageState(bytes, sessionRef.current.ui);
    if (!restored.ok) { if (bytes) setNotice("来源首页 UI 无法恢复，已按当前地址读取；请重新选择所需条件。"); return null; }
    const checked = validate(new URL(serializeHomepageNavigation(restored.state.snapshot.scope, "/home"), window.location.origin));
    if (!checked.ok) { setNotice(`来源首页条件已变化：${routeError(checked.error)}`); return null; }
    return restored.state;
  }, [validate]);
  const persist = useCallback((bytes: string) => {
    source.current = bytes;
    try { window.sessionStorage.setItem(STORAGE_KEY, bytes); }
    catch { setNotice("浏览器无法保存来源 UI；本次返回仍可恢复，刷新后需重新选择条件。"); }
  }, []);
  const replaceEntry = useCallback(() => {
    window.history.replaceState({ ...window.history.state, hpV25: true, hpIndex: index.current, hpSource: source.current }, "", address.current);
  }, []);
  const beginRead = useCallback((intent: HomepageReadIntent | "retry", bytes?: string) => {
    localPending.current = { period: null, history: null };
    const next = intent === "retry" ? { ...sessionRef.current, ui: retryHomepageRequest(cancelHomepageLocalReads(sessionRef.current.ui), "global") }
      : startHomepageRead(sessionRef.current, intent);
    const token = next.ui.requests.global;
    if (!token) return;
    const readSource = intent === "retry" && sourceRecovery.current
      ? token.purpose === "navigation" ? sourceRecovery.current.source : undefined
      : bytes;
    if (token.purpose === "navigation") sourceRecovery.current = { generation: token.generation, source: readSource };
    else if (sourceRecovery.current) sourceRecovery.current = { ...sourceRecovery.current, generation: token.generation };
    pending.current = { token, source: readSource };
    const destination = routeRef.current.page;
    const inheritSource = destination === "home" || routeRef.current.collectionOrigin === "homepage";
    const readTarget = homepageReadTarget(token, readSource, inheritSource);
    const projected = homepageGlobalReadState(next.ui, token, readSource).state.snapshot;
    const context: HomepageHostReadContext = { destination, request: token, readTarget, ranges: { period: projected.period, historyRange: projected.history.range } };
    update(next);
    void latest.current.reload(token.generation, context).then(result => {
      if (result.requestId !== token.generation || pending.current?.token.generation !== token.generation) return;
      if (configured) {
        if (!homepageRequestMatches(sessionRef.current.ui.requests.global, token)) return;
        const timed = markHomepageRequestTimedOut(sessionRef.current.ui);
        if (timed !== sessionRef.current.ui) {
          pending.current = null; update({ ...sessionRef.current, ui: timed });
          if (initializingRead.current || destination === "trades") {
            if (destination === "trades") setAddressRoute({ ...routeRef.current, error: "目标交易集合读取超时，请重试。" });
            initializingRead.current = false; setInitialized(true);
          }
          return;
        }
      }
      const catalog = latest.current.catalogFor?.(result.data);
      let acceptedBytes = readSource;
      let fallbackAccounts: string[] | null = null;
      if (catalog) {
        if (token.target.symbolIdentity && !catalog.identities[token.target.symbolIdentity]) throw new Error("目标证券身份已无法解析，新范围未应用，请重新选择证券。");
        const available = new Set(catalog.accounts.map(account => account.id));
        const missing = token.target.accounts.filter(account => account !== "*" && !available.has(account));
        if (missing.length) {
          if (!readSource) throw new Error("目标账户已不存在，新范围未应用，请重新选择账户。");
          const restored = restoreHomepageState(readSource);
          if (restored.ok) {
            const remaining = token.target.accounts.filter(account => available.has(account));
            fallbackAccounts = remaining.length ? remaining : ["*"];
            acceptedBytes = encodeHomepageSnapshot({ ...restored.state.snapshot, scope: { ...restored.state.snapshot.scope, accounts: fallbackAccounts } });
            setNotice("来源账户已不存在，已恢复其余可用账户；没有可用来源账户时显示全部账户。");
          }
        }
      }
      if (result.kind === "collection" && destination !== "trades") throw new Error("首页金融数据尚未完整读取，请重试。");
      const previous = sessionRef.current;
      const domains = configured ? latest.current.domains : undefined;
      const retainedDomains = previous.domainData;
      const completed = completeHomepageGlobalRead(previous, token, result.data, { sourceBytes: acceptedBytes,
        domainData: result.kind === "collection" && retainedDomains ? () => retainedDomains : domains ? snapshot => domains.fromGlobal(result.data, context, snapshot) : undefined });
      pending.current = null;
      if (completed.accepted) {
        const next = result.kind === "collection" ? { ...completed.session, data: previous.data } : completed.session;
        update(next); setRestoreKey(key => key + 1);
        if (sourceRecovery.current?.generation === token.generation) sourceRecovery.current = null;
        if (routeRef.current.page === "home") {
          setAddressRoute({ page: "home", scope: next.ui.snapshot.scope, error: null });
          address.current = serializeHomepageNavigation(next.ui.snapshot.scope, "/home");
          persist(encodeHomepageSnapshot(next.ui.snapshot)); replaceEntry();
        } else if (routeRef.current.error) {
          setAddressRoute({ ...routeRef.current, error: null });
        }
        if (destination === "trades") {
          // Qualify complete owned sources only after fresh catalog fallback.
          // Compatibility was checked against the original target, before its
          // deleted accounts could be replaced by the explicit fallback.
          const target = { ...readTarget, ...(fallbackAccounts ? { accounts: fallbackAccounts } : {}) };
          setCollection({ routeKey: routeRef.current.key, data: result.data, target });
        }
        if (initializingRead.current) { initializingRead.current = false; setInitialized(true); }
        try { latest.current.onReadAccepted?.(result.data); } catch { setNotice("数据已应用，更新通知失败。"); }
      } else {
        update(completed.session);
        if (configured && (initializingRead.current || destination === "trades")) {
          if (destination === "trades") setAddressRoute({ ...routeRef.current, error: completed.session.ui.errors.global ?? "目标交易集合读取失败，请重试。" });
          initializingRead.current = false; setInitialized(true);
        }
      }
    }).catch(error => {
      const current = pending.current?.token.generation === token.generation;
      if (configured && !current) return;
      const timed = configured ? markHomepageRequestTimedOut(sessionRef.current.ui) : sessionRef.current.ui;
      if (timed !== sessionRef.current.ui) {
        pending.current = null; update({ ...sessionRef.current, ui: timed });
        if (initializingRead.current || destination === "trades") {
          if (destination === "trades") setAddressRoute({ ...routeRef.current, error: "目标交易集合读取超时，请重试。" });
          initializingRead.current = false; setInitialized(true);
        }
        return;
      }
      const result = completeHomepageRequest(sessionRef.current.ui, { generation: token.generation, scopeKey: token.scopeKey, ok: false, error: error instanceof Error ? error.message : "read-failed" });
      if (current) pending.current = null;
      update({ ...sessionRef.current, ui: result.state });
      if (current && (initializingRead.current || routeRef.current.page === "trades" || routeRef.current.error)) {
        if (routeRef.current.page === "trades") setAddressRoute({ ...routeRef.current, error: error instanceof Error ? error.message : "目标交易集合读取失败，请重试。" });
        initializingRead.current = false; setInitialized(true);
      }
    });
  }, [configured, persist, replaceEntry, setAddressRoute, update]);
  const acceptAddress = useCallback((url: URL, restoredBytes?: string | null, read = false) => {
    const page: Page = url.pathname === "/trades" ? "trades" : "home";
    if (page === "trades") abandonLocalReads();
    const hasQuery = url.search.length > 0;
    const parsed = hasQuery ? validate(url) : { ok: true as const, scope: DEFAULT_SCOPE };
    if (!parsed.ok) { setAddressRoute({ page, scope: DEFAULT_SCOPE, error: routeError(parsed.error) }); return; }
    if ("warning" in parsed && parsed.warning) setNotice("URL 中的市场无效，已按全部市场显示。");
    if (page === "trades") {
      setAddressRoute({ page, scope: parsed.scope, collectionOrigin: hasQuery ? "homepage" : "global", error: null });
      if (read && latest.current.readCollections) beginRead({ purpose: "navigation", scope: parsed.scope }, restoredBytes ?? source.current ?? undefined);
      return;
    }
    const restored = validateSource(restoredBytes ?? source.current);
    const canRestore = restored && (!hasQuery || homepageScopeKey(restored.snapshot.scope) === homepageScopeKey(parsed.scope));
    const scope = canRestore ? restored.snapshot.scope : parsed.scope;
    setAddressRoute({ page, scope, error: null });
    if (read) beginRead({ purpose: "navigation", scope }, canRestore ? encodeHomepageSnapshot(restored.snapshot) : undefined);
    else update({ ...sessionRef.current, ui: canRestore ? restored : createHomepageState(scope) });
  }, [abandonLocalReads, beginRead, setAddressRoute, update, validate, validateSource]);

  // This adapter hydrates the native address/session-storage snapshot once,
  // after its external account catalog is ready.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!options.enabled || !options.ready || initializedRef.current) return;
    initializedRef.current = true;
    const current = new URL(window.location.href);
    address.current = `${current.pathname === "/" ? "/home" : current.pathname}${current.search}`;
    index.current = typeof window.history.state?.hpIndex === "number" ? window.history.state.hpIndex : 0;
    let bytes: string | null = window.history.state?.hpSource ?? null;
    if (!bytes) { try { bytes = window.sessionStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(LEGACY_STORAGE_KEY); } catch { setNotice("浏览器无法读取来源 UI，已从当前地址加载。"); } }
    source.current = bytes;
    acceptAddress(new URL(address.current, window.location.origin), bytes);
    if (options.readOnInitialize && !routeRef.current.error) {
      const restored = validateSource(bytes);
      const matching = restored && (routeRef.current.page === "trades" || homepageScopeKey(restored.snapshot.scope) === homepageScopeKey(routeRef.current.scope));
      initializingRead.current = true;
      beginRead({ purpose: "navigation", scope: routeRef.current.scope }, matching ? encodeHomepageSnapshot(restored.snapshot) : undefined);
    } else setInitialized(true);
    replaceEntry();
  }, [acceptAddress, beginRead, options.enabled, options.readOnInitialize, options.ready, replaceEntry, validateSource]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // options.data seeds initialization only. After that, the accepted owned
  // read is the sole bundle authority; legacy owners can lag one field (FX)
  // while publishing another and must never roll a committed bundle back.

  useEffect(() => {
    if (!initialized) return;
    const available = new Set(options.accounts.map(account => account.id));
    if (sessionRef.current.ui.snapshot.scope.accounts.some(account => account !== "*" && !available.has(account))) {
      setNotice("当前账户已不可用，请选择其他账户；返回来源时将按最新账户目录恢复。");
    }
  }, [initialized, options.accounts]);

  useEffect(() => {
    const request = session.ui.requests.global;
    if (!request) return;
    // UI-only state cloning must keep the owned read's original deadline.
    const remaining = Math.max(0, request.startedAt + (configured ? 15_000 : 15_010) - Date.now());
    const timer = window.setTimeout(() => {
      const current = sessionRef.current.ui.requests.global;
      if (!current || current.generation !== request.generation || current.scopeKey !== request.scopeKey || current.startedAt !== request.startedAt) return;
      const ui = markHomepageRequestTimedOut(sessionRef.current.ui);
      if (ui !== sessionRef.current.ui) {
        pending.current = null; update({ ...sessionRef.current, ui });
        if (initializingRead.current || routeRef.current.page === "trades") {
          if (routeRef.current.page === "trades") setAddressRoute({ ...routeRef.current, error: "目标交易集合读取超时，请重试。" });
          initializingRead.current = false; setInitialized(true);
        }
      }
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [configured, session.ui.requests.global, setAddressRoute, update]);

  const canReadDomain = useCallback(() => configured && mounted.current && latest.current.enabled && latest.current.ready &&
    initializedRef.current && !initializingRead.current && routeRef.current.page === "home" && !routeRef.current.error &&
    !pending.current && !sessionRef.current.ui.requests.global && !sourceRecovery.current && Boolean(latest.current.domains), [configured]);
  const domainSource = useCallback((): HomepageHostDomainSource<T> => {
    const { live, market, accounts, symbolIdentity } = sessionRef.current.ui.snapshot.scope;
    return { data: sessionRef.current.data, applied: { live, market, accounts: [...accounts], ...(symbolIdentity === undefined ? {} : { symbolIdentity }),
      attachments: { ...sessionRef.current.ui.snapshot.attachments, categories: [...sessionRef.current.ui.snapshot.attachments.categories], pendingReview: [...sessionRef.current.ui.snapshot.attachments.pendingReview] } } };
  }, []);
  const expireLocal = useCallback((domain: "period" | "history") => {
    const ui = markHomepageRequestTimedOut(sessionRef.current.ui, Date.now(), 15_000, domain);
    if (ui === sessionRef.current.ui) return false;
    localPending.current[domain] = null; update({ ...sessionRef.current, ui }); return true;
  }, [update]);
  const activeLocal = useCallback((token: HomepageRequest<HomepagePeriod, "period"> | HomepageRequest<HomepageHistoryRange, "history">) => {
    if (!canReadDomain() || !homepageRequestMatches(localPending.current[token.domain], token) || !homepageRequestMatches(sessionRef.current.ui.requests[token.domain], token)) return false;
    return !expireLocal(token.domain);
  }, [canReadDomain, expireLocal]);
  const publishLocal = useCallback((next: typeof session, domain: "period" | "history") => {
    update(next);
    if (domain === "period") {
      setAddressRoute({ page: "home", scope: next.ui.snapshot.scope, error: null });
      address.current = serializeHomepageNavigation(next.ui.snapshot.scope, "/home");
    }
    persist(encodeHomepageSnapshot(next.ui.snapshot)); replaceEntry();
  }, [persist, replaceEntry, setAddressRoute, update]);
  const notifyDomain = useCallback((event: HomepageHostDomainAccepted<T, TP, TH>) => {
    try { latest.current.domains?.onReadAccepted?.(event); } catch { setNotice("数据已应用，更新通知失败。"); }
  }, []);
  const readPeriod = useCallback((period: HomepagePeriod | "retry"): boolean => {
    if (!canReadDomain()) return false;
    const domains = latest.current.domains;
    if (!domains) return false;
    const ui = period === "retry" ? retryHomepageRequest(sessionRef.current.ui, "period") : beginHomepagePeriodApply(sessionRef.current.ui, period);
    const token = ui.requests.period;
    if (!token) return false;
    const context: HomepageHostPeriodReadContext<T> = { domain: "period", destination: "home", request: token, source: domainSource() };
    localPending.current.period = token; update({ ...sessionRef.current, ui });
    const fail = (error: unknown) => {
      if (!activeLocal(token)) return;
      const failed = completeHomepageRequest(sessionRef.current.ui, { domain: "period", generation: token.generation, scopeKey: token.scopeKey, ok: false, error: error instanceof Error ? error.message : "read-failed" });
      localPending.current.period = null; update({ ...sessionRef.current, ui: failed.state });
    };
    try {
      void domains.reloadPeriod(context).then(result => {
        if (!activeLocal(token) || !homepageRequestMatches(token, result.request)) return;
        const completed = completeHomepagePeriodRead(sessionRef.current, result.request, result.data);
        localPending.current.period = null;
        if (completed.accepted) {
          publishLocal(completed.session, "period"); notifyDomain({ domain: "period", data: result.data, context });
        } else update(completed.session);
      }).catch(fail);
    } catch (error) { fail(error); }
    return true;
  }, [activeLocal, canReadDomain, domainSource, notifyDomain, publishLocal, update]);
  const readHistory = useCallback((range: HomepageHistoryRange | "retry"): boolean => {
    if (!canReadDomain()) return false;
    const domains = latest.current.domains;
    if (!domains) return false;
    const ui = range === "retry" ? retryHomepageRequest(sessionRef.current.ui, "history") : beginHomepageHistoryApply(sessionRef.current.ui, range);
    const token = ui.requests.history;
    if (!token) return false;
    const context: HomepageHostHistoryReadContext<T> = { domain: "history", destination: "home", request: token, source: domainSource() };
    localPending.current.history = token; update({ ...sessionRef.current, ui });
    const fail = (error: unknown) => {
      if (!activeLocal(token)) return;
      const failed = completeHomepageRequest(sessionRef.current.ui, { domain: "history", generation: token.generation, scopeKey: token.scopeKey, ok: false, error: error instanceof Error ? error.message : "read-failed" });
      localPending.current.history = null; update({ ...sessionRef.current, ui: failed.state });
    };
    try {
      void domains.reloadHistory(context).then(result => {
        if (!activeLocal(token) || !homepageRequestMatches(token, result.request)) return;
        const completed = completeHomepageHistoryRead(sessionRef.current, result.request, result.data);
        localPending.current.history = null;
        if (completed.accepted) {
          publishLocal(completed.session, "history"); notifyDomain({ domain: "history", data: result.data, context });
        } else update(completed.session);
      }).catch(fail);
    } catch (error) { fail(error); }
    return true;
  }, [activeLocal, canReadDomain, domainSource, notifyDomain, publishLocal, update]);
  const onPeriodDraft = useCallback((period: HomepagePeriod) => {
    if (canReadDomain()) update({ ...sessionRef.current, ui: editHomepagePeriodDraft(sessionRef.current.ui, period) });
  }, [canReadDomain, update]);
  const onHistoryDraft = useCallback((range: HomepageHistoryRange) => {
    if (canReadDomain()) update({ ...sessionRef.current, ui: editHomepageHistoryDraft(sessionRef.current.ui, range) });
  }, [canReadDomain, update]);
  const retryPeriodRead = useCallback(() => readPeriod("retry"), [readPeriod]);
  const retryHistoryRead = useCallback(() => readHistory("retry"), [readHistory]);
  const applyPeriod = useCallback((period: HomepagePeriod) => readPeriod(period), [readPeriod]);
  const applyHistory = useCallback((range: HomepageHistoryRange) => readHistory(range), [readHistory]);
  const cancelPeriodRead = useCallback(() => {
    if (!configured) return;
    localPending.current.period = null; update({ ...sessionRef.current, ui: cancelHomepageRequest(sessionRef.current.ui, "period") });
  }, [configured, update]);
  const cancelHistoryRead = useCallback(() => {
    if (!configured) return;
    localPending.current.history = null; update({ ...sessionRef.current, ui: cancelHomepageRequest(sessionRef.current.ui, "history") });
  }, [configured, update]);

  const periodOwner = session.ui.requests.period;
  const historyOwner = session.ui.requests.history;
  const periodGeneration = periodOwner?.generation; const periodScopeKey = periodOwner?.scopeKey; const periodStartedAt = periodOwner?.startedAt;
  const historyGeneration = historyOwner?.generation; const historyScopeKey = historyOwner?.scopeKey; const historyStartedAt = historyOwner?.startedAt;
  useEffect(() => {
    if (periodGeneration === undefined || periodScopeKey === undefined || periodStartedAt === undefined) return;
    const timer = window.setTimeout(() => {
      if (homepageRequestMatches(sessionRef.current.ui.requests.period, { domain: "period", generation: periodGeneration, scopeKey: periodScopeKey, startedAt: periodStartedAt })) expireLocal("period");
    }, Math.max(0, periodStartedAt + 15_000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expireLocal, periodGeneration, periodScopeKey, periodStartedAt]);
  useEffect(() => {
    if (historyGeneration === undefined || historyScopeKey === undefined || historyStartedAt === undefined) return;
    const timer = window.setTimeout(() => {
      if (homepageRequestMatches(sessionRef.current.ui.requests.history, { domain: "history", generation: historyGeneration, scopeKey: historyScopeKey, startedAt: historyStartedAt })) expireLocal("history");
    }, Math.max(0, historyStartedAt + 15_000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expireLocal, historyGeneration, historyScopeKey, historyStartedAt]);

  const onUi = useCallback((patch: HomepageUiPatch) => {
    const next = { ...sessionRef.current, ui: updateHomepageUi(sessionRef.current.ui, patch) };
    update(next);
    if (initializedRef.current && routeRef.current.page === "home" && !sourceRecovery.current) { persist(encodeHomepageSnapshot(next.ui.snapshot)); replaceEntry(); }
  }, [persist, replaceEntry, update]);
  const navigate = useCallback(async (url: string, bytes?: string | null, commit?: () => void): Promise<boolean> => {
    const intent = ++navigationIntent.current;
    const target = new URL(url, window.location.origin);
    const page: Page = target.pathname === "/trades" ? "trades" : "home";
    try {
      if (!await latest.current.guard(page) || intent !== navigationIntent.current) return false;
    } catch {
      if (intent === navigationIntent.current) setNotice("复盘尚未保存，地址切换未完成。");
      return false;
    }
    // No asynchronous work separates the scope commit from its source/address.
    commit?.();
    if (bytes) persist(bytes);
    index.current += 1; address.current = url;
    window.history.pushState({ ...window.history.state, hpV25: true, hpIndex: index.current, hpSource: source.current }, "", url);
    acceptAddress(target, source.current, page === "home" || Boolean(latest.current.readCollections));
    return true;
  }, [acceptAddress, persist]);
  const openTrades = useCallback((identity: string | null) => navigate(homepageTradeUrl(sessionRef.current.ui.snapshot, identity ?? undefined), sourceRecovery.current ? undefined : encodeHomepageSnapshot(sessionRef.current.ui.snapshot)), [navigate]);
  const openGlobalTrades = useCallback((commit?: () => void) => navigate("/trades", sourceRecovery.current ? undefined : encodeHomepageSnapshot(sessionRef.current.ui.snapshot), commit), [navigate]);
  const openHome = useCallback(() => navigate("/home"), [navigate]);
  const onScope = useCallback((scope: HomepageScope) => beginRead({ purpose: "identity", scope }), [beginRead]);
  const onAttachmentDraft = useCallback((attachments: HomepageAttachments) => {
    if (pending.current) return;
    update({ ...sessionRef.current, ui: editHomepageDraft(sessionRef.current.ui, { ...sessionRef.current.ui.draft, attachments }) });
  }, [update]);
  const clearAttachments = useCallback(() => { if (!pending.current) update({ ...sessionRef.current, ui: clearHomepageAttachments(sessionRef.current.ui) }); }, [update]);
  const resetDefaults = useCallback(() => { if (!pending.current) update({ ...sessionRef.current, ui: resetHomepageDefaults(sessionRef.current.ui) }); }, [update]);
  const applyAttachments = useCallback(() => { if (!pending.current) beginRead({ purpose: "apply" }); }, [beginRead]);
  const cancelAttachmentRead = useCallback(() => {
    // A popover cannot cancel an unrelated navigation or refresh owner.
    if (pending.current?.token.purpose !== "apply") return;
    pending.current = null;
    update({ ...sessionRef.current, ui: cancelHomepageDraft(sessionRef.current.ui) });
  }, [update]);
  const removeAttachment = useCallback((attachments: HomepageAttachments) => {
    if (pending.current) return;
    const draft = { ...sessionRef.current.ui.snapshot.scope, attachments };
    update({ ...sessionRef.current, ui: editHomepageDraft(sessionRef.current.ui, draft) });
    beginRead({ purpose: "apply" });
  }, [beginRead, update]);
  const reload = useCallback(() => {
    if (sourceRecovery.current) {
      // Pending navigation already owns the target. After failure, S's retry
      // retains that intent (or a newer explicit identity), with its UI source.
      if (!pending.current) beginRead("retry");
      return;
    }
    const restored = routeRef.current.page === "trades" ? validateSource(source.current) : null;
    if (latest.current.readCollections && routeRef.current.page === "trades" && !sessionRef.current.ui.errors.global) {
      beginRead({ purpose: "navigation", scope: routeRef.current.scope }, restored ? encodeHomepageSnapshot(restored.snapshot) : undefined);
      return;
    }
    beginRead(sessionRef.current.ui.errors.global ? "retry" : { purpose: "refresh" }, restored ? encodeHomepageSnapshot(restored.snapshot) : undefined);
  }, [beginRead, validateSource]);

  useEffect(() => {
    if (!options.enabled || !initialized) return;
    const refresh = () => {
      if (routeRef.current.page === "home" && !routeRef.current.error && !pending.current && !sourceRecovery.current && document.visibilityState !== "hidden") beginRead({ purpose: "refresh" });
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [beginRead, initialized, options.enabled]);

  useEffect(() => {
    if (!options.enabled) return;
    const pop = () => {
      if (skipPop.current) {
        skipPop.current = false;
        const resume = afterPopReverted.current; afterPopReverted.current = null;
        resume?.(); return;
      }
      const targetIndex = window.history.state?.hpIndex;
      const target = new URL(window.location.href);
      if (allowedPop.current) {
        allowedPop.current = false; popBusy.current = false; index.current = targetIndex;
        address.current = `${target.pathname}${target.search}`; source.current = window.history.state?.hpSource ?? source.current;
        acceptAddress(target, source.current, target.pathname !== "/trades" || Boolean(latest.current.readCollections)); return;
      }
      if (popBusy.current) return;
      const intent = ++navigationIntent.current;
      if (typeof targetIndex !== "number") {
        // A same-document entry outside this host has no known distance. Restore
        // the current address synchronously and gate its replacement explicitly.
        const bytes = window.history.state?.hpSource ?? source.current;
        replaceEntry(); popBusy.current = true;
        void latest.current.guard(target.pathname === "/trades" ? "trades" : "home").then(allowed => {
          popBusy.current = false;
          if (!allowed || intent !== navigationIntent.current) return;
          address.current = `${target.pathname}${target.search}`;
          acceptAddress(target, bytes, target.pathname !== "/trades" || Boolean(latest.current.readCollections)); replaceEntry();
        }).catch(() => { popBusy.current = false; setNotice("复盘尚未保存，地址切换未完成。"); });
        return;
      }
      const delta = targetIndex - index.current;
      if (!delta) return;
      popBusy.current = true; skipPop.current = true;
      // history.go is asynchronous: only its compensating pop proves that the
      // current URL/source entry is restored before the guard can cancel.
      afterPopReverted.current = () => {
        void latest.current.guard(target.pathname === "/trades" ? "trades" : "home").then(allowed => {
          if (intent !== navigationIntent.current) { popBusy.current = false; return; }
          if (allowed) { allowedPop.current = true; window.history.go(delta); }
          else popBusy.current = false;
        }).catch(() => { popBusy.current = false; setNotice("复盘尚未保存，地址切换未完成。"); });
      };
      window.history.go(-delta);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [acceptAddress, options.enabled, replaceEntry]);

  const collectionReady = options.readCollections
    ? initialized && route.page === "trades" && collection?.routeKey === route.key && !session.ui.requests.global
    : initialized;
  const collectionData = collectionReady && collection?.routeKey === route.key ? collection.data : null;
  const collectionTarget = collectionReady && collection?.routeKey === route.key ? collection.target : null;
  return { ...session, initialized, route, collectionReady, collectionData, collectionTarget, notice, restoreKey, onUi, onScope,
    onAttachmentDraft, clearAttachments, resetDefaults, applyAttachments, cancelAttachmentRead, removeAttachment, reload, openTrades, openGlobalTrades, openHome,
    onPeriodDraft, applyPeriod, retryPeriodRead, cancelPeriodRead, onHistoryDraft, applyHistory, retryHistoryRead, cancelHistoryRead };
}
