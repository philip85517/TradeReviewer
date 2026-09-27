"use client";

import { Bell, ChevronDown, Search, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import type {
  GlobalNotification,
  GlobalNotificationModel,
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

export function TradingRoomGlobalTools({
  entries,
  scope,
  marketDataStatuses,
  marketDataLabels,
  status = "ready",
  onOpenSearchResult,
  onOpenNotification,
  onOpenAccountAndCurrency,
}: TradingRoomGlobalToolsProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const latestContextRef = useRef({ entries, scope, status, marketDataStatuses, marketDataLabels });
  const notifications = useMemo<GlobalNotificationModel>(() => buildGlobalNotifications(entries, scope, {
    marketDataStatuses,
    marketDataLabels,
  }), [entries, marketDataLabels, marketDataStatuses, scope]);
  const results = useMemo<GlobalSearchResult[]>(() => searchGlobalInstruments(entries, scope, query), [entries, query, scope]);

  useEffect(() => {
    latestContextRef.current = { entries, scope, status, marketDataStatuses, marketDataLabels };
  }, [entries, marketDataLabels, marketDataStatuses, scope, status]);

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      const closesSearch = searchOpen && !searchRef.current?.contains(target);
      const closesNotifications = notificationsOpen && !notificationsRef.current?.contains(target);
      const closesUserMenu = userMenuOpen && !userMenuRef.current?.contains(target);
      if (!searchRef.current?.contains(target)) setSearchOpen(false);
      if (!notificationsRef.current?.contains(target)) setNotificationsOpen(false);
      if (!userMenuRef.current?.contains(target)) setUserMenuOpen(false);
      if (closesSearch) {
        searchInputRef.current?.focus();
        setSearchOpen(false);
      } else if (closesNotifications) {
        notificationsTriggerRef.current?.focus();
      } else if (closesUserMenu) {
        userMenuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [notificationsOpen, searchOpen, userMenuOpen]);

  useEffect(() => {
    if (!searchOpen && !notificationsOpen && !userMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (searchOpen) {
        setQuery("");
        setActionNotice(null);
        searchInputRef.current?.focus();
        setSearchOpen(false);
      } else if (notificationsOpen) {
        setNotificationsOpen(false);
        setActionNotice(null);
        notificationsTriggerRef.current?.focus();
      } else {
        setUserMenuOpen(false);
        setActionNotice(null);
        userMenuTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [notificationsOpen, searchOpen, userMenuOpen]);

  const closeAll = () => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  };

  const showActionNotice = (message: string, focus?: HTMLButtonElement | HTMLInputElement | null) => {
    closeAll();
    setActionNotice(message);
    focus?.focus();
    if (focus === searchInputRef.current) setSearchOpen(false);
  };

  const selectResult = (result: GlobalSearchResult) => {
    const latest = latestContextRef.current;
    if (latest.status !== "ready" || latest.scope.nature === "unknown" || (latest.scope.nature === "simulation" && !latest.scope.simulationRunId)) {
      showActionNotice("当前交易身份尚未准备好，请稍后重试。", searchInputRef.current);
      return;
    }
    const fresh = searchGlobalInstruments(latest.entries, latest.scope, result.symbol)
      .find(candidate => candidate.instrumentId === result.instrumentId);
    if (!fresh) {
      setQuery("");
      showActionNotice("当前身份下的标的已变化，请重新搜索。", searchInputRef.current);
      return;
    }
    closeAll();
    setQuery("");
    onOpenSearchResult(fresh);
  };

  const selectNotification = (item: GlobalNotification) => {
    if (latestContextRef.current.status !== "ready") {
      showActionNotice("当前交易身份尚未准备好，请稍后重试。", notificationsTriggerRef.current);
      return;
    }
    const latest = latestContextRef.current;
    const freshNotifications = buildGlobalNotifications(latest.entries, latest.scope, {
      marketDataStatuses: latest.marketDataStatuses,
      marketDataLabels: latest.marketDataLabels,
    });
    const fresh = freshNotifications.items.find(candidate => candidate.id === item.id);
    if (!fresh) {
      showActionNotice("当前范围下的事项已变化，请重新打开待处理事项。", notificationsTriggerRef.current);
      return;
    }
    closeAll();
    onOpenNotification(fresh);
  };

  return <div className={`${styles.tools} trading-room-global-tools`} aria-label="交易室全局工具">
    <div className={styles.search} ref={searchRef}>
      <label className={styles.searchField}>
        <Search size={17} aria-hidden="true" />
        <input
          ref={searchInputRef}
          type="search"
          aria-label="搜索已导入标的"
          aria-expanded={searchOpen}
          aria-controls="trading-room-global-search-results"
          placeholder="搜索标的"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={event => {
            setActionNotice(null);
            setQuery(event.target.value);
            setSearchOpen(true);
          }}
          onKeyDown={event => {
            if (event.key === "Escape") {
              setQuery("");
              setSearchOpen(false);
              setActionNotice(null);
            }
            if (event.key === "Enter" && status === "ready" && scope.nature !== "unknown" && !(scope.nature === "simulation" && !scope.simulationRunId) && results[0]) selectResult(results[0]);
          }}
        />
        {query && <button type="button" className={styles.clearSearch} aria-label="清除搜索" onClick={() => setQuery("")}><X size={14} /></button>}
      </label>
      {searchOpen && <div id="trading-room-global-search-results" className={styles.searchPopover} role="listbox" aria-label="标的搜索结果">
        {status === "loading" ? <p className={styles.empty}>正在读取交易身份…</p>
          : status === "error" ? <p className={styles.error}>交易身份暂时无法读取，请稍后重试。</p>
            : scope.nature === "unknown" ? <p className={styles.empty}>请先核对当前交易性质。</p>
              : scope.nature === "simulation" && !scope.simulationRunId ? <p className={styles.empty}>请先选择模拟运行。</p>
                : results.length > 0 ? results.map(result => <button type="button" role="option" key={result.instrumentId} className={styles.searchResult} onKeyDown={event => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  setQuery("");
                  setActionNotice(null);
                  searchInputRef.current?.focus();
                  setSearchOpen(false);
                }} onClick={() => selectResult(result)}>
                  <span><strong>{result.name}</strong><small>{result.symbol} · {result.market}</small></span>
                  <em>{result.episodeCount} 回合</em>
                </button>)
                  : <p className={styles.empty}>{query.trim() ? "当前身份下没有找到已导入标的。" : "输入名称或代码搜索已导入标的。"}</p>}
      </div>}
    </div>
    <div className={styles.popoverAnchor} ref={notificationsRef}>
      <button ref={notificationsTriggerRef} type="button" className={styles.iconButton} aria-label="打开待处理事项" aria-expanded={notificationsOpen} onClick={() => { setActionNotice(null); setNotificationsOpen(value => !value); setSearchOpen(false); setUserMenuOpen(false); }}>
        <Bell size={18} />
        {status === "ready" && notifications.state === "ready" && notifications.items.length > 0 && <span className={styles.badge} aria-label={`${notifications.items.length} 条待处理事项`}>{notifications.items.length > 99 ? "99+" : notifications.items.length}</span>}
      </button>
      {notificationsOpen && <div className={`${styles.panel} ${styles.notificationsPanel}`} role="dialog" aria-label="待处理事项">
        <header><div><strong>待处理事项</strong><small>{status === "loading" ? "读取中" : status === "error" ? "读取失败" : notifications.state === "ready" ? `${notifications.items.length} 项` : "范围待确认"}</small></div><button type="button" className={styles.closePanel} aria-label="关闭待处理事项" onClick={() => { setNotificationsOpen(false); notificationsTriggerRef.current?.focus(); }}><X size={15} /></button></header>
        {status === "loading" ? <p className={styles.empty}>正在读取当前身份…</p>
          : status === "error" ? <p className={styles.error}>事项暂时无法读取，请稍后重试。</p>
            : notifications.state === "needs-scope" ? <p className={styles.empty}>选择账户、交易性质和模拟运行后显示对应事项。</p>
              : notifications.items.length === 0 ? <p className={styles.empty}>当前身份下没有待处理事项。</p>
                : <div className={styles.notificationList}>{notifications.items.map(item => <button type="button" key={item.id} className={styles.notification} onClick={() => selectNotification(item)}>
                  <span className={`${styles.notificationMark} ${styles[`kind-${item.kind}`]}`} aria-hidden="true">{notificationIcon(item)}</span>
                  <span><strong>{notificationLabel(item)} · {item.label}</strong><small>{item.description}</small></span>
                  <ChevronDown size={15} className={styles.notificationArrow} aria-hidden="true" />
                </button>)}</div>}
      </div>}
    </div>
    <div className={styles.popoverAnchor} ref={userMenuRef}>
      <button ref={userMenuTriggerRef} type="button" className={`${styles.userButton} ${userMenuOpen ? styles.active : ""}`} aria-label="打开本地用户菜单" aria-expanded={userMenuOpen} onClick={() => { setActionNotice(null); setUserMenuOpen(value => !value); setSearchOpen(false); setNotificationsOpen(false); }}>
        <span className={styles.avatar}>T</span><span className={styles.userLabel}>本地用户</span><ChevronDown size={14} aria-hidden="true" />
      </button>
      {userMenuOpen && <div className={`${styles.panel} ${styles.userPanel}`} role="menu" aria-label="本地用户菜单">
        <div className={styles.userSummary}><span className={styles.avatarLarge}>T</span><span><strong>本地用户</strong><small>本机交易空间</small></span></div>
        <button type="button" role="menuitem" onClick={() => { closeAll(); onOpenAccountAndCurrency(); }}><Settings2 size={16} />账户与计价</button>
      </div>}
    </div>
    {actionNotice && <p role="status" className={styles.actionNotice} aria-live="polite">{actionNotice}</p>}
  </div>;
}
