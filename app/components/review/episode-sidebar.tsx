"use client";

import {
  Check,
  Clock3,
  Database,
  History,
  RefreshCw,
  Upload,
} from "lucide-react";

import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import { marketDataStatusLabel } from "../../lib/market/sync-status";
import type { InstrumentTradeSummary } from "../../lib/trades/instruments";
import type { TradeExecution } from "../../lib/trades/types";

export type ImportPhase =
  | "idle"
  | "detecting"
  | "parsing"
  | "classifying"
  | "resolving"
  | "ready";

type Props = {
  importedInstruments: InstrumentTradeSummary[];
  importing: boolean;
  importPhase?: ImportPhase;
  importError: string | null;
  onImport: (file: File) => void;
  onOpenHistory: () => void;
  revealedDemoExecutions: TradeExecution[];
  selectedInstrumentId: string;
  onSelectInstrument: (instrumentId: string) => void;
  marketDataStatuses: Record<string, MarketDataSyncStatus>;
  onUpdateMarketData: (instrumentId: string) => void;
};

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

export function EpisodeSidebar({
  importedInstruments,
  importing,
  importPhase = importing ? "parsing" : "idle",
  importError,
  onImport,
  onOpenHistory,
  revealedDemoExecutions,
  selectedInstrumentId,
  onSelectInstrument,
  marketDataStatuses,
  onUpdateMarketData,
}: Props) {
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
          {importedInstruments.length + 1} 只股票
        </span>
      </div>

      <div className="import-actions">
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
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
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
      <p className="privacy-note">
        自动识别已适配格式，确认前不会写入交易库。
      </p>
      {importError && (
        <p className="sidebar-import-error" role="alert">
          {importError}
        </p>
      )}

      <div className="stock-list-heading">
        <span>有成交的股票</span>
        <b>{importedInstruments.length + 1}</b>
      </div>
      <div className="episode-list">
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

        {importedInstruments.map((item) => {
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
                    <strong>{item.instrument.name}</strong>
                    <span>{item.instrument.symbol}</span>
                  </div>
                </div>
                <div className="stock-card-meta">
                  <span>
                    {shortDate(item.firstTradeAt)}—{shortDate(item.lastTradeAt)}
                  </span>
                  <b>{item.tradeCount} 笔成交</b>
                </div>
                <div className={`market-data-state ${status}`}>
                  <Database size={11} />
                  {marketDataStatusLabel(status)}
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
