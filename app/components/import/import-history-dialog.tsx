"use client";

import { CalendarRange, FileClock, X } from "lucide-react";

import type { ImportHistoryEntry } from "../../lib/storage/import-history";

type Props = {
  entries: ImportHistoryEntry[];
  onClose: () => void;
};

function date(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("zh-CN");
}

export function ImportHistoryDialog({ entries, onClose }: Props) {
  return (
    <div className="modal-backdrop">
      <section
        className="history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-dialog-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">数据管理</span>
            <h2 id="history-dialog-title">导入记录</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭导入记录"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        {entries.length === 0 ? (
          <div className="history-empty">
            <FileClock size={24} />
            <strong>还没有导入记录</strong>
            <span>每次确认导入后，会在这里保留批次摘要。</span>
          </div>
        ) : (
          <div className="history-list">
            {entries.map((entry) => (
              <article key={entry.id}>
                <FileClock size={18} />
                <div>
                  <strong>{entry.fileName}</strong>
                  <span>
                    <CalendarRange size={12} />
                    {date(entry.firstTradeAt)} — {date(entry.lastTradeAt)}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>成交</dt>
                    <dd>{entry.tradeCount} 笔</dd>
                  </div>
                  <div>
                    <dt>股票</dt>
                    <dd>{entry.instrumentCount} 个</dd>
                  </div>
                  <div>
                    <dt>排除</dt>
                    <dd>{entry.excludedInstrumentCount} 个</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
