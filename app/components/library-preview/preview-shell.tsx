import type { ReactNode } from 'react';
import type { LibraryOptions, PracticeQuery } from '../../lib/library-preview/contracts';
import { decodePreviewLocation } from '../../lib/library-preview/preview-url';
import { PracticeDateFilter } from './practice-date-filter';

const items = [
  ['首页', <path key="home" d="M3 10 12 3l9 7M5 9v11h14V9M10 20v-6h4v6" />],
  ['交易库', <><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h6M9 11h6M9 15h6"/></>],
  ['分析', <path key="chart" d="M4 3v17h17M7 16l4-5 3 2 6-7" />],
  ['数据', <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>],
  ['策略', <path key="flag" d="M5 21V3m0 2h10l3 4-3 4H5" />],
] as const;
type Props = { children: ReactNode; query?: PracticeQuery; options?: LibraryOptions | null; onQueryChange?: (query: PracticeQuery) => void; isDetail?: boolean };
export function PreviewShell({ children, query = decodePreviewLocation('').query, options, onQueryChange, isDetail = false }: Props) {
  const defaults = options?.defaultScope ?? decodePreviewLocation('').query;
  const update = (changes: Partial<PracticeQuery>) => onQueryChange?.({ ...query, ...changes, pageIndex: 1 });
  return <div className="library-preview">
    <span id="preview-stage-reason" className="sr-only">此功能将在下一阶段接入</span>
    <span id="preview-account-reason" className="sr-only">模拟练习身份，不显示实盘账户；此功能将在下一阶段接入</span>
    <span id="preview-detail-reason" className="sr-only">详情正在下一步骤接入</span>
    <aside><strong>TR</strong>{items.map(([label, icon]) => <button key={label} type="button" aria-disabled={label === '交易库' ? undefined : true} aria-current={label === '交易库' ? 'page' : undefined} aria-describedby={label === '交易库' ? undefined : 'preview-stage-reason'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{icon}</svg><span>{label}</span></button>)}</aside>
    <main><header className="preview-shell-header">交易库</header><nav className="preview-shell-nav" aria-label="交易库视图"><div className="mode-group"><button aria-disabled="true" aria-describedby="preview-stage-reason">实盘</button><button className="active" aria-current="true">模拟盘</button></div><button className="selected" aria-current="page">列表</button><button aria-disabled="true" aria-describedby="preview-stage-reason">统计</button></nav>
      <section className="preview-shell-content">{<div className="filters">
        {onQueryChange ? <PracticeDateFilter value={{ from: query.from, to: query.to }} onChange={range => update(range)} /> : <label className="preview-filter-date">练习日期<button type="button" aria-disabled="true" aria-describedby={isDetail ? "preview-detail-filter-reason" : "preview-stage-reason"}>{query.from} 至 {query.to}</button></label>}
        <label className="preview-filter-market">市场<select value={query.market} disabled={!onQueryChange} onChange={event => update({ market: event.target.value })}><option value="all">全部市场</option>{query.market !== "all" && !options?.markets.some(item => item.id === query.market) && <option value={query.market}>{query.market}</option>}{options?.markets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="preview-filter-account">账户 / 身份<select value={query.accountId} disabled={!onQueryChange} aria-describedby="preview-account-description" onChange={event => update({ accountId: event.target.value })}><option value="all">全部模拟账户</option>{query.accountId !== "all" && !options?.accounts.some(item => item.id === query.accountId) && <option value={query.accountId}>{query.accountId}</option>}{options?.accounts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        {isDetail && <span id="preview-detail-filter-reason" className="sr-only">返回列表后修改筛选</span>}
        <span id="preview-account-description" className="sr-only">模拟练习身份，不显示实盘账户</span>
        <button className="preview-filter-clear" type="button" disabled={!onQueryChange} onClick={() => update({ from: defaults.from, to: defaults.to, market: defaults.market, accountId: defaults.accountId })}>清除筛选</button>
      </div>}{children}</section>
    </main>
  </div>;
}
