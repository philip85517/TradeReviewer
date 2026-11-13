'use client';
import Decimal from 'decimal.js';
import { ArrowDownToLine, ArrowUpDown, ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import type { HomeRequest, HomeView } from './display-contract';
import { useFullValueReadout } from './full-value';
export function money(value: string | null, compact = true) {
  if (value === null) return '—';
  const amount = new Decimal(value), unit = compact && amount.abs().gte(1e8) ? '亿' : compact && amount.abs().gte(1e4) ? '万' : '';
  return `${(unit === '亿' ? amount.div(1e8) : unit === '万' ? amount.div(1e4) : amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${unit ? ` ${unit}` : ''}`;
}
export function tone(value: string | null) { return value === null || new Decimal(value).isZero() ? '' : new Decimal(value).gt(0) ? 'positive' : 'negative'; }
export function Holdings({ view, query, onQuery, onComposition, onChange, onDetail, onExport, pending }: { view: HomeView | null; query: string; onQuery: (value: string) => void; onComposition: (active: boolean) => void; onChange: (patch: Partial<HomeRequest>) => void; onDetail: (id: string, trigger: HTMLElement) => void; onExport: () => void; pending: boolean }) {
  const data = view?.holdings;
  const { bind: fullValue, tooltip } = useFullValueReadout();
  const sort = (key: HomeRequest['sort']) => onChange({ sort: key, direction: view?.request.sort === key && view.request.direction === 'desc' ? 'asc' : 'desc' });
  return <section className="hp-holdings" aria-labelledby="holdings-heading">
    <header className="hp-holdings-title"><h2 id="holdings-heading" tabIndex={-1}>当前持仓（最新）</h2><p>当前市值({view?.stamp.reportCurrency ?? 'CNY'}) <strong {...fullValue(data?.marketValue.value ?? '未知')}>{money(data?.marketValue.value ?? null)}</strong><span>当前浮盈 <strong className={tone(data?.unrealized.value ?? null)} {...fullValue(data?.unrealized.value ?? '未知')}>{money(data?.unrealized.value ?? null)}</strong></span></p>
      <label className="hp-search"><Search size={16} /><input type="search" aria-label="搜索持仓" placeholder="搜索名称 / 代码" value={query} onCompositionStart={() => onComposition(true)} onCompositionEnd={event => { onComposition(false); onQuery(event.currentTarget.value); }} onChange={event => onQuery(event.target.value)} />{query && <button type="button" aria-label="清除搜索" onClick={() => onQuery('')}><X size={14} /></button>}</label>
      <button type="button" className="hp-export" aria-label="导出 CSV" disabled={!data?.total || pending} title={!data?.total ? '无可导出的持仓（0）' : '导出完整筛选结果'} onClick={onExport}><ArrowDownToLine size={16} />导出</button>
    </header>
    <table><colgroup>{[25,8,10,11,11,15,14,6].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup><thead><tr><th>名称 / 代码</th><th>持仓天数</th><th>持有数量</th><th>成本价</th><th>最新价</th><th aria-sort={view?.request.sort === 'marketValue' ? view.request.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" disabled={!data?.sortAvailable} title={!data?.sortAvailable ? '汇率覆盖不足，暂不支持市值排序' : undefined} aria-label="按市值排序" onClick={() => sort('marketValue')}><ArrowUpDown size={12} />市值({view?.stamp.reportCurrency ?? 'CNY'})</button></th><th aria-sort={view?.request.sort === 'unrealized' ? view.request.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" disabled={!data?.sortAvailable} title={!data?.sortAvailable ? '汇率覆盖不足，暂不支持浮盈排序' : undefined} aria-label="按浮盈排序" onClick={() => sort('unrealized')}><ArrowUpDown size={12} />浮盈({view?.stamp.reportCurrency ?? 'CNY'})</button></th><th><span className="hp-sr">操作</span></th></tr></thead>
    <tbody>{Array.from({ length: 8 }, (_, index) => {
      const row = data?.rows[index];
      return <tr key={row?.id ?? `blank-${index}`} data-testid="holding-slot" className={!row ? 'hp-blank' : undefined}>{row ? <>
        <td><span className="hp-holding-name" {...fullValue(`${row.name} · ${row.code} · ${row.exchange} · 股票`)}>{row.name}</span><small>{row.code} · {row.exchange}</small></td><td>{row.holdingDays === null ? '—' : `${row.holdingDays}天`}</td><td {...fullValue(row.quantity)}>{row.quantity}</td><td {...fullValue(row.cost ?? '成本未知')}>{row.cost === null ? '暂无' : money(row.cost, false)}</td><td {...fullValue(row.price ?? '行情缺失')}>{row.price === null ? '待更新' : money(row.price, false)}</td><td {...fullValue(row.marketValue.value ?? '未知')}>{money(row.marketValue.value)}</td><td {...fullValue(row.unrealized.value ?? '未知')} className={tone(row.unrealized.value)}>{money(row.unrealized.value)}</td><td><button type="button" className="hp-eye" aria-label={`查看${row.name}详情`} onClick={event => onDetail(row.id, event.currentTarget)}><Eye size={16} /></button></td>
      </> : <td colSpan={8}>{index === 3 && data?.total === 0 ? query ? '没有匹配的持仓，清除搜索可恢复' : '暂无持仓' : !view && index === 3 ? '持仓加载中…' : '\u00A0'}</td>}</tr>;
    })}</tbody></table>
    <footer><span>{data ? `共 ${data.total} 条持仓` : '读取持仓中'}</span><div><button type="button" aria-label="上一页" disabled={!data || data.page <= 1 || pending} onClick={() => onChange({ page: (data?.page ?? 1) - 1 })}><ChevronLeft size={16} /></button><span>{data?.pages ? `${data.page} / ${data.pages}` : '—'}</span><button type="button" aria-label="下一页" disabled={!data || data.page >= data.pages || pending} onClick={() => onChange({ page: (data?.page ?? 1) + 1 })}><ChevronRight size={16} /></button></div></footer>
    {tooltip}
  </section>;
}
