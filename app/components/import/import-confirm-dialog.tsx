"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CopyCheck,
  FileSpreadsheet,
  Layers3,
  ListChecks,
  RefreshCw,
  SearchX,
  X,
} from "lucide-react";

import type { InstrumentMetadataSource } from "../../lib/instruments/metadata-contracts";
import { canonicalInstrumentId } from "../../lib/instruments/display-name";
import type { ImportPreview } from "../../lib/import/import-preview";
import { useModalFocus } from "./use-modal-focus";

type Props = {
  preview: ImportPreview;
  onCancel: () => void;
  onConfirm: () => void;
  onRetryUnresolved: (instrumentIds: string[]) => void;
  retryingUnresolved?: boolean;
};

const SOURCE_LABELS: Record<
  Exclude<InstrumentMetadataSource, "statement">,
  string
> = {
  nasdaq: "NASDAQ",
  sec: "SEC",
  hkex: "HKEX",
  tencent: "腾讯行情",
  eastmoney: "东方财富",
  sina: "新浪行情",
};

function date(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("zh-CN");
}

function safeAttemptCode(code: string) {
  return (
    code
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 40) || "unknown"
  );
}

function safeAttemptMessage(message: string) {
  return (
    message
      .replace(/https?:\/\/\S+/gi, "外部服务")
      .replace(/[\u0000-\u001f\u007f<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "查询失败"
  );
}

function attemptSummaries(
  failure: ImportPreview["unresolved"][number],
) {
  return [
    ...new Set(
      failure.attempts.map((attempt) =>
        `${SOURCE_LABELS[attempt.source]}：${safeAttemptCode(
          attempt.code,
        )} · ${safeAttemptMessage(attempt.message)}`,
      ),
    ),
  ];
}

export function ImportConfirmDialog({
  preview,
  onCancel,
  onConfirm,
  onRetryUnresolved,
  retryingUnresolved = false,
}: Props) {
  const dialogRef = useModalFocus(onCancel);
  const unresolvedIds = preview.unresolved.map((failure) =>
    canonicalInstrumentId(failure.symbol, failure.market),
  );
  const [deselectedUnresolvedIds, setDeselectedUnresolvedIds] =
    useState<Set<string>>(
      () => new Set(),
    );
  const selectedUnresolvedIds = unresolvedIds.filter(
    (instrumentId) => !deselectedUnresolvedIds.has(instrumentId),
  );

  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className="import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">自动解析完成</span>
            <h2 id="import-dialog-title">确认导入交易记录</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭导入确认"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </header>

        <div className="import-file-summary">
          <FileSpreadsheet size={20} />
          <div>
            <strong>{preview.fileName}</strong>
            <span>已自动识别为 {preview.sourceLabel} 交易记录</span>
          </div>
        </div>

        <div className="import-stat-grid">
          <div>
            <CalendarRange size={17} />
            <span>交易区间</span>
            <strong>
              {date(preview.firstTradeAt)} — {date(preview.lastTradeAt)}
            </strong>
          </div>
          <div>
            <ListChecks size={17} />
            <span>有效成交</span>
            <strong>{preview.tradeCount} 笔成交</strong>
          </div>
          <div>
            <Layers3 size={17} />
            <span>股票 / ETF</span>
            <strong>{preview.instrumentCount} 个标的</strong>
          </div>
          <div className={preview.duplicateTradeCount > 0 ? "warning" : ""}>
            <CopyCheck size={17} />
            <span>重复成交</span>
            <strong>{preview.duplicateTradeCount} 笔已跳过</strong>
          </div>
          <div
            className={
              preview.unresolvedInstrumentCount > 0 ? "warning" : ""
            }
          >
            <SearchX size={17} />
            <span>暂未识别</span>
            <strong>
              {preview.unresolvedInstrumentCount} 个标的
            </strong>
          </div>
        </div>

        <div className="import-classification">
          <div className="classification-heading">
            <strong>将进入股票复盘列表</strong>
            <span>仅包含名称和类型均已确认的股票 / ETF</span>
          </div>
          <div className="classification-list">
            {preview.instruments.map((item) => (
              <div className="classification-row" key={item.instrument.id}>
                <span className="classification-check">
                  <Check size={13} />
                </span>
                <div>
                  <strong>
                    {item.instrument.name}（{item.instrument.symbol}）
                  </strong>
                  <span>{item.instrument.market}</span>
                </div>
                <b>{item.tradeCount} 笔</b>
              </div>
            ))}
            {preview.instruments.length === 0 && (
              <p className="classification-empty">
                当前文件没有可确认导入的股票或 ETF 成交。
              </p>
            )}
          </div>
        </div>

        {preview.exclusionGroups.length > 0 && (
          <section className="import-category-panel">
            <div className="classification-heading">
              <strong>不会导入</strong>
              <span>非股票 / ETF 或无效记录</span>
            </div>
            <div className="exclusion-groups">
              {preview.exclusionGroups.map((group) => (
                <span key={`${group.category}:${group.label}`}>
                  {group.label} {group.count} 笔
                </span>
              ))}
            </div>
          </section>
        )}

        {preview.unresolved.length > 0 && (
          <section className="unresolved-panel">
            <div className="unresolved-heading">
              <div>
                <strong>
                  {preview.unresolvedInstrumentCount} 个标的暂未导入
                </strong>
                <span>无法确认名称和证券类型，不影响其他标的导入。</span>
              </div>
              <button
                className="secondary-button retry-unresolved"
                disabled={
                  retryingUnresolved ||
                  selectedUnresolvedIds.length === 0
                }
                onClick={() =>
                  onRetryUnresolved(selectedUnresolvedIds)
                }
              >
                <RefreshCw
                  size={13}
                  className={retryingUnresolved ? "spinning" : ""}
                />
                {retryingUnresolved ? "正在查询…" : "重新查询"}
              </button>
            </div>
            <div className="unresolved-list">
              {preview.unresolved.map((failure) => {
                const instrumentId = canonicalInstrumentId(
                  failure.symbol,
                  failure.market,
                );
                const summaries = attemptSummaries(failure);
                return (
                <label
                  key={`${failure.market}:${failure.symbol}`}
                  className="unresolved-row"
                >
                  <input
                    type="checkbox"
                    aria-label={`选择重新查询 ${failure.symbol}`}
                    checked={!deselectedUnresolvedIds.has(instrumentId)}
                    onChange={(event) =>
                      setDeselectedUnresolvedIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) {
                          next.delete(instrumentId);
                        } else {
                          next.add(instrumentId);
                        }
                        return next;
                      })
                    }
                  />
                  <div className="unresolved-description">
                    <strong>
                      {failure.symbol} · {failure.market}
                    </strong>
                    <span className="attempt-summary-label">
                      失败摘要
                    </span>
                    <ul className="attempt-summary-list">
                      {summaries.length > 0 ? (
                        summaries.map((summary) => (
                          <li key={summary}>{summary}</li>
                        ))
                      ) : (
                        <li>暂无可用数据源</li>
                      )}
                    </ul>
                  </div>
                </label>
                );
              })}
            </div>
          </section>
        )}

        {preview.blocked && (
          <div className="import-warning">
            <AlertTriangle size={14} />
            没有完整的股票或 ETF 成交可以导入。
          </div>
        )}

        <footer className="modal-footer">
          <p>仅完整成交会保存到此设备，并为新增股票启动行情更新。</p>
          <button className="secondary-button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button"
            disabled={preview.blocked}
            onClick={onConfirm}
          >
            确认导入并开始更新行情
          </button>
        </footer>
      </section>
    </div>
  );
}
