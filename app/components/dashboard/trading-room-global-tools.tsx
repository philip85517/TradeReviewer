"use client";

import { Bell, ChevronDown, Search, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import type {
  GlobalNotification,
  GlobalSearchResult,
} from "../../lib/reviews/trading-room-global-entries";
import {
  buildGlobalNotifications,
  searchGlobalInstruments,
  type GlobalEntryScope,
} from "../../lib/reviews/trading-room-global-entries";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import styles from "./trading-room-global-tools.module.css";

export type TradingRoomGlobalToolsProps = {
  entries: readonly TradeLibraryEntry[];
  scope: GlobalEntryScope;
  marketDataStatuses?: Readonly<Record<string, MarketDataSyncStatus | undefined>>;
  marketDataLabels?: Readonly<Record<string, string | undefined>>;
  status?: "loading" | "error" | "ready";
  onOpenSearchResult: (result: GlobalSearchResult) => void;
  onOpenNotification: (item: GlobalNotification) => void;
  onOpenAccountAndCurrency: () => void;
};

function notificationLabel(item: GlobalNotification): string {
  if (item.kind === "data") return "数据待核对";
  if (item.kind === "market") return "行情问题";
  return "已平仓待复盘";
}

function notificationIcon(item: GlobalNotification) {
  if (item.kind === "data") return "!";
  if (item.kind === "market") return "~";
  return "↗";
}

/** Search-only slot used by the shared page header. Search keeps its own
 * query state so notification and user menus can live in the identity row. */
export function TradingRoomGlobalSearch({
  entries,
  scope,
  status = "ready",
  onOpenSearchResult,
}: Pick<TradingRoomGlobalToolsProps, "entries" | "scope" | "status" | "onOpenSearchResult">) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const suppressFocusRef = useRef(false);
  const latestContextRef = useRef({ entries, scope, status });
  const results = useMemo(() => searchGlobalInstruments(entries, scope, query), [entries, query, scope]);
  const focusInput = () => {
    suppressFocusRef.current = document.activeElement !== inputRef.current;
    inputRef.current?.focus();
  };
  useEffect(() => {
    latestContextRef.current = { entries, scope, status };
  }, [entries, scope, status]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
        focusInput();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setQuery("");
      setOpen(false);
      focusInput();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const canSearch = status === "ready" && scope.nature !== "unknown" && !(scope.nature === "simulation" && !scope.simulationRunId);
  const selectResult = (result: GlobalSearchResult) => {
    const latest = latestContextRef.current;
    const latestCanSearch = latest.status === "ready" && latest.scope.nature !== "unknown" && !(latest.scope.nature === "simulation" && !latest.scope.simulationRunId);
    if (!latestCanSearch) {
      setActionNotice("当前交易身份尚未准备好，请稍后重试。");
      focusInput();
      return;
    }
    const fresh = searchGlobalInstruments(latest.entries, latest.scope, result.symbol).find(candidate => candidate.instrumentId === result.instrumentId);
    if (!fresh) {
      setQuery("");
      setActionNotice("当前身份下的标的已变化，请重新搜索。");
      focusInput();
      return;
    }
    setQuery("");
    setOpen(false);
    setActionNotice(null);
    onOpenSearchResult(fresh);
  };
  return <div className={`${styles.search} ${styles.splitSearch}`} ref={ref}>
    <span className={styles.searchLabel}>搜索标的</span>
    <label className={styles.searchField}>
      <Search size={17} aria-hidden="true" />
      <input ref={inputRef} type="search" aria-label="搜索已导入标的" placeholder="搜索已导入标的" value={query} onFocus={() => { if (suppressFocusRef.current) { suppressFocusRef.current = false; return; } setOpen(true); }} onChange={event => { setActionNotice(null); setQuery(event.target.value); setOpen(true); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setQuery(""); setOpen(false); focusInput(); return; } if (event.key === "Enter" && canSearch && results[0]) selectResult(results[0]); }} />
      {query && <button type="button" className={styles.clearSearch} aria-label="清除搜索" onClick={() => setQuery("")}><X size={14} /></button>}
    </label>
      {open && <div className={styles.searchPopover} role="listbox" aria-label="标的搜索结果">
      {status === "loading" ? <p className={styles.empty}>正在读取交易身份…</p> : status === "error" ? <p className={styles.error}>交易身份暂时无法读取，请稍后重试。</p> : scope.nature === "unknown" ? <p className={styles.empty}>请先核对当前交易性质。</p> : scope.nature === "simulation" && !scope.simulationRunId ? <p className={styles.empty}>请先选择模拟运行。</p> : results.length ? results.map(result => <button type="button" role="option" aria-selected="false" key={result.instrumentId} className={styles.searchResult} onKeyDown={event => { if (event.key !== "Escape") return; event.preventDefault(); event.stopPropagation(); setQuery(""); setOpen(false); focusInput(); }} onClick={() => selectResult(result)}><span><strong>{result.name}</strong><small>{result.symbol} · {result.market}</small></span><em>{result.episodeCount} 回合</em></button>) : <p className={styles.empty}>{query.trim() ? "当前身份下没有找到已导入标的。" : "输入名称或代码搜索已导入标的。"}</p>}
    </div>}
    {actionNotice && <p role="status" className={styles.actionNotice} aria-live="polite">{actionNotice}</p>}
  </div>;
}

