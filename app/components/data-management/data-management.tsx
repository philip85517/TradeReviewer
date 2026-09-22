"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import {
  GlobalMarketRefresh,
  type GlobalMarketRefreshProps,
} from "../global-market-refresh";
import {
  ImportActions,
  type ImportActionsProps,
} from "../import/import-actions";

export type DataManagementProps = {
  activeTab?: "import" | "quality" | "settings";
  onTabChange?: (tab: "import" | "quality" | "settings") => void;
  importActions: Omit<ImportActionsProps, "compact">;
  marketRefresh: GlobalMarketRefreshProps;
  /** Instruments retained in storage without a matching imported execution. */
  retainedInstruments?: StoredInstrument[];
  activeInstrumentIds?: readonly string[] | ReadonlySet<string>;
  onOpenDataCheck?: (instrumentId: string) => void;
  importHistoryCount?: number;
  onOpenImportHistory?: () => void;
  importError?: string | null;
  navigationNotice?: string | null;
  onDismissNotice?: () => void;
  /** Current-scope quality details supplied by the trading-room dashboard. */
  qualitySlot?: ReactNode;
  /** Principal configuration supplied by the trading-room workspace. */
  principalSlot?: ReactNode;
  /** A real future data-management module, such as the FX updater. */
  fxSlot?: ReactNode;
};

function hasInstrument(ids: DataManagementProps["activeInstrumentIds"], id: string) {
  if (!ids) return false;
  if ("has" in ids) return ids.has(id);
  return ids.includes(id);
}

