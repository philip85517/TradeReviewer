'use client';
import { useId } from 'react';
import type { Fact, Money, PairPage, PracticeDetail } from '../../lib/library-preview/contracts';
import { formatMoney } from '../../lib/library-preview/format';
import { InfoPopover } from './info-popover';
import { MetricValue } from './metric-value';
import './practice-detail.css';

type Props = { detail: PracticeDetail | null; pairs: PairPage | null; status: 'loading' | 'ready' | 'error'; error: string; onBack: () => void; onPairPage: (pageIndex: number) => void; onRetry: () => void; pairPending?: boolean; pairError?: string; onPairRetry?: () => void; retryable?: boolean };
function NeutralMoney({ value }: { value: Money }) {
  const formatted = formatMoney(value);
  return <span>{formatted.display.replace(/^\+/, '')}<InfoPopover label={value.state === 'unknown' ? '查看未知原因' : '查看完整数值'}>{formatted.fullValue.replace(/^\+/, '')}</InfoPopover>{value.state === 'unknown' && <span className="practice-detail__reason">{value.reason}</span>}</span>;
}
function FactValue({ value }: { value: Fact<string> }) {
  return value.state === 'known' ? <span>{value.value}</span> : <span>—<InfoPopover label="查看未知原因">{value.reason}</InfoPopover><span className="practice-detail__reason">{value.reason}</span></span>;
}
function DisabledAction({ label, reason }: { label: string; reason: string }) {
  const id = useId();
  return <><button type="button" aria-disabled="true" aria-describedby={id}>{label}</button><span id={id} className="practice-detail__reason">{reason}</span></>;
}
const sameKey = (a: PairPage['key'], b: PairPage['key']) => a.practiceId === b.practiceId && a.revisionId === b.revisionId && a.practiceVersion === b.practiceVersion;
export function PracticeDetailView({ detail, pairs, status, error, onBack, onPairPage, onRetry, pairPending = false, pairError = '', onPairRetry, retryable = true }: Props) {
  const visible = status === 'ready' ? detail : null;
  const page = visible && pairs && sameKey(visible.practice.key, pairs.key) && visible.snapshotVersion === pairs.snapshotVersion ? pairs : null;
  const date = (value: string, timezone: string) => { const d = new Date(value); return Number.isNaN(d.valueOf()) ? value : new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(d); };
  return <div className="practice-detail">
    <div className="practice-detail__header"><button type="button" onClick={onBack}>返回模拟练习列表</button>{visible && <div><h1>{visible.practice.instrument.name} · {visible.practice.practiceDate} #{visible.practice.sequence}</h1><p>{visible.practice.instrument.symbol} · {visible.practice.key.practiceId} · {visible.practice.key.revisionId} · {visible.practice.key.practiceVersion} · {visible.snapshotVersion}</p></div>}</div>
    <div role="status" aria-live="polite">{status === 'loading' ? '正在读取练习详情…' : status === 'error' ? <>{error || '读取详情失败'} {retryable && <button type="button" onClick={onRetry}>重试</button>}</> : ''}</div>
    {visible && <>
      <div className="practice-detail__panel"><div className="practice-detail__heading"><h2>内部配对</h2><span>{page ? page.completeness.state === 'unknown' ? <>— <InfoPopover label="查看配对数未知原因">{page.completeness.reason}</InfoPopover></> : `${page.totalCount} 个内部配对` : '—'}</span></div>
        <div role="status" aria-live="polite">{pairPending ? '正在读取内部配对…' : pairError ? <>{pairError} {onPairRetry && <button type="button" onClick={onPairRetry}>重试配对</button>}</> : ''}</div>
        <div className="practice-detail__table-wrap"><table aria-label="内部配对"><thead><tr><th>内部配对</th><th>开仓 → 平仓</th><th>配对数量</th><th>净盈亏</th><th>操作</th></tr></thead><tbody>{page?.rows.length ? page.rows.slice(0, 6).filter(row => sameKey(row.key, page.key)).map((row, index) => <tr key={row.pairId}><td>内部配对 {(page.pageIndex - 1) * 6 + index + 1}</td><td>{row.openedAt} → {row.closedAt}</td><td>{row.quantity}</td><td><MetricValue value={row.net} /> {row.net.state === 'known' && row.net.value.currency}</td><td><DisabledAction label="进入回放" reason="回放暂未接入" /></td></tr>) : <tr><td colSpan={5}>{page?.completeness.state === 'unknown' ? page.completeness.reason : page ? '无内部配对' : '配对数据不可用'}</td></tr>}</tbody></table></div>
        {page && page.pageCount > 1 && <nav aria-label="内部配对分页"><button type="button" disabled={page.pageIndex <= 1 || pairPending} onClick={() => onPairPage(page.pageIndex - 1)}>上一页</button>{Array.from({ length: page.pageCount }, (_, i) => <button type="button" key={i} aria-current={page.pageIndex === i + 1 ? 'page' : undefined} disabled={pairPending} onClick={() => onPairPage(i + 1)}>{i + 1}</button>)}<button type="button" disabled={page.pageIndex >= page.pageCount || pairPending} onClick={() => onPairPage(page.pageIndex + 1)}>下一页</button></nav>}
      </div>
      <div className="practice-detail__metrics"><div><span>闭合净盈亏</span><strong><MetricValue value={visible.financial.closedNet} /></strong></div><div><span>已平仓费用<InfoPopover label="已平仓费用说明">已计入净盈亏，不再重复扣除。</InfoPopover></span><strong><NeutralMoney value={visible.financial.closedFees} /></strong></div><div><span>未平仓数量</span><strong><FactValue value={visible.practice.openQuantity} /></strong></div><div><span>留存开仓费用<InfoPopover label="留存开仓费用说明">残余持仓保留的开仓费用。</InfoPopover></span><strong><NeutralMoney value={visible.financial.retainedOpenFees} /></strong></div></div>
      <div className="practice-detail__panel"><h2>整份练习财务</h2><dl className="practice-detail__grid">{([['已实现毛额', visible.financial.realizedGross], ['未实现毛额', visible.financial.unrealizedGross], ['总费用', visible.financial.totalFees], ['整份净盈亏', visible.financial.practiceNet], ['资本', visible.capital.value]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === '整份净盈亏' ? <><MetricValue value={value} />{value.state === 'unknown' && <span className="practice-detail__reason">{value.reason}</span>}</> : <NeutralMoney value={value} />}</dd></div>)}<div><dt>收益率</dt><dd><FactValue value={visible.financial.returnRate} /></dd></div><div><dt>资本来源 / 版本</dt><dd>{visible.capital.origin} / {visible.capital.version}（只读）</dd></div><div><dt>结束估值</dt><dd>{visible.endValuation.state === 'known' ? `${visible.endValuation.value.price} ${visible.endValuation.value.currency} · ${visible.endValuation.value.barEnd}` : <FactValue value={visible.endValuation} />}</dd></div></dl></div>
      <div className="practice-detail__panel"><h2>日期与来源</h2><dl className="practice-detail__grid"><div><dt>练习日期</dt><dd>{visible.practice.practiceDate} · {visible.practice.practiceDateSource}</dd></div><div><dt>成交历史日期</dt><dd>{visible.practice.historicalFrom} 至 {visible.practice.historicalTo}</dd></div><div><dt>导入时间</dt><dd>{date(visible.practice.importedAt, visible.practice.displayTimezone)} · {visible.practice.displayTimezone}</dd></div><div><dt>来源文件</dt><dd>{visible.source.name}</dd></div><div><dt>格式</dt><dd>{visible.source.format}</dd></div><div><dt>标的 / 账户 / 序号</dt><dd>{visible.practice.instrument.id} · {visible.practice.account.label} ({visible.practice.account.id}) · {visible.practice.sequence}</dd></div></dl><p>资本、日期与周期当前只读。</p><div className="practice-detail__actions">{visible.actions.map(action => <DisabledAction key={action.id} label={action.label} reason={action.reason || '当前阶段暂不可用'} />)}</div></div>
    </>}
  </div>;
}
