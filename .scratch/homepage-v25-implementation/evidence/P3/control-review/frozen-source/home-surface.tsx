"use client";

import Decimal from "decimal.js";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Eye, Search, SlidersHorizontal, X } from "lucide-react";
import { type HomepageScope, type HomepageState, type HomepageUiPatch } from "../../lib/reviews/homepage-v25-state";
import { filterHomepageHoldings, holdingsCsv, type buildHomepageHoldings, type HomepageHolding } from "./holdings-model";
import { searchHomepageCatalog, type HomepageCatalog, type HomepageCatalogItem } from "./catalog-model";
import "./home-surface.css";

type Props = {
  ui: HomepageState;
  holdings: ReturnType<typeof buildHomepageHoldings>;
  ready: boolean;
  active?: boolean;
  catalog?: HomepageCatalog;
  restoreKey?: number;
  error?: string | null;
  accountStatus: "loading" | "ready" | "error";
  accounts: readonly { id: string; label: string }[];
  onUi: (patch: HomepageUiPatch) => void;
  onScope: (scope: HomepageScope) => void;
  onTrades: (row: HomepageHolding | null) => void;
  onSymbolTrades?: (identity: string) => Promise<boolean>;
  onReload: () => void;
  onRepair: () => void;
  onImport: () => void;
};

export function holdingTriggerId(id: string) { return `hp-holding-${encodeURIComponent(id)}`; }
export function searchResultTriggerId(key: string) { return `hp-symbol-${encodeURIComponent(key)}`; }
function number(value: string | null, kind: "amount" | "price" | "quantity" = "amount", signed = false) {
  if (value === null) return "—";
  const decimal = new Decimal(value);
  const unit = kind === "amount" && decimal.abs().gte(100_000_000) ? "亿" : kind === "amount" && decimal.abs().gte(10_000) ? "万" : "";
  const shown = unit === "亿" ? decimal.div(100_000_000) : unit === "万" ? decimal.div(10_000) : decimal;
  const raw = kind === "quantity" ? shown.toFixed() : shown.toFixed(2);
  const [integer, fraction] = raw.split(".");
  return `${signed && decimal.gt(0) ? "+" : ""}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction === undefined ? "" : `.${fraction}`}${unit}`;
}
function signClass(value: string | null) { return value === null ? "hp-weak" : new Decimal(value).gt(0) ? "hp-positive" : new Decimal(value).lt(0) ? "hp-negative" : ""; }
function Value({ value, kind, signed, reason, unknown = "—", label = "数值" }: { value: string | null; kind?: "amount" | "price" | "quantity"; signed?: boolean; reason?: string | null; unknown?: string; label?: string }) {
  const id = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const explanation = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"closed" | "preview" | "pinned">("closed");
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const fullValue = value === null ? `${unknown} · ${reason ?? "数据尚不可用"}` : `${signed && new Decimal(value).gt(0) ? "+" : ""}${value}`;
  const show = (next: "preview" | "pinned") => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 276)), top: rect.bottom + 8 > window.innerHeight - 96 ? Math.max(12, rect.top - 88) : rect.bottom + 8 });
    setMode(current => current === "pinned" && next === "preview" ? current : next);
  };
  useEffect(() => {
    if (mode === "closed") return;
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !explanation.current?.contains(event.target as Node)) setMode("closed"); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [mode]);
  return <><span ref={trigger} tabIndex={0} role="button" aria-label={`${label}完整值`} aria-expanded={mode !== "closed"} aria-describedby={mode !== "closed" ? id : undefined} className={`hp-value ${signed ? signClass(value) : value === null ? "hp-weak" : ""}`} onFocus={() => show("preview")} onBlur={() => setMode("closed")} onMouseEnter={() => show("preview")} onMouseLeave={() => { if (mode !== "pinned" && document.activeElement !== trigger.current) setMode("closed"); }} onClick={() => mode === "pinned" ? setMode("closed") : show("pinned")} onKeyDown={event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); show("pinned"); }
    if (event.key === "Escape" && mode !== "closed") { event.preventDefault(); event.stopPropagation(); setMode("closed"); }
  }}>{value === null ? unknown : number(value, kind, signed)}</span>{mode !== "closed" && createPortal(<div ref={explanation} className="hp-value-explanation" id={id} role="tooltip" style={position}><strong>{label}</strong><span>{fullValue}</span></div>, document.body)}</>;
}

