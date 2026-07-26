"use client";

import {
  AlertTriangle,
  CalendarRange,
  Check,
  FileSpreadsheet,
  Layers3,
  ListChecks,
  X,
} from "lucide-react";

import type { ImportPreview } from "../../lib/import/import-preview";
import { useModalFocus } from "./use-modal-focus";

type Props = {
  preview: ImportPreview;
  onCancel: () => void;
  onConfirm: () => void;
  onRenameInstrument: (instrumentId: string, name: string) => void;
};

function date(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("zh-CN");
}

export function ImportConfirmDialog({
  preview,
  onCancel,
  onConfirm,
  onRenameInstrument,
}: Props) {
  const dialogRef = useModalFocus(onCancel);
  const warnings = preview.diagnostics.filter(
    (item) => item.severity !== "info",
  );
  const unresolvedNames = preview.instruments.filter(
    (item) => item.instrument.name === "名称待行情源补充",
  ).length;

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
            <span>导入股票</span>
            <strong>{preview.instrumentCount} 个标的</strong>
          </div>
          <div className={preview.excludedInstrumentCount > 0 ? "warning" : ""}>
            <AlertTriangle size={17} />
            <span>排除内容</span>
            <strong>
              {preview.excludedInstrumentCount} 个标的不导入
            </strong>
          </div>
        </div>

        <div className="import-classification">
          <div className="classification-heading">
            <strong>将进入股票复盘列表</strong>
            <span>只保留存在成交的股票</span>
          </div>
          <div className="classification-list">
            {preview.instruments.map((item) => (
              <div className="classification-row" key={item.instrument.id}>
                <span className="classification-check">
                  <Check size={13} />
                </span>
                <div>
                  {item.instrument.name === "名称待行情源补充" ? (
                    <label className="instrument-name-field">
                      <span>{item.instrument.symbol} 股票名称</span>
                      <input
                        aria-label={`${item.instrument.symbol} 股票名称`}
                        placeholder="请输入股票名称"
                        onBlur={(event) =>
                          onRenameInstrument(
                            item.instrument.id,
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  ) : (
                    <strong>
                      {item.instrument.name}（{item.instrument.symbol}）
                    </strong>
                  )}
                  <span>{item.instrument.market}</span>
                </div>
                <b>{item.tradeCount} 笔</b>
              </div>
            ))}
          </div>
        </div>

        {preview.excludedSymbols.length > 0 && (
          <div className="excluded-summary">
            不导入：{preview.excludedSymbols.join("、")}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="import-warning">
            {warnings.length} 条记录需要检查，确认后仅导入有效成交。
          </div>
        )}
        {unresolvedNames > 0 && (
          <div className="import-warning">
            请补充 {unresolvedNames} 只股票的名称后再确认导入。
          </div>
        )}

        <footer className="modal-footer">
          <p>确认后将保存到此设备，并自动为新增股票启动行情更新。</p>
          <button className="secondary-button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button"
            disabled={preview.blocked || unresolvedNames > 0}
            onClick={onConfirm}
          >
            确认导入并开始更新行情
          </button>
        </footer>
      </section>
    </div>
  );
}
