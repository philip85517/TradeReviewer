"use client";

import { FileSpreadsheet, X } from "lucide-react";
import { useState } from "react";

import type { TradingViewSimulationContext } from "../../lib/import/contracts";
import { useModalFocus } from "./use-modal-focus";

type Props = {
  fileName: string;
  onCancel: () => void;
  onConfirm: (context: TradingViewSimulationContext) => void;
};

export function TradingViewContextDialog({
  fileName,
  onCancel,
  onConfirm,
}: Props) {
  const dialogRef = useModalFocus(onCancel);
  const [market, setMarket] = useState<TradingViewSimulationContext["market"]>("CN-SH");
  const [symbol, setSymbol] = useState("");
  const normalizedSymbol = symbol.trim();
  const valid = /^\d{6}$/.test(normalizedSymbol);

  return (
    <div className="modal-backdrop">
      <section
        ref={dialogRef}
        className="import-dialog tradingview-context-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tradingview-context-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">TradingView · 模拟盘</span>
            <h2 id="tradingview-context-title">确认证券信息</h2>
          </div>
          <button className="icon-button" aria-label="关闭证券信息" onClick={onCancel}>
            <X size={18} />
          </button>
        </header>
        <div className="import-file-summary">
          <FileSpreadsheet size={20} />
          <div>
            <strong>{fileName}</strong>
            <span>文件名未包含交易所和证券代码</span>
          </div>
        </div>
        <div className="tradingview-context-fields">
          <label>
            <span>交易所</span>
            <select
              aria-label="交易所"
              value={market}
              onChange={(event) => setMarket(event.target.value as TradingViewSimulationContext["market"])}
            >
              <option value="CN-SH">上海（SSE）</option>
              <option value="CN-SZ">深圳（SZSE）</option>
            </select>
          </label>
          <label>
            <span>六位证券代码</span>
            <input
              aria-label="六位证券代码"
              inputMode="numeric"
              maxLength={6}
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.replace(/\D/g, ""))}
              placeholder="例如 600330"
            />
          </label>
        </div>
        <p className="tradingview-context-hint">TradingView 导出只有日期，导入后会按上海时区的日期精度回放。</p>
        <footer className="modal-actions">
          <button className="secondary-button" onClick={onCancel}>取消</button>
          <button
            className="primary-button"
            disabled={!valid}
            onClick={() => onConfirm({ market, symbol: normalizedSymbol })}
          >
            继续解析
          </button>
        </footer>
      </section>
    </div>
  );
}
