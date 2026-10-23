"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  completeHomepageRequest, createHomepageState, encodeHomepageSnapshot, homepageScopeKey,
  markHomepageRequestTimedOut, parseHomepageNavigation, restoreHomepageState, retryHomepageRequest, serializeHomepageNavigation,
  updateHomepageUi, type HomepageReadIntent, type HomepageRequest, type HomepageScope, type HomepageUiPatch,
} from "../../lib/reviews/homepage-v25-state";
import { createHomepageSession, finishHomepageRead, homepageTradeUrl, startHomepageRead } from "./session-model";

const DEFAULT_SCOPE: HomepageScope = { live: true, market: "all", accounts: ["*"], rangeMode: "all" };
const STORAGE_KEY = "tradereview:homepage-v25:source-ui:v3";
const LEGACY_STORAGE_KEY = "tradereview:homepage-v25:source-ui:v2";
type Page = "home" | "trades";
type Route = { page: Page; scope: HomepageScope; collectionOrigin: "global" | "homepage"; error: string | null; key: number };
type Options<T> = {
  enabled: boolean; ready: boolean; readOnInitialize?: boolean; revision: number; data: T;
  accounts: readonly { id: string; label: string }[];
  identities: Readonly<Record<string, string | readonly string[]>>;
  catalogFor?: (data: T) => { accounts: readonly { id: string; label: string }[]; identities: Readonly<Record<string, string | readonly string[]>> };
  reload: (requestId: number) => Promise<{ requestId: number; data: T }>;
  onReadAccepted?: (data: T) => void;
  guard: (page: Page) => Promise<boolean>;
};
type Pending = { token: HomepageRequest; source?: string };
function routeError(code: string) {
  return code === "invalid-account" ? "目标账户已不存在或不可用，请选择有效账户。" : code === "invalid-symbol" ? "目标证券身份无法解析，请重新选择证券。" : code === "invalid-range" ? "目标成交日期范围无效，请检查 URL。" : "目标交易范围无效，请检查 URL。";
}