export function DataManagement({
  activeTab: controlledActiveTab,
  onTabChange,
  importActions,
  marketRefresh,
  retainedInstruments = [],
  activeInstrumentIds,
  onOpenDataCheck,
  importHistoryCount = 0,
  onOpenImportHistory,
  importError,
  navigationNotice,
  onDismissNotice,
  qualitySlot,
  principalSlot,
  fxSlot,
}: DataManagementProps) {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<
    "import" | "quality" | "settings"
  >("import");
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab;

  function changeTab(tab: "import" | "quality" | "settings") {
    if (controlledActiveTab === undefined) setUncontrolledActiveTab(tab);
    onTabChange?.(tab);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex < 0) return;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab.focus();
    changeTab(nextTab.dataset.tab as "import" | "quality" | "settings");
  }

  const retained = retainedInstruments.filter(
    (instrument) => !hasInstrument(activeInstrumentIds, instrument.id),
  );

  return (
    <section className="data-management" aria-label="数据管理">
      <header className="data-management-header">
        <div>
          <span className="eyebrow">Data management</span>
          <h1>数据管理</h1>
        </div>
        <span className="data-management-scope">
          {marketRefresh.instrumentCount} 个已导入标的
        </span>
      </header>

      {(importError || navigationNotice) && (
        <section className="data-management-notice" role="alert" aria-label="数据管理提示">
          <span>{importError ?? navigationNotice}</span>
          {onDismissNotice && (
            <button type="button" onClick={onDismissNotice}>
              关闭提示
            </button>
          )}
        </section>
      )}

      <div className="module-tabs" role="tablist" aria-label="数据管理分组" onKeyDown={handleTabKeyDown}>
        {([
          ["import", "数据接入"],
          ["quality", "数据质量"],
          ["settings", "收益配置"],
        ] as const).map(([tab, label]) => (
          <button
            type="button"
            key={tab}
            role="tab"
            id={`data-management-tab-${tab}`}
            data-tab={tab}
            aria-selected={activeTab === tab}
            aria-controls={`data-management-panel-${tab}`}
            onClick={() => changeTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="data-management-grid"
        role="tabpanel"
        id="data-management-panel-import"
        aria-labelledby="data-management-tab-import"
        aria-label="数据接入"
        hidden={activeTab !== "import"}
        style={{ display: activeTab === "import" ? "grid" : "none" }}
      >
        <section className="data-management-card" aria-label="导入交易数据">
          <div className="data-management-card-heading">
            <div>
              <span className="eyebrow">Import</span>
              <h2>导入交易数据</h2>
            </div>
            <span>确认后才会写入交易库</span>
          </div>
          <p>支持 PDF、Excel、TradingView 模拟交易和已适配的成交截图。</p>
          <ImportActions {...importActions} />
          {onOpenImportHistory && (
            <button
              type="button"
              className="data-management-history-button"
              onClick={onOpenImportHistory}
            >
              查看导入记录{importHistoryCount > 0 ? `（${importHistoryCount}）` : ""}
            </button>
          )}
        </section>

        <section className="data-management-card" aria-label="行情数据更新">
          <div className="data-management-card-heading">
            <div>
              <span className="eyebrow">Market data</span>
              <h2>行情数据更新</h2>
            </div>
            <span>按当前已导入标的更新</span>
          </div>
          <p>更新会保留本地缓存；取消、失败和未完成任务可在这里继续处理。</p>
          <GlobalMarketRefresh {...marketRefresh} />
        </section>
      </div>

      <div
        className="data-management-grid"
        role="tabpanel"
        id="data-management-panel-quality"
        aria-labelledby="data-management-tab-quality"
        aria-label="数据质量"
        hidden={activeTab !== "quality"}
        style={{ display: activeTab === "quality" ? "grid" : "none" }}
      >
        <section className="data-management-card" aria-label="数据质量明细">
          <div className="data-management-card-heading">
            <div>
              <span className="eyebrow">Quality</span>
              {!qualitySlot && <h2>数据质量明细</h2>}
            </div>
            <span>按当前交易室范围定位影响</span>
          </div>
          {qualitySlot ?? <p className="data-management-empty">暂无数据质量明细。</p>}
        </section>

        <section className="data-management-card data-management-issues" aria-label="待检查问题">
          <div className="data-management-card-heading">
            <div>
              <span className="eyebrow">Review data</span>
              <h2>待检查问题</h2>
            </div>
            <span>{retained.length} 个保留记录</span>
          </div>
          {retained.length === 0 ? (
            <p className="data-management-empty">暂无需要单独检查的保留记录。</p>
          ) : (
            <>
              <p>这些标的仍保留行情和复盘证据，但当前没有对应成交记录。</p>
              <details>
                <summary>查看已无成交股票的保留记录</summary>
                <div className="data-management-retained-list">
                  {retained.map((instrument) => (
                    <button
                      type="button"
                      key={instrument.id}
                      onClick={() => onOpenDataCheck?.(instrument.id)}
                    >
                      {instrument.name}（{instrument.symbol}）数据记录
                    </button>
                  ))}
                </div>
              </details>
            </>
          )}
        </section>
      </div>

      <div
        className="data-management-grid"
        role="tabpanel"
        id="data-management-panel-settings"
        aria-labelledby="data-management-tab-settings"
        aria-label="收益配置"
        hidden={activeTab !== "settings"}
        style={{ display: activeTab === "settings" ? "grid" : "none" }}
      >
        <section className="data-management-card" aria-label="本金与参考收益率配置">
          <div className="data-management-card-heading">
            <div>
              <span className="eyebrow">Principal</span>
              <h2>本金与参考收益率配置</h2>
            </div>
            <span>用于收益参考，不代表账户净值</span>
          </div>
          {principalSlot ?? <p className="data-management-empty">暂无本金配置。</p>}
        </section>

        <section className="data-management-card" aria-label="汇率">
          <div className="data-management-card-heading">
            <div>
              <span className="eyebrow">FX</span>
              <h2>汇率</h2>
            </div>
            <span>人民币估算使用的最新汇率</span>
          </div>
          {fxSlot ?? <p className="data-management-empty">暂无汇率配置。</p>}
        </section>
      </div>
    </section>
  );
}
