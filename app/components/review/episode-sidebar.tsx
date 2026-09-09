"use client";

import {
  Check,
  Clock3,
  Database,
  FileSpreadsheet,
  History,
  ImageUp,
  RefreshCw,
  Upload,
} from "lucide-react";

import { useMemo, useState } from "react";

import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import { formatBeijingDate } from "../../lib/replay/format-time";
import { marketDataStatusLabel } from "../../lib/market/sync-status";
import type { InstrumentTradeSummary } from "../../lib/trades/instruments";
import type { TradeExecution } from "../../lib/trades/types";

export type MarketDataRefreshState = {
  running: boolean;
  total: number;
  completed: number;
  partial: number;
  failed: number;
  current?: string;
};

export type ImportPhase =
  | "idle"
  | "detecting"
  | "parsing"
  | "classifying"
  | "resolving"
  | "ready";

type Props = {
  hideImportActions?: boolean;
  pendingReviewInstrumentIds?: string[];
  importedInstruments: InstrumentTradeSummary[];
  showDemo?: boolean;
  importing: boolean;
  importPhase?: ImportPhase;
  importError: string | null;
  onImport: (file: File) => void;
  onImportFiles?: (files: File[]) => void;
  onTradingViewImport?: (file: File) => void;
  onScreenshotImport: (files: File[]) => void;
  onOpenHistory: () => void;
  revealedDemoExecutions: TradeExecution[];
  selectedInstrumentId: string;
  onSelectInstrument: (instrumentId: string) => void;
  marketDataStatuses: Record<string, MarketDataSyncStatus>;
  marketDataLabels?: Record<string, string>;
  onUpdateMarketData: (instrumentId: string) => void;
  onUpdateAllMarketData?: () => void;
  onRetryFailedMarketData?: () => void;
  marketDataRefresh?: MarketDataRefreshState;
};

function shortDate(value: string) {
  return formatBeijingDate(value);
}

