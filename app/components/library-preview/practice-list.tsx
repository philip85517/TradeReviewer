import { useEffect, useRef, useState } from 'react';
import type { LibraryOptions, PracticeKey, PracticePage, PracticeQuery } from '../../lib/library-preview/contracts';
import { InfoPopover } from './info-popover';
import './practice-list.css';

type Props = {
  page: PracticePage | null;
  error: string;
  onRefresh: () => void;
  pending?: boolean;
  notice?: string;
  options?: LibraryOptions | null;
  appliedQuery?: PracticeQuery;
  onQueryChange?: (query: PracticeQuery) => void;
  onRetry?: () => void;
  onOpen?: (key: PracticeKey, target: HTMLElement) => void;
};
const defaultQuery: PracticeQuery = { from: '', to: '', market: 'all', accountId: 'all', search: '', sort: 'date-asc', pageIndex: 1, pageSize: 6 };

export function PracticeList({ page, error, onRefresh, pending = false, notice = '', options = null, appliedQuery, onQueryChange, onRetry, onOpen }: Props) {
  const query = appliedQuery ?? page?.query ?? defaultQuery;
  const [draft, setDraft] = useState(query.search);
  const composing = useRef(false);
  useEffect(() => setDraft(query.search), [query.search]);
  const update = (changes: Partial<PracticeQuery>) => onQueryChange?.({ ...query, ...changes });
  const label = (value: string, items: readonly { id: string; label: string }[] | undefined, all: string) => value === 'all' || !value ? all : items?.find(item => item.id === value)?.label ?? value;
  const dates = !query.from && !query.to ? '全部日期' : `${query.from || '—'} 至 ${query.to || '—'}`;
  const pageCount = Math.max(1, page?.pageCount ?? 1);
  const pageIndex = query.pageIndex;
  const firstPage = Math.max(1, Math.min(pageIndex - 1, pageCount - 2));
  const pages = Array.from({ length: Math.min(3, pageCount) }, (_, i) => firstPage + i);
  return (
    <div className="card practice-list">
      <div className="toolbar practice-list-toolbar">
        <div>
          <h2 id="practice-list-heading" tabIndex={-1}>{page?.totalCount ?? '—'} 次练习</h2>
          <div className="scope-summary">已生效：{dates} · {label(query.market, options?.markets, '全部市场')} · {label(query.accountId, options?.accounts, '全部账户')} · {query.search ? `搜索：${query.search}` : '无搜索条件'}</div>
        </div>
        <div className="toolbar-actions practice-list-actions">
          <div className="practice-search">
            <input aria-label="搜索" placeholder="搜索练习" value={draft} aria-disabled={!onQueryChange || undefined} aria-describedby={!onQueryChange ? 'practice-query-reason' : undefined} readOnly={!onQueryChange} onChange={event => setDraft(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && !composing.current) update({ search: draft, pageIndex: 1 }); }} />
            <button type="button" aria-label="清除搜索" aria-describedby={!onQueryChange ? 'practice-query-reason' : undefined} aria-disabled={!onQueryChange || undefined} onClick={() => { if (onQueryChange) { setDraft(''); update({ search: '', pageIndex: 1 }); } }}>×</button>
          </div>
          <button type="button" onClick={onRefresh} aria-label="刷新">↻</button>
        </div>
      </div>
      {!onQueryChange && <span id="practice-query-reason" className="practice-list-reason">当前阶段搜索和分页尚不可用</span>}
      {!onOpen && <span id="practice-open-reason" className="practice-list-reason">当前阶段练习详情尚不可用</span>}
      <div className="practice-list-status" role="status">
        {error ? <>{error}，新范围未应用。 {onRetry && <button type="button" onClick={onRetry}>重试</button>}</> : pending ? '加载中…' : notice || (!page ? '加载中…' : !page.rows.length ? (query.search ? '没有匹配的练习' : '暂无练习') : '')}
      </div>
      <div className="table-scroll practice-list-scroll">
        <table>
          <colgroup><col /><col /><col /><col /><col /><col /><col /></colgroup>
          <thead><tr>
            <th><button type="button" className="practice-sort" aria-disabled={!onQueryChange || undefined} aria-describedby={!onQueryChange ? 'practice-query-reason' : undefined} onClick={() => update({ sort: query.sort === 'date-asc' ? 'date-desc' : 'date-asc', pageIndex: 1 })}>练习日期 {query.sort === 'date-asc' ? '↑' : '↓'}</button></th>
            <th>练习</th><th>标的</th><th>代码</th><th>成交笔数</th>
            <th>内部配对<InfoPopover label="内部配对说明">内部配对是练习内成交之间的配对，不代表独立练习。</InfoPopover></th><th>未平仓数量</th>
          </tr></thead>
          <tbody>{page?.rows.map(row => <tr key={row.key.practiceId}>
            <td>{row.practiceDate}</td>
            <td><div className="practice-identity"><button id={`practice-row-${row.key.practiceId}`} type="button" className="practice-button" aria-describedby={!onOpen ? 'practice-open-reason' : undefined} aria-disabled={!onOpen || undefined} onClick={event => onOpen?.(row.key, event.currentTarget)}>{row.instrument.name} · {row.practiceDate} #{String(row.sequence).padStart(2, '0')}</button><InfoPopover label="查看完整练习身份">{row.instrument.name} · {row.practiceDate} #{String(row.sequence).padStart(2, '0')}</InfoPopover></div></td>
            <td><span className="practice-instrument" title={row.instrument.name}>{row.instrument.name}</span></td><td>{row.instrument.symbol}</td><td>{row.executionCount}</td>
            <td>{row.pairCount.state === 'known' ? row.pairCount.value : <>—<InfoPopover label="内部配对数量未知说明">{row.pairCount.reason}</InfoPopover></>}</td>
            <td>{row.openQuantity.state === 'known' ? <span title={row.openQuantity.value}>{row.openQuantity.value}</span> : <>—<InfoPopover label="未平仓数量未知说明">{row.openQuantity.reason}</InfoPopover></>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="practice-list-footer">
        {page && <><span>共 {page.totalCount} 条</span><nav aria-label="练习分页">
          <button type="button" disabled={pageIndex <= 1} aria-disabled={!onQueryChange || undefined} aria-describedby={!onQueryChange ? 'practice-query-reason' : undefined} onClick={() => update({ pageIndex: pageIndex - 1 })}>上一页</button>
          {pages.map(number => <button type="button" key={number} aria-current={number === pageIndex ? 'page' : undefined} aria-disabled={!onQueryChange || undefined} aria-describedby={!onQueryChange ? 'practice-query-reason' : undefined} onClick={() => update({ pageIndex: number })}>{number}</button>)}
          <button type="button" disabled={pageIndex >= pageCount} aria-disabled={!onQueryChange || undefined} aria-describedby={!onQueryChange ? 'practice-query-reason' : undefined} onClick={() => update({ pageIndex: pageIndex + 1 })}>下一页</button>
        </nav></>}
      </footer>
    </div>
  );
}
