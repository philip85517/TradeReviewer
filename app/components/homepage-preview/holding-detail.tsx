'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { HoldingDetail, TradeCollection } from './display-contract';
import { money, tone } from './holdings';
import { useFullValueReadout } from './full-value';
export function HoldingDetailPanel({ detail, trades, onClose, onTrades, onBack, onCancel, pending, error }: { detail: HoldingDetail; trades: TradeCollection | null; onClose: () => void; onTrades: () => void; onBack: () => void; onCancel: () => void; pending: boolean; error: string | null }) {
  const ref = useRef<HTMLDivElement>(null), row = detail.holding;
  const { bind, tooltip } = useFullValueReadout();
  useEffect(() => { ref.current?.focus(); }, [trades]);
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);
  return <div className="hp-modal-backdrop"><div ref={ref} role="dialog" aria-modal="true" aria-label={`${row.name} · ${trades ? '交易集合' : '持仓详情'}`} tabIndex={-1} className="hp-holding-detail" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <button type="button" className="hp-close" aria-label="关闭持仓详情" onClick={onClose}><X size={20} /></button>
    <h2>{row.name} · {trades ? '交易集合' : '持仓详情'}</h2><p className="hp-detail-meta">{row.code} · {row.exchange} · {row.currency} · {row.accountId === 'account-1' ? '招商证券' : '海外证券'} · 股票</p>
    <div className="hp-dialog-status" aria-live="polite">{pending && <>读取交易中 <button type="button" onClick={onCancel}>取消读取</button></>}{error && <div role="alert">{error}<button type="button" onClick={onTrades} disabled={pending}>重试读取交易</button></div>}</div>
    {trades ? <><p className="hp-mock-note">模拟交易集合 · 用于核对对象与返回路径</p><table><thead><tr>{['日期','方向','数量','价格','币种'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>{trades.trades.map(trade => <tr key={trade.id}><td>{trade.date}</td><td>{trade.side}</td><td>{trade.quantity}</td><td>{trade.price ?? '暂无'}</td><td>{trade.currency}</td></tr>)}</tbody></table><button type="button" className="hp-primary hp-detail-action" onClick={onBack}>返回持仓详情</button></>
      : <><div className="hp-detail-cards">{[['数量', row.quantity], ['成本价', row.cost === null ? '暂无' : money(row.cost, false)], [`市值(${row.marketValue.currency})`, money(row.marketValue.value)], [`当前浮盈(${row.unrealized.currency})`, money(row.unrealized.value)]].map(([label, value], index) => <article key={label}><h3>{label}</h3><p className={index === 3 ? tone(row.unrealized.value) : ''} {...bind(index === 2 ? row.marketValue.value ?? '未知' : index === 3 ? row.unrealized.value ?? '未知' : index === 1 ? row.cost ?? '未知' : value)}>{value}</p></article>)}</div><p className="hp-detail-price" {...bind(row.price ?? '行情缺失')}>当前价格 {row.price === null ? '待更新' : `${money(row.price, false)} ${row.currency}`}</p><div className="hp-detail-action"><button type="button" className="hp-primary" onClick={onTrades} disabled={pending}>查看交易</button><span>返回原持仓行 · 恢复原滚动位置</span></div></>}
    {tooltip}
  </div></div>;
}