export function EpisodeSidebar({
  hideImportActions = false,
  pendingReviewInstrumentIds,
  importedInstruments,
  showDemo = true,
  importing,
  importPhase = importing ? "parsing" : "idle",
  importError,
  onImport,
  onImportFiles,
  onTradingViewImport,
  onScreenshotImport,
  onOpenHistory,
  revealedDemoExecutions,
  selectedInstrumentId,
  onSelectInstrument,
  marketDataStatuses,
  marketDataLabels,
  onUpdateMarketData,
  onUpdateAllMarketData,
  onRetryFailedMarketData,
  marketDataRefresh = {
    running: false,
    total: 0,
    completed: 0,
    partial: 0,
    failed: 0,
  },
}: Props) {
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const pendingIds = useMemo(() => new Set(pendingReviewInstrumentIds ?? importedInstruments.map((item) => item.instrument.id)), [pendingReviewInstrumentIds, importedInstruments]);
  const filteredInstruments = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return importedInstruments.filter((item) =>
      (!pendingOnly || pendingIds.has(item.instrument.id)) &&
      (!needle || `${item.instrument.name} ${item.instrument.symbol}`.toLocaleLowerCase().includes(needle))
    ).sort((a, b) => b.lastTradeAt.localeCompare(a.lastTradeAt) || a.instrument.id.localeCompare(b.instrument.id));
  }, [importedInstruments, pendingIds, pendingOnly, query]);
  const clearFilters = () => { setQuery(""); setPendingOnly(false); };
  const revealedBuys = revealedDemoExecutions.filter(
    (execution) => execution.side === "buy",
  ).length;
  const revealedSells = revealedDemoExecutions.filter(
    (execution) => execution.side === "sell",
  ).length;
  const importSteps: Array<{
    phase: Exclude<ImportPhase, "idle">;
    label: string;
  }> = [
    { phase: "detecting", label: "识别格式" },
    { phase: "parsing", label: "解析成交" },
    { phase: "classifying", label: "识别股票" },
    { phase: "resolving", label: "补全名称" },
    { phase: "ready", label: "准备行情" },
  ];
  const activeStep = importSteps.findIndex(
    (step) => step.phase === importPhase,
  );
  const activeStepLabel =
    importSteps[activeStep]?.label ?? "准备导入";

  return (
    <aside className="episode-sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">股票复盘</span>
          <h2>我的交易</h2>
        </div>
        <span className="episode-count">
          {importedInstruments.length + (showDemo ? 1 : 0)} 只股票
        </span>
      </div>

      {!hideImportActions && <div className="import-actions">
        <label
          className="import-button"
          role="button"
          tabIndex={importing ? -1 : 0}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.currentTarget.querySelector("input")?.click();
          }}
        >
          <Upload size={16} />
          {importing ? "正在解析…" : "导入交易记录"}
          <input
            aria-label="导入交易记录"
            type="file"
            accept=".xlsx,.xls,.pdf"
            multiple={Boolean(onImportFiles)}
            disabled={importing}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (onImportFiles) onImportFiles(files);
              else if (files[0]) onImport(files[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {onTradingViewImport && (
          <label
            className="import-button tradingview-import-button"
            role="button"
            tabIndex={importing ? -1 : 0}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.currentTarget.querySelector("input")?.click();
            }}
          >
            <FileSpreadsheet size={16} />
            导入 TradingView 模拟 CSV
            <input
              aria-label="导入 TradingView 模拟 CSV"
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onTradingViewImport(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        )}
        <label
          className="import-button"
          role="button"
          tabIndex={importing ? -1 : 0}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.currentTarget.querySelector("input")?.click();
          }}
        >
          <ImageUp size={16} />
          从截图恢复交易
          <input
            aria-label="从截图恢复交易"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            multiple
            disabled={importing}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) onScreenshotImport(files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      }
      {importing && (
        <ol
          className="import-progress"
          role="status"
          aria-live="polite"
          aria-label={`导入进度：${activeStepLabel}（进行中）`}
        >
          {importSteps.map((step, index) => {
            const state =
              index < activeStep
                ? "complete"
                : index === activeStep
                  ? "active"
                  : "pending";
            return (
              <li
                className={state}
                key={step.phase}
                aria-current={state === "active" ? "step" : undefined}
                aria-label={`${step.label}，${
                  state === "complete"
                    ? "已完成"
                    : state === "active"
                      ? "进行中"
                      : "待处理"
                }`}
              >
                <span className="import-progress-marker" aria-hidden="true">
                  {state === "complete" ? (
                    <Check size={9} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="import-progress-label">{step.label}</span>
                <span className="import-progress-state">
                  {state === "complete"
                    ? "已完成"
                    : state === "active"
                      ? "进行中"
                      : "待处理"}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {!hideImportActions && <p className="privacy-note">自动识别已适配格式，确认前不会写入交易库。</p>}
      {importError && (
        <p className="sidebar-import-error" role="alert">
          {importError}
        </p>
      )}

      <div className="stock-list-filters">
        <label><span className="sr-only">查找复盘股票</span><input type="search" aria-label="查找复盘股票" placeholder="搜索名称或代码" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="pending-review-filter"><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />仅看待复盘</label>
        <span className="stock-sort-hint">最近交易优先</span>
      </div>
      {importedInstruments.length > 0 && onUpdateAllMarketData && (
        <details className="bulk-market-refresh"><summary>行情维护</summary>
          <button
            type="button"
            className="bulk-market-refresh-button"
            disabled={marketDataRefresh.running}
            onClick={onUpdateAllMarketData}
          >
            <RefreshCw
              size={14}
              className={marketDataRefresh.running ? "spinning" : ""}
            />
            {marketDataRefresh.running ? "正在更新全部行情…" : "一键更新全部行情"}
          </button>
          {(marketDataRefresh.running || marketDataRefresh.completed > 0) && (
            <p className="bulk-market-refresh-status" role="status" aria-live="polite">
              {marketDataRefresh.running && marketDataRefresh.current
                ? `正在处理：${marketDataRefresh.current}`
                : `已完成 ${marketDataRefresh.completed}/${marketDataRefresh.total}`}
              {marketDataRefresh.partial > 0
                ? `，部分可用 ${marketDataRefresh.partial}`
                : ""}
              {marketDataRefresh.failed > 0
                ? `，失败 ${marketDataRefresh.failed}`
                : ""}
            </p>
          )}
          {!marketDataRefresh.running &&
            marketDataRefresh.failed > 0 &&
            onRetryFailedMarketData && (
              <button
                type="button"
                className="bulk-market-retry-button"
                onClick={onRetryFailedMarketData}
              >
                重试失败项
              </button>
            )}
        </details>
      )}
      <div className="episode-list">
        {showDemo && (!query || "小鹏汽车 XPEV".toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && !pendingOnly && (
          <button
            className={`stock-card ${selectedInstrumentId === "demo" ? "active" : ""}`}
            aria-pressed={selectedInstrumentId === "demo"}
            onClick={() => onSelectInstrument("demo")}
          >
            <div className="stock-card-title">
              <span className="market-chip">US</span>
              <div>
                <strong>小鹏汽车</strong>
                <span>XPEV</span>
              </div>
              <span className="episode-status">
                <Clock3 size={12} />
                回放中
              </span>
            </div>
            <div className="stock-card-meta">
              <span>演示交易</span>
              <b>
                {revealedBuys + revealedSells === 0
                  ? "尚未成交"
                  : `${revealedBuys} 买 / ${revealedSells} 卖`}
              </b>
            </div>
          </button>
        )}
        {!showDemo && importedInstruments.length === 0 && (
          <p className="episode-list-empty">
            暂无导入股票，请先导入交易记录。
          </p>
        )}

        {filteredInstruments.length === 0 && importedInstruments.length > 0 && <div className="stock-filter-empty"><p>没有符合条件的股票</p><button type="button" onClick={clearFilters}>清除筛选</button></div>}
        {filteredInstruments.map((item) => {
          const status =
            marketDataStatuses[item.instrument.id] ?? "needs-provider";
          return (
            <div
              className={`stock-card imported ${selectedInstrumentId === item.instrument.id ? "active" : ""}`}
              key={item.instrument.id}
            >
              <button
                className="stock-card-select"
                aria-pressed={selectedInstrumentId === item.instrument.id}
                onClick={() => onSelectInstrument(item.instrument.id)}
              >
                <div className="stock-card-title">
                  <span className="market-chip">{item.instrument.market}</span>
                  <div>
                    <strong title={item.instrument.name}>{item.instrument.name}</strong>
                    <span>{item.instrument.symbol}</span>
                  </div>
                </div>
                <div className="stock-card-meta">
                  <span>
                    最近 {shortDate(item.lastTradeAt)}
                  </span>
                  <b>{item.tradeCount} 笔成交</b>
                </div>
                <div className={`market-data-state ${status}`}>
                  <Database size={11} />
                  {marketDataLabels?.[item.instrument.id] ?? marketDataStatusLabel(status)}
                </div>
              </button>
              <button
                className="stock-refresh"
                aria-label={`更新${item.instrument.name}行情`}
                disabled={status === "syncing"}
                onClick={() => onUpdateMarketData(item.instrument.id)}
              >
                <RefreshCw
                  size={13}
                  className={status === "syncing" ? "spinning" : ""}
                />
              </button>
            </div>
          );
        })}
      </div>

      <button className="import-history-link" onClick={onOpenHistory}>
        <History size={13} />
        查看导入记录
      </button>
    </aside>
  );
}
