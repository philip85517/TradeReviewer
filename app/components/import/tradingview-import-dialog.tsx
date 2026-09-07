'use client';

import { useState } from 'react';
import { tradingViewInstrumentFromName, type TradingViewInstrument } from '../../lib/import/tradingview';
import type { Instrument } from '../../lib/trades/types';
import { useModalFocus } from './use-modal-focus';

type Props = { file: File; instruments: Instrument[]; onCancel: () => void; onConfirm: (instrument: TradingViewInstrument) => void };

export function TradingViewImportDialog({file,instruments,onCancel,onConfirm}: Props) {
  const [symbol,setSymbol] = useState(tradingViewInstrumentFromName(file.name)?.symbol ?? '');
  const dialogRef = useModalFocus(onCancel);
  return <div className="modal-backdrop">
    <section className="import-dialog tradingview-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label="核对模拟交易证券">
      <h2>核对模拟交易证券</h2>
      <p className="simulation-badge">TradingView · 模拟盘</p>
      <p>{file.name}</p>
      <p>CSV 没有证券列，请核对上海证券代码。名称会自动补全。</p>
      <form onSubmit={event=>{event.preventDefault();if (/^\d{6}$/.test(symbol)) onConfirm({market:'CN-SH',symbol});}}>
        <label>上海证券代码
          <input aria-label="上海证券代码" list="simulation-instruments" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} value={symbol} onChange={event=>setSymbol(event.target.value.trim())} />
        </label>
        <datalist id="simulation-instruments">{instruments.filter(i=>i.market==='CN-SH').map(i=><option key={i.id} value={i.symbol}>{i.name}</option>)}</datalist>
        <p>每份不同内容的文件作为独立模拟运行；重复导入同一文件不会增加成交。</p>
        <div className="modal-footer">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="submit" disabled={!/^\d{6}$/.test(symbol)}>解析模拟交易</button>
        </div>
      </form>
    </section>
  </div>;
}
