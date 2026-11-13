import type { ReactNode } from 'react';
export function PreviewShell({ children }: { children: ReactNode }) {
  const disabled = '此功能将在下一阶段接入';
  return <div className="library-preview"><aside><strong>TR</strong>{['首页','交易库','分析','数据','策略'].map(x => <button key={x} aria-disabled="true" title={disabled}>{x}</button>)}</aside><main><header>交易库</header><nav><button aria-disabled="true" title={disabled}>实盘</button><button className="active">模拟盘</button><button className="selected">列表</button><button aria-disabled="true" title={disabled}>统计</button></nav><section><div className="filters">{[['练习日期','2026-10-15 至 2026-10-19'],['市场','全部市场'],['账户 / 身份','模拟练习身份 · 不显示实盘账户']].map(([label,value]) => <label key={label}>{label}<button aria-disabled="true" title={disabled}>{value}</button></label>)}</div>{children}</section></main></div>;
}

