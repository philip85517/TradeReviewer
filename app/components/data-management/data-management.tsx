"use client";

import type { ReactNode } from "react";

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
  /** A real future data-management module, such as the FX updater. */
  fxSlot?: ReactNode;
};

function hasInstrument(ids: DataManagementProps["activeInstrumentIds"], id: string) {
  if (!ids) return false;
  if ("has" in ids) return ids.has(id);
  return ids.includes(id);
}

export function DataManagement({
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
  fxSlot,
}: DataManagementProps) {
  const retained = retainedInstruments.filter(
    (instrument) => !hasInstrument(activeInstrumentIds, instrument.id),
  );

  return (
    <section className="data-management" aria-label="数据管理">
      <header className="data-management-header">
        <div>
          <span className="eyebrow">Data management</span>
          <h1>数据管理</h1>
          <p>导入成交记录、更新行情，并处理需要核对的数据问题。</p>
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

      <div className="data-management-grid">
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

        {qualitySlot && (
          <section className="data-management-card" aria-label="数据质量明细">
            <div className="data-management-card-heading">
              <div>
                <span className="eyebrow">Quality</span>
                <h2>数据质量明细</h2>
              </div>
              <span>按当前交易室范围定位影响</span>
            </div>
            {qualitySlot}
          </section>
        )}

        {fxSlot && (
          <section className="data-management-card" aria-label="汇率">
            <div className="data-management-card-heading">
              <div>
                <span className="eyebrow">FX</span>
                <h2>汇率</h2>
              </div>
              <span>人民币估算使用的最新汇率</span>
            </div>
            {fxSlot}
          </section>
        )}

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
    </section>
  );
}
