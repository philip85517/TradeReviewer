import type { ReactNode } from 'react';

const items = [
  ['首页', <path key="home" d="M3 10 12 3l9 7M5 9v11h14V9M10 20v-6h4v6" />],
  ['交易库', <><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h6M9 11h6M9 15h6"/></>],
  ['分析', <path key="chart" d="M4 3v17h17M7 16l4-5 3 2 6-7" />],
  ['数据', <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>],
  ['策略', <path key="flag" d="M5 21V3m0 2h10l3 4-3 4H5" />],
] as const;
export function PreviewShell({ children }: { children: ReactNode }) {
  return <div className="library-preview">
    <span id="preview-stage-reason" className="sr-only">此功能将在下一阶段接入</span>
    <span id="preview-detail-reason" className="sr-only">详情正在下一步骤接入</span>
    <aside><strong>TR</strong>{items.map(([label, icon]) => <button key={label} type="button" aria-disabled={label === '交易库' ? undefined : true} aria-current={label === '交易库' ? 'page' : undefined} aria-describedby={label === '交易库' ? undefined : 'preview-stage-reason'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{icon}</svg><span>{label}</span></button>)}</aside>
    <main><header>交易库</header><nav aria-label="交易库视图"><div className="mode-group"><button aria-disabled="true" aria-describedby="preview-stage-reason">实盘</button><button className="active" aria-current="true">模拟盘</button></div><button className="selected" aria-current="page">列表</button><button aria-disabled="true" aria-describedby="preview-stage-reason">统计</button></nav>
      <section><div className="filters"><label>练习日期<button aria-disabled="true" aria-describedby="preview-stage-reason">2026-10-15 至 2026-10-19 <span aria-hidden="true">⌄</span></button></label><label>市场<button aria-disabled="true" aria-describedby="preview-stage-reason">全部市场</button></label><label>账户 / 身份<button aria-disabled="true" aria-describedby="preview-stage-reason">模拟练习身份 · 不显示实盘账户</button></label></div>{children}</section>
    </main>
  </div>;
}