export function HomeSurface({ ui, holdings, ready, active = true, catalog = { items: [], identities: {} }, restoreKey = 0, error, accountStatus, accounts, onUi, onScope, onTrades, onSymbolTrades, onReload, onRepair, onImport }: Props) {
  const { snapshot } = ui;
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(Boolean(snapshot.holdings.query));
  const [inputDraft, setInputDraft] = useState({ source: snapshot.holdings.query, value: snapshot.holdings.query });
  const input = inputDraft.source === snapshot.holdings.query ? inputDraft.value : snapshot.holdings.query;
  if (inputDraft.source !== snapshot.holdings.query) setInputDraft({ source: snapshot.holdings.query, value: snapshot.holdings.query });
  const setInput = (value: string) => setInputDraft({ source: snapshot.holdings.query, value });
  const [composing, setComposing] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOrigin, setDetailOrigin] = useState<"holdings" | "search">("holdings");
  const [catalogInput, setCatalogInput] = useState({ source: snapshot.search.query, value: snapshot.search.query });
  if (catalogInput.source !== snapshot.search.query) setCatalogInput({ source: snapshot.search.query, value: snapshot.search.query });
  const catalogQuery = catalogInput.source === snapshot.search.query ? catalogInput.value : snapshot.search.query;
  const [catalogComposing, setCatalogComposing] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const catalogSearchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const restoreSearchFocus = useRef(false);
  const returnFocusRef = useRef<string | null>(null);
  const restoreDetailFocus = useRef(false);
  const lastRestore = useRef<number | null>(null);
  const rows = filterHomepageHoldings(holdings.rows, snapshot.holdings.query, snapshot.holdings.sort);
  const pages = Math.max(1, Math.ceil(rows.length / 8));
  const page = Math.min(snapshot.holdings.page, pages);
  const visibleRows = rows.slice((page - 1) * 8, page * 8);
  const catalogResults = searchHomepageCatalog(catalog, snapshot.search.query);
  const selectedItem = detailOrigin === "search" ? catalog.items.find(item => item.key === detailId) : undefined;
  const matchingHoldings = selectedItem ? holdings.rows.filter(row => selectedItem.instrumentIds.includes(row.instrumentId)) : [];
  const detailHolding = detailOrigin === "holdings" ? holdings.rows.find(row => row.id === detailId) : matchingHoldings.length === 1 ? matchingHoldings[0] : undefined;
  const noHoldingReason = matchingHoldings.length > 1 ? "该标的包含多个账户或回合，请从持仓行查看账户明细" : "当前范围暂无该标的持仓";
  const detail = detailOrigin === "holdings" ? detailHolding ?? null : selectedItem ? detailHolding ? {
    ...detailHolding, identity: selectedItem.identity, identityReason: selectedItem.reason, assetType: selectedItem.assetType,
  } : {
    instrumentName: selectedItem.name, symbol: selectedItem.symbol, marketLabel: selectedItem.market,
    identity: selectedItem.identity, identityReason: selectedItem.reason, assetType: selectedItem.assetType,
    settlementCurrency: selectedItem.currency, reportCurrency: holdings.reportCurrency,
    quantity: null, averageCost: null, marketValue: null, reportPnl: null, quote: null, quoteStatus: "missing",
    accountLabel: matchingHoldings.length ? [...new Set(matchingHoldings.map(row => row.accountLabel))].join("、") : "当前范围无持仓账户",
    days: null, daysReason: noHoldingReason, statusReason: noHoldingReason, conversionReason: null,
    financialEvidence: "来自已导入交易与已存证券资料的可知目录；未知持仓数据不按零计算。",
  } : null;
  const pending = ui.requests.global !== null;
  const selectedAccounts = snapshot.scope.accounts;
  const accountLabel = selectedAccounts.includes("*") ? "全部账户" : selectedAccounts.length === 1 ? accounts.find(account => account.id === selectedAccounts[0])?.label ?? "账户已不可用" : `${selectedAccounts.length} 个账户`;
  const overlayActive = active && (snapshot.search.open || Boolean(detail));

  useEffect(() => {
    if (catalogComposing || catalogQuery === snapshot.search.query) return;
    const timer = window.setTimeout(() => onUi({ search: { ...snapshot.search, query: catalogQuery, resultsScrollTop: 0, selectedSymbol: null } }), 300);
    return () => window.clearTimeout(timer);
  }, [catalogComposing, catalogQuery, snapshot.search, onUi]);
  useLayoutEffect(() => {
    if (active && snapshot.search.open && !detailId) catalogSearchRef.current?.focus();
  }, [active, snapshot.search.open]);
  useLayoutEffect(() => {
    if (!snapshot.search.open && restoreSearchFocus.current) {
      restoreSearchFocus.current = false;
      document.getElementById(snapshot.search.triggerFocusId ?? "hp-symbol-search")?.focus({ preventScroll: true });
    }
  }, [snapshot.search.open, snapshot.search.triggerFocusId]);

  useEffect(() => {
    if (composing || input === snapshot.holdings.query) return;
    const timer = window.setTimeout(() => onUi({ holdings: { ...snapshot.holdings, query: input, page: 1 } }), 300);
    return () => window.clearTimeout(timer);
  }, [composing, input, onUi, snapshot.holdings]);
  useEffect(() => { if (ready && !pending && snapshot.holdings.page !== page) onUi({ holdings: { ...snapshot.holdings, page } }); }, [ready, pending, page, snapshot.holdings, onUi]);
  useEffect(() => {
    if (!active || !ready || pending || lastRestore.current === restoreKey || !scrollRef.current) return;
    lastRestore.current = restoreKey;
    scrollRef.current.scrollTop = snapshot.scrollTop;
    const trigger = snapshot.returnState.triggerFocusId;
    if (resultsRef.current) resultsRef.current.scrollTop = snapshot.search.resultsScrollTop;
    const fallback = snapshot.returnState.container === "search" ? "hp-search-results-title" : "hp-holdings-title";
    if (trigger) (document.getElementById(trigger) ?? document.getElementById(fallback))?.focus({ preventScroll: true });
  }, [active, ready, pending, restoreKey, snapshot]);
  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: PointerEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    document.addEventListener("pointerdown", outside);
    accountRef.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [accountOpen]);
  if (detailId && !detail) {
    setDetailId(null);
    setDetailNotice(detailOrigin === "search" ? "该标的已不在最新目录，已返回搜索结果标题；原查询仍保留。" : "该持仓已变化，已返回当前持仓标题；原查询与排序仍保留。");
  }
  useEffect(() => {
    if (detailNotice) document.getElementById(detailOrigin === "search" ? "hp-search-results-title" : "hp-holdings-title")?.focus({ preventScroll: true });
  }, [detailNotice, detailOrigin]);
  useEffect(() => { if (detailId) detailRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [detailId]);
  useLayoutEffect(() => {
    if (!overlayActive) return;
    const navigation = surfaceRef.current?.closest(".homepage-v25-app")?.querySelector<HTMLElement>(":scope > .app-sidebar");
    if (!navigation) return;
    const wasInert = navigation.hasAttribute("inert");
    navigation.setAttribute("inert", "");
    return () => { if (!wasInert) navigation.removeAttribute("inert"); };
  }, [overlayActive]);
  useLayoutEffect(() => {
    if (detailId || !restoreDetailFocus.current) return;
    restoreDetailFocus.current = false;
    const trigger = returnFocusRef.current;
    (trigger ? document.getElementById(trigger) : null)?.focus({ preventScroll: true });
    if (!trigger || !document.getElementById(trigger)) document.getElementById(detailOrigin === "search" ? "hp-search-results-title" : "hp-holdings-title")?.focus({ preventScroll: true });
  }, [detailId, detailOrigin]);

  const closeDetail = () => {
    restoreDetailFocus.current = true;
    setDetailId(null);
  };
  const openDetail = (row: HomepageHolding) => {
    const triggerFocusId = holdingTriggerId(row.id);
    returnFocusRef.current = triggerFocusId;
    onUi({ scrollTop: scrollRef.current?.scrollTop ?? 0, focus: "holdings", returnState: { source: "detail", container: "holdings", detailId: row.id, triggerFocusId, missingContainerTitle: "当前持仓（最新）" } });
    setDetailNotice(null); setDetailId(row.id);
    setDetailOrigin("holdings");
  };
  const closeSearch = () => {
    restoreSearchFocus.current = true;
    onUi({ search: { ...snapshot.search, open: false, resultsScrollTop: resultsRef.current?.scrollTop ?? snapshot.search.resultsScrollTop } });
  };
  const openSearchDetail = (item: HomepageCatalogItem) => {
    const triggerFocusId = searchResultTriggerId(item.key);
    returnFocusRef.current = triggerFocusId;
    onUi({ search: { ...snapshot.search, selectedSymbol: item.identity, resultsScrollTop: resultsRef.current?.scrollTop ?? 0 }, focus: "search", returnState: { source: "detail", container: "search", detailId: item.key, triggerFocusId, missingContainerTitle: "搜索结果" } });
    setDetailNotice(null); setDetailOrigin("search"); setDetailId(item.key);
  };
  const forwardDetail = async () => {
    if (!detail?.identity || navigating) return;
    if (detailOrigin === "search" && onSymbolTrades) {
      setNavigating(true);
      try { if (await onSymbolTrades(detail.identity)) setDetailId(null); }
      finally { setNavigating(false); }
    } else if (detailHolding) { setDetailId(null); onTrades(detailHolding); }
  };
  const toggleSort = (field: "name" | "market-value" | "pnl") => {
    const sort = snapshot.holdings.sort === `${field}-asc` || (field === "name" && snapshot.holdings.sort === "name") ? `${field}-desc` : `${field}-asc`;
    onUi({ holdings: { ...snapshot.holdings, sort, page: 1 } });
  };
  const exportCsv = () => {
    const blob = new Blob(["\uFEFF", holdingsCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `当前持仓-${holdings.asOf.slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const accountKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); setAccountOpen(false); accountRef.current?.querySelector<HTMLButtonElement>(".hp-account-trigger")?.focus(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault(); const options = Array.from(accountRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
      const current = options.findIndex(option => option === document.activeElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[index]?.focus();
    }
  };
  const selectAccount = (id: string, option: HTMLButtonElement) => {
    const trigger = option.closest(".hp-account")?.querySelector<HTMLButtonElement>(".hp-account-trigger");
    setAccountOpen(false); onScope({ ...snapshot.scope, accounts: [id] });
    trigger?.focus();
  };

  return <section ref={surfaceRef} className="hp-home-surface">
    <div className="hp-home-background" inert={overlayActive}>
      <header className="hp-page-header">
        <h1>首页</h1>
        <div className="hp-market-tabs" role="group" aria-label="市场">
          {([['all', '全部'], ['a', 'A股'], ['hk', '港股'], ['us', '美股']] as const).map(([market, label]) => <button type="button" key={market} aria-pressed={snapshot.scope.market === market} onClick={() => onScope({ ...snapshot.scope, market })}>{label}</button>)}
        </div>
        <div className="hp-account" ref={accountRef} onKeyDown={accountKeyDown}>
          <button className="hp-account-trigger" type="button" title={accountLabel} aria-haspopup="listbox" aria-expanded={accountOpen} disabled={accountStatus === "loading"} onClick={() => setAccountOpen(value => !value)}><span>{accountStatus === "loading" ? "账户读取中…" : accountLabel}</span><ChevronDown size={16} /></button>
          {accountOpen && <div className="hp-account-options" role={accountStatus === "ready" && accounts.length > 0 ? "listbox" : undefined} aria-label="账户">
            {accountStatus === "error" ? <div role="alert">账户读取失败<button type="button" onClick={onReload}>重试</button></div> : accounts.length === 0 ? <div className="hp-account-empty"><p>暂无实盘账户</p><button type="button" onClick={() => { setAccountOpen(false); onImport(); }}>导入账户</button></div> : [{ id: "*", label: "全部账户" }, ...accounts].map(account => <button type="button" role="option" aria-selected={selectedAccounts.includes(account.id)} title={account.label} key={account.id} onClick={event => selectAccount(account.id, event.currentTarget)}><span>{account.label}</span><span aria-hidden="true">{selectedAccounts.includes(account.id) ? "✓" : ""}</span></button>)}
          </div>}
        </div>
        <button id="hp-symbol-search" className="hp-icon-button" type="button" aria-label="搜索标的" aria-haspopup="dialog" aria-expanded={snapshot.search.open} onClick={() => { setAccountOpen(false); onUi({ search: { ...snapshot.search, open: true, triggerFocusId: "hp-symbol-search" } }); }}><Search size={18} /></button>
        <button className="hp-icon-button" type="button" disabled title="附加筛选将在后续阶段接入" aria-label="附加筛选，尚未接入"><SlidersHorizontal size={18} /></button>
        <span className="hp-updated">{pending ? "正在读取新范围…" : `截至 ${holdings.asOf}`}</span>
      </header>
      <div className="hp-home-scroll" ref={scrollRef} onScroll={event => onUi({ scrollTop: event.currentTarget.scrollTop })}>
        <div className="hp-home-content">
          {(error || ui.errors.global) && <div className="hp-inline-error" role="alert">{error ?? (ui.timeouts.global ? "读取已超时，新范围未应用。" : "新范围读取失败，仍显示原范围。") }<button type="button" disabled={pending} onClick={onReload}>重试</button></div>}
          <section className="hp-current-reservation" aria-label="当前表现，尚未接入">
            <h2>当前表现</h2><p className="hp-deferred">期间表现尚未接入</p>
            <div className="hp-current-reserved-chart"><span>当前期间统计与曲线将在后续阶段接入</span></div>
          </section>
          <section className="hp-holdings" aria-labelledby="hp-holdings-title" aria-busy={!ready || pending}>
            <div className="hp-holdings-toolbar">
              <h2 id="hp-holdings-title" tabIndex={-1}>当前持仓（最新）</h2>
              <div className="hp-holdings-summary"><div><span>持仓市值({holdings.reportCurrency})</span><Value value={ready ? holdings.totalMarketValue : null} /></div><div><span>持仓浮动盈亏({holdings.reportCurrency})</span><Value value={ready ? holdings.totalUnrealizedPnl : null} signed /></div></div>
              <div className="hp-holdings-tools">
                {searchOpen || Boolean(input) ? <div className="hp-inline-search"><Search size={16} /><input ref={searchRef} type="search" aria-label="搜索持仓" placeholder="搜索持仓" value={input} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onChange={event => setInput(event.target.value)} /><button type="button" aria-label="清除持仓搜索" onClick={() => { setInput(""); onUi({ holdings: { ...snapshot.holdings, query: "", page: 1 } }); searchRef.current?.focus(); }}><X size={16} /></button></div> : <button type="button" onClick={() => { setSearchOpen(true); window.requestAnimationFrame(() => searchRef.current?.focus()); }}><Search size={16} /><span>搜索持仓</span></button>}
                <button type="button" aria-label="导出持仓 CSV" disabled={!ready || rows.length === 0} title={rows.length ? `导出全部筛选结果（${rows.length}）` : "无可导出的持仓（0）"} onClick={exportCsv}><Download size={16} /><span>导出</span></button>
              </div>
            </div>
            <div className="hp-holdings-table" role="table" aria-label="当前持仓">
              <div className="hp-holding-grid hp-holding-head" role="row">
                <div role="columnheader" aria-sort={snapshot.holdings.sort === "name-desc" ? "descending" : "ascending"}><button type="button" onClick={() => toggleSort("name")} aria-label="按标的名称排序">标的 <span aria-hidden="true">{snapshot.holdings.sort === "name-desc" ? "↓" : "↑"}</span></button></div>
                <div role="columnheader">持仓天数</div><div role="columnheader">数量</div><div role="columnheader">成本价</div><div role="columnheader">最新价</div>
                <div role="columnheader"><button type="button" disabled={!holdings.canSortMoney} title={!holdings.canSortMoney ? "行情、成本或汇率覆盖不足，暂不能按金额排序" : "按持仓市值排序"} onClick={() => toggleSort("market-value")} aria-label="按持仓市值排序">持仓市值({holdings.reportCurrency})<span aria-hidden="true">{snapshot.holdings.sort.startsWith("market-value") ? snapshot.holdings.sort.endsWith("desc") ? "↓" : "↑" : ""}</span></button></div>
                <div role="columnheader"><button type="button" disabled={!holdings.canSortMoney} title={!holdings.canSortMoney ? "行情、成本或汇率覆盖不足，暂不能按金额排序" : "按持仓浮动盈亏排序"} onClick={() => toggleSort("pnl")} aria-label="按持仓浮动盈亏排序">持仓浮动盈亏({holdings.reportCurrency})<span aria-hidden="true">{snapshot.holdings.sort.startsWith("pnl") ? snapshot.holdings.sort.endsWith("desc") ? "↓" : "↑" : ""}</span></button></div><div role="columnheader">查看</div>
              </div>
              <div className="hp-holdings-body">
                {Array.from({ length: 8 }, (_, index) => {
                  const row = ready ? visibleRows[index] : undefined;
                  return <div data-testid="holding-slot" className="hp-holding-grid hp-holding-row" role="row" key={row?.id ?? `empty-${index}`}>
                    {row ? <><div role="cell" className="hp-instrument" tabIndex={0} title={`${row.instrumentName} · ${row.identity ?? row.identityReason} · ${row.assetType} · ${row.accountLabel}`}><strong>{row.instrumentName}</strong><small>{row.identity ?? `${row.symbol} · 交易所待解析`}</small></div><div role="cell" title={row.daysReason ?? undefined}>{row.days === null ? "—" : `${row.days}天`}</div><div role="cell"><Value value={row.quantity} label="数量" kind="quantity" reason={row.statusReason} /></div><div role="cell"><Value value={row.averageCost} label="成本价" kind="price" unknown="暂无" reason={row.costStatus !== "available" ? "暂无可信成本" : null} /></div><div role="cell"><Value value={row.quoteStatus === "available" ? row.quote?.price ?? null : null} label="最新价" kind="price" unknown="待更新" reason={row.statusReason ?? "行情待更新"} /></div><div role="cell"><Value value={row.marketValue} label="持仓市值" reason={row.conversionReason ?? row.statusReason} /></div><div role="cell"><Value value={row.reportPnl} label="持仓浮动盈亏" signed reason={row.conversionReason ?? row.statusReason} /></div><div role="cell"><button type="button" className="hp-icon-button hp-view-holding" id={holdingTriggerId(row.id)} aria-label="查看持仓详情" title="查看持仓详情" onClick={() => openDetail(row)}><Eye size={16} /></button></div></> : <div className="hp-empty-slot" role="cell" aria-hidden="true">&nbsp;</div>}
                  </div>;
                })}
                {(!ready || rows.length === 0) && <div className="hp-holdings-empty" role="status"><strong>{!ready ? "正在读取真实持仓…" : snapshot.holdings.query.trim() ? "没有匹配的持仓" : "当前范围暂无持仓"}</strong><p>{!ready ? "保留表格位置，读取完成后显示" : snapshot.holdings.query.trim() ? "可清除持仓搜索，保留当前市场与账户范围" : "仅显示来源明确的实盘未平仓回合"}</p>{ready && !snapshot.holdings.query.trim() && (snapshot.scope.market !== "all" ? <button type="button" disabled={pending} onClick={() => onScope({ ...snapshot.scope, market: "all" })}>查看全部市场</button> : <button type="button" onClick={onImport}>导入交易</button>)}</div>}
              </div>
            </div>
            <div className="hp-holdings-pagination"><span>共 {rows.length} 条持仓 · {new Set(rows.map(row => row.instrumentId)).size} 个标的</span><div>{rows.length > 0 && <><button type="button" className="hp-icon-button" aria-label="上一页持仓" disabled={page === 1} onClick={() => onUi({ holdings: { ...snapshot.holdings, page: page - 1 } })}><ChevronLeft size={16} /></button><span>{page} / {pages}</span><button type="button" className="hp-icon-button" aria-label="下一页持仓" disabled={page === pages} onClick={() => onUi({ holdings: { ...snapshot.holdings, page: page + 1 } })}><ChevronRight size={16} /></button></>}</div></div>
          </section>
          {detailNotice && <p role="status">{detailNotice}</p>}
          <section className="hp-history-reservation" aria-label="历史已平仓，尚未接入"><h2>历史已平仓</h2><p className="hp-deferred">历史统计与贡献将在后续阶段接入</p></section>
          <div className="hp-library-entry"><span>按当前市场、账户与期间查看成交，包含未平仓成交</span><button id="hp-open-trades" type="button" disabled={!ready || pending} onClick={() => { onUi({ scrollTop: scrollRef.current?.scrollTop ?? 0, focus: "holdings", returnState: { source: "trades", container: "holdings", detailId: null, triggerFocusId: "hp-open-trades", missingContainerTitle: "当前持仓（最新）" } }); onTrades(null); }}>进入交易库</button></div>
        </div>
      </div>
    </div>
    {active && snapshot.search.open && <div className="hp-search-backdrop" data-testid="symbol-search-backdrop" onClick={event => { if (event.target === event.currentTarget && !detail) closeSearch(); }}><div ref={catalogRef} className="hp-search-stage" role="dialog" aria-modal={!detail} aria-label="标的搜索" inert={Boolean(detail)} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeSearch(); }
      if (event.key === "Tab") {
        const items = Array.from(catalogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]') ?? []);
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
        if (event.target instanceof HTMLInputElement && !["ArrowDown", "ArrowUp"].includes(event.key)) return;
        const options = Array.from(resultsRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        if (!options.length) return;
        event.preventDefault(); const current = options.findIndex(option => option === document.activeElement);
        const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
        options[index]?.focus();
      }
    }}><header><h2 id="hp-search-results-title" tabIndex={-1}>找到标的</h2><button type="button" aria-label="关闭标的搜索" onClick={closeSearch}>关闭</button></header>
      <div className="hp-catalog-input"><input ref={catalogSearchRef} type="search" aria-label="搜索标的" placeholder="输入名称或代码" value={catalogQuery} onChange={event => setCatalogInput({ source: snapshot.search.query, value: event.target.value })} onCompositionStart={() => setCatalogComposing(true)} onCompositionEnd={() => setCatalogComposing(false)} onKeyDown={event => { if (event.key === "Enter" && !catalogComposing && catalogQuery === snapshot.search.query && catalogResults[0]) { event.preventDefault(); openSearchDetail(catalogResults[0]); } }} /><button type="button" aria-label="清除标的搜索" disabled={!catalogQuery} onClick={() => { setCatalogInput({ source: "", value: "" }); onUi({ search: { ...snapshot.search, query: "", selectedSymbol: null, resultsScrollTop: 0 } }); catalogSearchRef.current?.focus(); }}><X size={18} /></button></div>
      <div ref={resultsRef} className="hp-catalog-results" role="region" aria-labelledby="hp-search-results-title" aria-busy={!ready || pending} onScroll={event => onUi({ search: { ...snapshot.search, resultsScrollTop: event.currentTarget.scrollTop } })}>
        {!ready || pending ? <p role="status">正在读取已知证券目录…</p> : ui.errors.global || accountStatus === "error" ? <div role="alert"><p>证券目录读取失败，原查询仍保留。</p><button type="button" onClick={onReload}>重试</button></div> : !snapshot.search.query.trim() ? <p className="hp-catalog-message">输入名称或代码查找标的</p> : catalogResults.length === 0 ? <p className="hp-catalog-message">{catalog.items.length === 0 ? "尚无可知证券，请先导入交易或证券资料。" : "没有匹配的标的"}</p> : catalogResults.map(item => <button id={searchResultTriggerId(item.key)} className="hp-catalog-result" type="button" key={item.key} aria-current={snapshot.search.selectedSymbol === item.identity && item.identity !== null ? "true" : undefined} onClick={() => openSearchDetail(item)}><strong>{item.name}</strong><span>{item.exchange ?? "交易所待解析"}:{item.symbol} · {item.currency || "币种未知"} · {item.assetType === "stock" ? "股票" : item.assetType === "etf" ? "ETF" : "类别未知"}</span>{item.reason && <small>{item.reason}</small>}</button>)}
        {detailNotice && detailOrigin === "search" && <p role="status">{detailNotice}</p>}
      </div><footer><p>目录来自已导入交易与已存证券资料，未覆盖全市场。</p><p>输入框内 × 清空查询 · ↑ ↓ 选择 · Enter 查看 · Esc 关闭</p></footer>
    </div></div>}
    {active && detail && <div className="hp-detail-backdrop" data-testid="holding-detail-backdrop"><div className="hp-detail-dialog" ref={detailRef} role="dialog" aria-modal="true" aria-label={`${detail.instrumentName} ${detailOrigin === "search" ? "标的详情" : "持仓详情"}`} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); closeDetail(); }
      if (event.key === "Tab") { const items = Array.from(detailRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex="0"]') ?? []); const first = items[0]; const last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    }}><header><div><h2>{detail.instrumentName}</h2><p>{detail.identity ?? `${detail.symbol} · 交易所待解析`} · {detail.marketLabel} · {detail.settlementCurrency ?? "币种未知"} · {detail.assetType === "stock" ? "股票" : detail.assetType === "etf" ? "ETF" : "类别未知"}</p></div><button className="hp-icon-button" type="button" aria-label={detailOrigin === "search" ? "关闭标的详情" : "关闭持仓详情"} onClick={closeDetail}><X size={18} /></button></header><dl className="hp-detail-values" aria-label="核心持仓指标">
      <div><dt>数量</dt><dd><Value value={detail.quantity} label="数量" kind="quantity" reason={detail.statusReason} /></dd></div>
      <div><dt>成本价({detail.settlementCurrency ?? "—"})</dt><dd><Value value={detail.averageCost} label="成本价" kind="price" unknown="暂无" reason="暂无可信成本" /></dd></div>
      <div><dt>持仓市值({detail.reportCurrency})</dt><dd><Value value={detail.marketValue} label="持仓市值" reason={detail.conversionReason ?? detail.statusReason} /></dd></div>
      <div><dt>持仓浮动盈亏({detail.reportCurrency})</dt><dd><Value value={detail.reportPnl} label="持仓浮动盈亏" signed reason={detail.conversionReason ?? detail.statusReason} /></dd></div>
    </dl><dl className="hp-detail-secondary" aria-label="持仓补充信息">
      <div><dt>最新价({detail.settlementCurrency ?? "—"})</dt><dd><Value value={detail.quoteStatus === "available" ? detail.quote?.price ?? null : null} label="最新价" kind="price" unknown="待更新" reason={detail.statusReason ?? "行情待更新"} /></dd></div>
      <div><dt>账户</dt><dd>{detail.accountLabel}</dd></div>
      <div><dt>持仓天数</dt><dd title={detail.daysReason ?? undefined}>{detail.days === null ? "—" : `${detail.days}天`}</dd></div>
    </dl><p className="hp-detail-evidence">{detail.financialEvidence}</p>{(detail.statusReason || detail.conversionReason || detail.daysReason || detail.identityReason) && <div className="hp-detail-reasons">{[...new Set([detail.statusReason, detail.conversionReason, detail.daysReason, detail.identityReason].filter(Boolean))].map(reason => <p key={reason}>{reason}</p>)}<button type="button" disabled={pending} onClick={onRepair}>更新数据</button></div>}<footer>
      <button className="hp-detail-trades" type="button" disabled={!detail.identity || pending || navigating} title={detail.identityReason ?? undefined} onClick={() => { void forwardDetail(); }}>查看交易</button>
      <button className="hp-detail-return" type="button" onClick={closeDetail}>{detailOrigin === "search" ? "返回原搜索结果 · 恢复原滚动位置" : `返回原持仓行第 ${page} 页 · 恢复原滚动位置`}</button>
    </footer></div></div>}
  </section>;
}
