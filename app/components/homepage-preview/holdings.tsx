'use client';
import Decimal from 'decimal.js';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { HomeRequest, HomeView } from './display-contract';
import { useFullValueReadout } from './full-value';
export function money(value: string | null, compact = true) {
  if (value === null) return '—';
  const amount = new Decimal(value), unit = compact && amount.abs().gte(1e8) ? '亿' : compact && amount.abs().gte(1e4) ? '万' : '';
  return `${(unit === '亿' ? amount.div(1e8) : unit === '万' ? amount.div(1e4) : amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${unit ? ` ${unit}` : ''}`;
}
export function tone(value: string | null) { return value === null || new Decimal(value).isZero() ? '' : new Decimal(value).gt(0) ? 'positive' : 'negative'; }
function profit(value: string | null) { return `${value !== null && new Decimal(value).gt(0) ? '+' : ''}${money(value)}`; }
export function Holdings({ view, query, onQuery, onComposition, onChange, onDetail, onExport, pending }: { view: HomeView | null; query: string; onQuery: (value: string) => void; onComposition: (active: boolean) => void; onChange: (patch: Partial<HomeRequest>) => void; onDetail: (id: string, trigger: HTMLElement) => void; onExport: () => void; pending: boolean }) {
  const data = view?.holdings;
  const { bind: fullValue, tooltip } = useFullValueReadout(view);
  const sort = (key: HomeRequest['sort']) => onChange({ sort: key, direction: view?.request.sort === key && view.request.direction === 'desc' ? 'asc' : 'desc' });
  return <section className="hp-holdings" aria-labelledby="holdings-heading">
    <header className="hp-holdings-title"><h2 id="holdings-heading" tabIndex={-1}>当前持仓（最新）</h2><p>持仓市值({view?.stamp.reportCurrency ?? 'CNY'}) <strong {...fullValue(data?.marketValue.value ?? '未知')}>{money(data?.marketValue.value ?? null)}</strong><span>持仓浮动盈亏 <strong className={tone(data?.unrealized.value ?? null)} {...fullValue(data?.unrealized.value ?? '未知')}>{profit(data?.unrealized.value ?? null)}</strong></span></p>
      <label className="hp-search"><Search size={16} /><input type="search" aria-label="搜索持仓" placeholder="搜索名称 / 代码" value={query} onCompositionStart={() => onComposition(true)} onCompositionEnd={event => { onComposition(false); onQuery(event.currentTarget.value); }} onChange={event => onQuery(event.target.value)} />{query && <button type="button" aria-label="清除搜索" onClick={() => onQuery('')}><X size={14} /></button>}</label>
      <button type="button" className="hp-export" aria-label="导出 CSV" disabled={!data?.total || pending} title={!data?.total ? '无可导出的持仓（0）' : '导出完整筛选结果'} onClick={onExport}>导出</button>
    </header>
    <div className="hp-holdings-data"><div className="hp-holdings-table" role="region" aria-label="持仓明细，可横向滚动" tabIndex={0}><table><colgroup>{[25,8,10,11,11,15,14,6].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup><thead><tr><th>标的</th><th>持仓天数</th><th>数量</th><th>成本价(原币)</th><th>最新价(原币)</th><th aria-sort={view?.request.sort === 'marketValue' ? view.request.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" disabled={!data?.sortAvailable} title={!data?.sortAvailable ? '金额依据不足，暂不支持市值排序' : undefined} aria-label="按市值排序" onClick={() => sort('marketValue')}><ArrowUpDown size={12} />持仓市值({view?.stamp.reportCurrency ?? 'CNY'})</button></th><th aria-sort={view?.request.sort === 'unrealized' ? view.request.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" disabled={!data?.sortAvailable} title={!data?.sortAvailable ? '金额依据不足，暂不支持浮盈排序' : undefined} aria-label="按浮盈排序" onClick={() => sort('unrealized')}><ArrowUpDown size={12} />持仓浮动盈亏({view?.stamp.reportCurrency ?? 'CNY'})</button></th><th>查看</th></tr></thead>
    <tbody>{Array.from({ length: 8 }, (_, index) => {
      const row = data?.rows[index];
      return <tr key={row?.id ?? `blank-${index}`} data-testid="holding-slot" className={!row ? 'hp-blank' : undefined}>{row ? <>
        <td><span className="hp-holding-name" {...fullValue(`${row.name} · ${row.code} · ${row.exchange}${row.assetType?` · ${row.assetType}`:""}`)}>{row.name}</span><small>{row.exchange}:{row.code}</small></td><td>{row.holdingDays === null ? '—' : `${row.holdingDays}天`}</td><td {...fullValue(row.quantity??'数量未知')}>{row.quantity??'—'}</td><td {...fullValue(row.cost === null ? '成本未知' : `${row.cost} ${row.currency}`)}>{row.cost === null ? '暂无' : <>{money(row.cost, false)} <span className="hp-price-currency">{row.currency}</span></>}</td><td {...fullValue(row.price === null ? '行情缺失' : `${row.price} ${row.currency}`)}>{row.price === null ? '待更新' : <>{money(row.price, false)} <span className="hp-price-currency">{row.currency}</span></>}</td><td {...fullValue(row.marketValue.value ?? '未知')}>{money(row.marketValue.value)}</td><td {...fullValue(row.unrealized.value ?? '未知')} className={tone(row.unrealized.value)}>{profit(row.unrealized.value)}</td><td><button type="button" className="hp-eye" aria-label={`查看${row.name}详情`} onClick={event => onDetail(row.id, event.currentTarget)}><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></td>
      </> : <td colSpan={8}>{!view && index === 3 ? '持仓加载中…' : '\u00A0'}</td>}</tr>;
    })}</tbody></table></div>{data?.total === 0 && <div className="hp-holdings-empty" role="status">{query ? <span>没有匹配的持仓，清除搜索可恢复</span> : <><span>暂无持仓</span><small>可切换市场或实盘账户，查看其他范围的持仓。</small></>}</div>}</div>
    <footer><span>{data ? `共 ${data.total} 条持仓` : '读取持仓中'}</span>{!!data?.total && <div><button type="button" aria-label="上一页" disabled={data.page <= 1 || pending} onClick={() => onChange({ page: data.page - 1 })}><ChevronLeft size={16} /></button><span>{data.page} / {data.pages}</span><button type="button" aria-label="下一页" disabled={data.page >= data.pages || pending} onClick={() => onChange({ page: data.page + 1 })}><ChevronRight size={16} /></button></div>}</footer>
    {tooltip}
  </section>;
}
