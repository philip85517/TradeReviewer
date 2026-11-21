import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContributionPanel } from './contribution-panel';
import { buildContributionSnapshot, segmentGeometry, totalContribution, totalParts } from './contribution-data';
import type { ContributionProps, MockInstrument } from './contracts';
import { amount, DEFAULT_REQUEST } from '../mock-source';

afterEach(cleanup);
const names = [['贵州茅台','600519','SSE','CN'],['腾讯控股','00700','HKEX','HK'],['Apple','AAPL','NASDAQ','US'],['沪深300ETF','510300','SSE','CN']] as const;
const instruments: MockInstrument[] = names.map(([name,code,exchange,market],i) => ({ id:`instrument-${i}`, name, code, exchange, market, accountId:'account-1', currency:'CNY', holdingDays:10, quantity:'100', cost:'10',price:'11', marketValue:amount('1100'),unrealized:amount('100'), assetType:i===3?'ETF':'股票', review:'pending',open:i!==1 }));
const props = (patch: Partial<ContributionProps> = {}): ContributionProps => ({ request:DEFAULT_REQUEST, scenario:'normal', historyRange:{fromYear:2026,toYear:2026}, currentNet:amount('18420'), instruments,onOpenInstrument:vi.fn(),...patch });

describe('complete homepage contribution',()=>{
  it('balances full current fixture to its supplied presentation total without page summation',()=>{
    const data=buildContributionSnapshot(props(),'current','long');
    expect(totalContribution(data)).toBe(18420);
    expect(data.some(row=>row.realized!==null&&row.floating!==null&&row.realized*row.floating<0)).toBe(true);
  });
  it('reconciles net and both supplied current presentation parts while preserving symbol nets',()=>{
    const supplied=props({currentRealized:amount('12180'),currentFloating:amount('6240')});
    const data=buildContributionSnapshot(supplied,'current','long');
    expect(totalContribution(data)).toBe(18420);
    expect(totalParts(data)).toEqual({realized:12180,floating:6240});
    const short=buildContributionSnapshot(supplied,'current','short');
    expect(totalContribution(short)).toBe(-2763);
    expect(totalContribution(data.filter(row=>row.open))).not.toBe(18420);
  });
  it('places opposite signs on opposite sides and draws zero without a fake minimum width',()=>{
    const bars=segmentGeometry(150,-100,200);
    expect(bars[0]).toMatchObject({side:'positive',width:34.5,offset:0});
    expect(bars[1]).toMatchObject({side:'negative',width:23,offset:0});
    expect(segmentGeometry(0,0,200).every(x=>x.width===0)).toBe(true);
    expect(segmentGeometry(0.01,0,200)[0].width).toBeLessThan(0.01);
  });
  it('drills to actual instruments and passes the selected identity to the root detail journey',()=>{
    const onOpenInstrument=vi.fn();render(<ContributionPanel {...props({onOpenInstrument})}/>);
    fireEvent.click(screen.getByRole('button',{name:'查看A股贡献明细'}));
    expect(screen.getByRole('button',{name:'返回全部市场贡献'})).toBeInTheDocument();
    const button=screen.getByRole('button',{name:/查看贵州茅台贡献详情/});fireEvent.click(button);
    expect(onOpenInstrument).toHaveBeenCalledWith('instrument-0',button);
    expect(screen.getByTestId('contribution-summary')).toHaveTextContent('+1.84万');
  });
  it('keeps mode-local categories, sorting, drill, and current open-only while history disables that control',()=>{
    render(<ContributionPanel {...props()}/>);
    fireEvent.click(screen.getByRole('button',{name:'查看A股贡献明细'}));
    fireEvent.click(screen.getByRole('checkbox',{name:'仅看未平仓'}));
    fireEvent.change(screen.getByRole('combobox',{name:'贡献排序'}),{target:{value:'asc'}});
    fireEvent.click(screen.getByRole('tab',{name:'历史已平仓'}));
    expect(screen.getByRole('checkbox',{name:'仅看未平仓'})).toBeDisabled();
    expect(screen.queryByRole('button',{name:'返回全部市场贡献'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'做空'}));
    fireEvent.click(screen.getByRole('tab',{name:'当前期间'}));
    expect(screen.getByRole('checkbox',{name:'仅看未平仓'})).toBeChecked();
    expect(screen.getByRole('combobox',{name:'贡献排序'})).toHaveValue('asc');
    expect(screen.getByRole('button',{name:'返回全部市场贡献'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'做多'})).toHaveAttribute('aria-pressed','true');
  });
  it('uses seven pages for fifty symbol rows, retains full total and focuses the next page first row',()=>{
    const p=props({scenario:'fifty-pages',request:{...DEFAULT_REQUEST,market:'CN'}});render(<ContributionPanel {...p}/>);
    const full=screen.getByTestId('contribution-summary').textContent;
    expect(screen.getByText('1 / 7 · 50 项')).toBeInTheDocument();
    for(let i=0;i<6;i++)fireEvent.click(screen.getByRole('button',{name:'贡献下一页'}));
    expect(screen.getByText('7 / 7 · 50 项')).toBeInTheDocument();
    expect(screen.getAllByRole('button',{name:/贡献详情/})).toHaveLength(2);
    expect(screen.getByTestId('contribution-summary').textContent).toBe(full);
    expect(screen.getAllByRole('button',{name:/贡献详情/})[0]).toHaveFocus();
  });
  it('keeps an unknown supplied net unknown and exposes known component values through keyboard tooltip',()=>{
    render(<ContributionPanel {...props({scenario:'unknown',currentNet:amount(null)})}/>);
    expect(screen.getByTestId('contribution-summary')).toHaveTextContent('不可计算');
    const parts=screen.getAllByRole('img',{name:/已实现/});
    fireEvent.focus(parts[0]);expect(screen.getByRole('tooltip')).toHaveTextContent('CNY');
    fireEvent.keyDown(parts[0],{key:'Escape'});expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('contribution-bars')).getAllByText('不可计算').length).toBeGreaterThan(0);
  });
  it('preserves supplied known parts and their missing-net reason without inferring an available net',()=>{
    const supplied=props({scenario:'unknown',currentNet:amount(null,'CNY',['净额行情尚未覆盖']),currentRealized:amount('12180'),currentFloating:amount('6240')});
    const data=buildContributionSnapshot(supplied,'current','long');
    expect(totalParts(data)).toEqual({realized:12180,floating:6240});
    expect(totalContribution(data)).toBeNull();
    render(<ContributionPanel {...supplied}/>);
    expect(screen.getByTestId('contribution-summary')).toHaveTextContent('不可计算');
    expect(screen.getByText(/净额行情尚未覆盖/)).toBeInTheDocument();
    expect(screen.getByText(/已实现 \+1.22万 · 浮盈变化 \+6,240.00/)).toBeInTheDocument();
  });
  it('distinguishes no matching records from real zero amounts',()=>{
    render(<ContributionPanel {...props({scenario:'empty',instruments:[]})}/>);
    expect(screen.getByTestId('contribution-summary')).toHaveTextContent('—');
    expect(screen.getByTestId('contribution-summary')).toHaveAttribute('title','—');
    expect(screen.getByText('暂无符合条件的贡献')).toBeInTheDocument();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(document.querySelector('.hp-contrib-footer > div:last-child > strong')).toHaveTextContent('—');
  });
  it('keeps a real zero contribution total visible with matching records',()=>{
    render(<ContributionPanel {...props({currentNet:amount('0'),currentRealized:amount('0'),currentFloating:amount('0')})}/>);
    expect(document.querySelector('.hp-contrib-footer > div:last-child > strong')).toHaveTextContent('0.00 CNY');
    expect(screen.queryByText('暂无符合条件的贡献')).not.toBeInTheDocument();
  });
  it('applies asset/account scope and preserves local totals instead of reusing an unfiltered headline',()=>{
    const filtered=props({request:{...DEFAULT_REQUEST,filters:{assetTypes:['ETF'],openOnly:false,review:'all'}},currentNet:amount('2302.50'),currentRealized:amount('1522.50'),currentFloating:amount('780')});
    const rows=buildContributionSnapshot(filtered,'current','long');
    expect(rows).toHaveLength(1);expect(rows[0].instrumentId).toBe('instrument-3');
    expect(totalParts(rows)).toEqual({realized:1522.5,floating:780});
    expect(buildContributionSnapshot(filtered,'current','ipo')).toHaveLength(0);
    expect(buildContributionSnapshot({...filtered,request:{...filtered.request,accountId:'account-2'}},'current','long')).toHaveLength(0);
  });
  it('uses the actual keyboard segment as the return-focus trigger',()=>{
    const onOpenInstrument=vi.fn();render(<ContributionPanel {...props({request:{...DEFAULT_REQUEST,market:'CN'},onOpenInstrument})}/>);
    const segment=screen.getAllByRole('img',{name:/已实现/})[0];fireEvent.keyDown(segment,{key:'Enter'});
    expect(onOpenInstrument).toHaveBeenCalledWith('instrument-0',segment);
  });
  it('updates historical range without resetting current panel state',()=>{
    const p=props();const {rerender}=render(<ContributionPanel {...p}/>);
    fireEvent.click(screen.getByRole('tab',{name:'历史已平仓'}));
    expect(screen.getByTestId('contribution-summary')).toHaveTextContent('+3.00万');
    rerender(<ContributionPanel {...p} historyRange={{fromYear:2025,toYear:2026}}/>);
    expect(screen.getByRole('tab',{name:'历史已平仓'})).toHaveAttribute('aria-selected','true');
    expect(screen.getByText(/历史统计年份 · 2025 — 2026/)).toBeInTheDocument();
  });
  it('keeps missing or future historical totals unknown and an empty historical range empty',()=>{
    const future=buildContributionSnapshot(props({historyRange:{fromYear:2027,toYear:2027}}),'historical','long');
    expect(totalContribution(future)).toBeNull();
    expect(future.every(row=>row.realized===null)).toBe(true);
    expect(buildContributionSnapshot(props({historyRange:{fromYear:2023,toYear:2023}}),'historical','long')).toHaveLength(0);
    const missing=buildContributionSnapshot(props({scenario:'gaps'}),'historical','long');
    expect(missing.every(row=>row.realized===null)).toBe(true);
  });
  it('combines open and closed presentation components for a symbol without losing the open-only subset',()=>{
    const duplicate={...instruments[0],id:'closed:600519',open:false};
    const p=props({request:{...DEFAULT_REQUEST,market:'CN'},instruments:[instruments[0],duplicate]});
    render(<ContributionPanel {...p}/>);
    expect(screen.getAllByRole('button',{name:/查看贵州茅台贡献详情/})).toHaveLength(1);
    const full=screen.getByTestId('contribution-summary').textContent;
    fireEvent.click(screen.getByRole('checkbox',{name:'仅看未平仓'}));
    expect(screen.getAllByRole('button',{name:/查看贵州茅台贡献详情/})).toHaveLength(1);
    expect(screen.getByTestId('contribution-summary').textContent).not.toBe(full);
    fireEvent.click(screen.getByRole('button',{name:/查看贵州茅台贡献详情/}));
    expect(p.onOpenInstrument).toHaveBeenCalledWith('instrument-0',expect.any(HTMLElement));
  });
});