/** Owns UI-only restoration and guarded native addresses within the persistent workspace. */
export function useHomepageHost<T>(options: Options<T>) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  const [session, setSession] = useState(() => createHomepageSession(createHomepageState(DEFAULT_SCOPE), options.data));
  const sessionRef = useRef(session);
  const [initialized, setInitialized] = useState(false);
  const initializedRef = useRef(false);
  const [route, setRoute] = useState<Route>({ page: "home", scope: DEFAULT_SCOPE, collectionOrigin: "homepage", error: null, key: 0 });
  const routeRef = useRef(route);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoreKey, setRestoreKey] = useState(0);
  const pending = useRef<Pending | null>(null);
  const source = useRef<string | null>(null);
  const address = useRef("/home");
  const index = useRef(0);
  const navigationIntent = useRef(0);
  const skipPop = useRef(false);
  const afterPopReverted = useRef<(() => void) | null>(null);
  const allowedPop = useRef(false);
  const popBusy = useRef(false);
  const update = useCallback((next: typeof session) => { sessionRef.current = next; setSession(next); }, []);
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
    const next = intent === "retry" ? { ...sessionRef.current, ui: retryHomepageRequest(sessionRef.current.ui, "global") }
      : startHomepageRead(sessionRef.current, intent);
    const token = next.ui.requests.global;
    if (!token) return;
    pending.current = { token, source: bytes };
    update(next);
    void latest.current.reload(token.generation).then(result => {
      if (result.requestId !== token.generation || pending.current?.token.generation !== token.generation) return;
      const catalog = latest.current.catalogFor?.(result.data);
      let acceptedBytes = bytes;
      if (catalog) {
        if (token.target.symbolIdentity && !catalog.identities[token.target.symbolIdentity]) throw new Error("目标证券身份已无法解析，新范围未应用，请重新选择证券。");
        const available = new Set(catalog.accounts.map(account => account.id));
        const missing = token.target.accounts.filter(account => account !== "*" && !available.has(account));
        if (missing.length) {
          if (!bytes) throw new Error("目标账户已不存在，新范围未应用，请重新选择账户。");
          const restored = restoreHomepageState(bytes);
          if (restored.ok) {
            const remaining = token.target.accounts.filter(account => available.has(account));
            acceptedBytes = encodeHomepageSnapshot({ ...restored.state.snapshot, scope: { ...restored.state.snapshot.scope, accounts: remaining.length ? remaining : ["*"] } });
            setNotice("来源账户已不存在，已恢复其余可用账户；没有可用来源账户时显示全部账户。");
          }
        }
      }
      const next = finishHomepageRead(sessionRef.current, token, result.data, acceptedBytes);
      pending.current = null;
      if (next.ui.errors.global === null && next.data === result.data) {
        latest.current.onReadAccepted?.(result.data);
        update(next); setRestoreKey(key => key + 1);
        if (routeRef.current.page === "home") {
          setAddressRoute({ page: "home", scope: next.ui.snapshot.scope, error: null });
          address.current = serializeHomepageNavigation(next.ui.snapshot.scope, "/home");
          persist(encodeHomepageSnapshot(next.ui.snapshot)); replaceEntry();
        }
      } else update(next);
    }).catch(error => {
      const result = completeHomepageRequest(sessionRef.current.ui, { generation: token.generation, scopeKey: token.scopeKey, ok: false, error: error instanceof Error ? error.message : "read-failed" });
      if (pending.current?.token.generation === token.generation) pending.current = null;
      update({ ...sessionRef.current, ui: result.state });
    });
  }, [persist, replaceEntry, setAddressRoute, update]);
  const acceptAddress = useCallback((url: URL, restoredBytes?: string | null, read = false) => {
    const page: Page = url.pathname === "/trades" ? "trades" : "home";
    const hasQuery = url.search.length > 0;
    const parsed = hasQuery ? validate(url) : { ok: true as const, scope: DEFAULT_SCOPE };
    if (!parsed.ok) { setAddressRoute({ page, scope: DEFAULT_SCOPE, error: routeError(parsed.error) }); return; }
    if ("warning" in parsed && parsed.warning) setNotice("URL 中的市场无效，已按全部市场显示。");
    if (page === "trades") {
      setAddressRoute({ page, scope: parsed.scope, collectionOrigin: hasQuery ? "homepage" : "global", error: null });
      return;
    }
    const restored = validateSource(restoredBytes ?? source.current);
    const canRestore = restored && (!hasQuery || homepageScopeKey(restored.snapshot.scope) === homepageScopeKey(parsed.scope));
    const scope = canRestore ? restored.snapshot.scope : parsed.scope;
    setAddressRoute({ page, scope, error: null });
    if (read) beginRead({ purpose: "navigation", scope }, canRestore ? encodeHomepageSnapshot(restored.snapshot) : undefined);
    else update({ ui: canRestore ? restored : createHomepageState(scope), data: latest.current.data });
  }, [beginRead, setAddressRoute, update, validate, validateSource]);

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
    if (options.readOnInitialize && routeRef.current.page === "home" && !routeRef.current.error) {
      const restored = validateSource(bytes);
      const matching = restored && homepageScopeKey(restored.snapshot.scope) === homepageScopeKey(routeRef.current.scope);
      beginRead({ purpose: "navigation", scope: routeRef.current.scope }, matching ? encodeHomepageSnapshot(restored.snapshot) : undefined);
    }
    replaceEntry(); setInitialized(true);
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
    if (!session.ui.requests.global) return;
    const timer = window.setTimeout(() => {
      const ui = markHomepageRequestTimedOut(sessionRef.current.ui);
      if (ui !== sessionRef.current.ui) { pending.current = null; update({ ...sessionRef.current, ui }); }
    }, 15_010);
    return () => window.clearTimeout(timer);
  }, [session.ui.requests.global, update]);

  const onUi = useCallback((patch: HomepageUiPatch) => {
    const next = { ...sessionRef.current, ui: updateHomepageUi(sessionRef.current.ui, patch) };
    update(next);
    if (initializedRef.current && routeRef.current.page === "home") { persist(encodeHomepageSnapshot(next.ui.snapshot)); replaceEntry(); }
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
    acceptAddress(target, source.current, page === "home");
    return true;
  }, [acceptAddress, persist]);
  const openTrades = useCallback((identity: string | null) => navigate(homepageTradeUrl(sessionRef.current.ui.snapshot, identity ?? undefined), encodeHomepageSnapshot(sessionRef.current.ui.snapshot)), [navigate]);
  const openGlobalTrades = useCallback((commit?: () => void) => navigate("/trades", encodeHomepageSnapshot(sessionRef.current.ui.snapshot), commit), [navigate]);
  const openHome = useCallback(() => navigate("/home"), [navigate]);
  const onScope = useCallback((scope: HomepageScope) => beginRead({ purpose: "identity", scope }), [beginRead]);
  const reload = useCallback(() => beginRead(sessionRef.current.ui.errors.global ? "retry" : { purpose: "refresh" }), [beginRead]);

  useEffect(() => {
    if (!options.enabled || !initialized) return;
    const refresh = () => {
      if (routeRef.current.page === "home" && !routeRef.current.error && !pending.current && document.visibilityState !== "hidden") beginRead({ purpose: "refresh" });
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
        acceptAddress(target, source.current, target.pathname !== "/trades"); return;
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
          acceptAddress(target, bytes, target.pathname !== "/trades"); replaceEntry();
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

  return { ...session, initialized, route, notice, restoreKey, onUi, onScope, reload, openTrades, openGlobalTrades, openHome };
}