/** Notification and local-user slot used by the identity row. */
export function TradingRoomGlobalUtilities({
  entries,
  scope,
  marketDataStatuses,
  marketDataLabels,
  status = "ready",
  onOpenNotification,
  onOpenAccountAndCurrency,
  onNotificationAttempt,
}: Pick<TradingRoomGlobalToolsProps, "entries" | "scope" | "marketDataStatuses" | "marketDataLabels" | "status" | "onOpenNotification" | "onOpenAccountAndCurrency"> & { onNotificationAttempt?: () => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const latestContextRef = useRef({ entries, scope, status, marketDataStatuses, marketDataLabels });
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);
  const userTriggerRef = useRef<HTMLButtonElement>(null);
  const focusNotification = () => notificationTriggerRef.current?.focus();
  const focusUser = () => userTriggerRef.current?.focus();
  const notifications = useMemo(() => buildGlobalNotifications(entries, scope, { marketDataStatuses, marketDataLabels }), [entries, marketDataLabels, marketDataStatuses, scope]);
  useEffect(() => {
    latestContextRef.current = { entries, scope, status, marketDataStatuses, marketDataLabels };
  }, [entries, marketDataLabels, marketDataStatuses, scope, status]);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!notificationRef.current?.contains(target)) {
        if (notificationsOpen) focusNotification();
        setNotificationsOpen(false);
      }
      if (!userRef.current?.contains(target)) {
        if (userMenuOpen) focusUser();
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [notificationsOpen, userMenuOpen]);
  useEffect(() => {
    if (!notificationsOpen && !userMenuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (notificationsOpen) { setNotificationsOpen(false); focusNotification(); }
      else { setUserMenuOpen(false); focusUser(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notificationsOpen, userMenuOpen]);
  const selectNotification = (item: GlobalNotification) => {
    onNotificationAttempt?.();
    const latest = latestContextRef.current;
    if (latest.status !== "ready") { setActionNotice("当前交易身份尚未准备好，请稍后重试。"); return; }
    const fresh = buildGlobalNotifications(latest.entries, latest.scope, {
      marketDataStatuses: latest.marketDataStatuses,
      marketDataLabels: latest.marketDataLabels,
    }).items.find(candidate => candidate.id === item.id);
    if (!fresh) { setActionNotice("当前范围下的事项已变化，请重新打开待处理事项。"); return; }
    setNotificationsOpen(false);
    onOpenNotification(fresh);
  };
  return <div className={`${styles.tools} ${styles.utilities}`} aria-label="交易室全局工具">
    <div className={styles.popoverAnchor} ref={notificationRef}>
      <button ref={notificationTriggerRef} type="button" className={styles.iconButton} aria-label="打开待处理事项" aria-expanded={notificationsOpen} onClick={() => { setActionNotice(null); setNotificationsOpen(value => !value); setUserMenuOpen(false); }}><Bell size={18} />{status === "ready" && notifications.state === "ready" && notifications.items.length > 0 && <span className={styles.badge} aria-label={`${notifications.items.length} 条待处理事项`}>{notifications.items.length > 99 ? "99+" : notifications.items.length}</span>}</button>
      {notificationsOpen && <div className={`${styles.panel} ${styles.notificationsPanel}`} role="dialog" aria-label="待处理事项"><header><div><strong>待处理事项</strong><small>{status === "loading" ? "读取中" : status === "error" ? "读取失败" : notifications.state === "ready" ? `${notifications.items.length} 项` : "范围待确认"}</small></div><button type="button" className={styles.closePanel} aria-label="关闭待处理事项" onClick={() => { setNotificationsOpen(false); focusNotification(); }}><X size={15} /></button></header>{status === "loading" ? <p className={styles.empty}>正在读取当前身份…</p> : status === "error" ? <p className={styles.error}>事项暂时无法读取，请稍后重试。</p> : notifications.state === "needs-scope" ? <p className={styles.empty}>选择账户、交易性质和模拟运行后显示对应事项。</p> : notifications.items.length === 0 ? <p className={styles.empty}>当前身份下没有待处理事项。</p> : <div className={styles.notificationList}>{notifications.items.map(item => <button type="button" key={item.id} className={styles.notification} onClick={() => selectNotification(item)}><span className={`${styles.notificationMark} ${styles[`kind-${item.kind}`]}`} aria-hidden="true">{notificationIcon(item)}</span><span><strong>{notificationLabel(item)} · {item.label}</strong><small>{item.description}</small></span><ChevronDown size={15} className={styles.notificationArrow} aria-hidden="true" /></button>)}</div>}</div>}
    </div>
    <div className={styles.popoverAnchor} ref={userRef}>
      <button ref={userTriggerRef} type="button" className={`${styles.userButton} ${userMenuOpen ? styles.active : ""}`} aria-label="打开本地用户菜单" aria-expanded={userMenuOpen} onClick={() => { setActionNotice(null); setUserMenuOpen(value => !value); setNotificationsOpen(false); }}><span className={styles.avatar}>T</span><span className={styles.userLabel}>本地用户</span><ChevronDown size={14} aria-hidden="true" /></button>
      {userMenuOpen && <div className={`${styles.panel} ${styles.userPanel}`} role="menu" aria-label="本地用户菜单"><div className={styles.userSummary}><span className={styles.avatarLarge}>T</span><span><strong>本地用户</strong><small>本机交易空间</small></span></div><button type="button" role="menuitem" onClick={() => { setUserMenuOpen(false); onOpenAccountAndCurrency(); }}><Settings2 size={16} />账户与计价</button></div>}
    </div>
    {actionNotice && <p role="status" className={styles.actionNotice} aria-live="polite">{actionNotice}</p>}
  </div>;
}

/** Compatibility composition for existing callers. The production header
 * uses the two slots directly, so each concern owns one state machine. */
export function TradingRoomGlobalTools(props: TradingRoomGlobalToolsProps) {
  const [noticeResetKey, setNoticeResetKey] = useState(0);
  return <>
    <TradingRoomGlobalUtilities
      {...props}
      onNotificationAttempt={() => setNoticeResetKey(value => value + 1)}
      onOpenNotification={item => {
        props.onOpenNotification(item);
      }}
    />
    <TradingRoomGlobalSearch key={noticeResetKey} {...props} />
  </>;
}
