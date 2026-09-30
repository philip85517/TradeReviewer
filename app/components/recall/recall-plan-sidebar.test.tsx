import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RecallPlanSidebar, emptyRecallPlanInput } from './recall-plan-sidebar';
afterEach(cleanup);
it('leaves unknown prices blank and preserves invalid decimal text with an error', () => {
    const onChange = vi.fn();
    render(<RecallPlanSidebar input={emptyRecallPlanInput('USD')} phase="pre-entry" readOnly={false} onChange={onChange} onClose={() => { }}/>);
    expect(screen.getByLabelText('计划入场')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('计划入场'), { target: { value: 'oops' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ entry: 'oops' }));
});
it('holding is read only and post-review separates execution evaluation', () => {
    render(<RecallPlanSidebar input={null} phase="post-review" readOnly onChange={() => { }} onClose={() => { }}/>);
    expect(screen.getByText('原计划未记录')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '执行评价' })).toBeInTheDocument();
    expect(screen.queryByLabelText('计划入场')).not.toBeInTheDocument();
});

it("does not describe a phase-readonly draft as frozen and safely displays invalid input", () => {
 render(<RecallPlanSidebar input={{...emptyRecallPlanInput("USD"),entry:"oops"}} phase="holding" readOnly onChange={()=>{}} onClose={()=>{}} />);
 expect(screen.getByText("未留存草稿；返回买入前判断继续编辑。")).toBeInTheDocument();
 expect(screen.queryByText("原计划已冻结；后续调整需另建修订。")).not.toBeInTheDocument();
 expect(screen.getAllByText("待补充")).toHaveLength(2);
});
it('switches one primary input to money and exposes explicit reference rounding',()=>{
 const onChange=vi.fn();render(<RecallPlanSidebar input={{...emptyRecallPlanInput('CNY'),entry:'56',sizeInputValue:'1000',resolvedQuantity:'1000'}} phase="pre-entry" readOnly={false} onChange={onChange} onClose={()=>{}}/>);
 fireEvent.click(screen.getByRole('button', { name: '名义金额' }));
 expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({sizeInputMode:'amount',sizeInputValue:'56000',resolvedQuantity:'1000'}));
 expect(screen.getByLabelText('参考数量步长')).toHaveValue('1');
});
it('compacts long derived evidence while preserving its exact tooltip and primary input', async () => {
 const {applyRecallSizing}=await import('../../lib/recall/sizing');
 const input=applyRecallSizing({...emptyRecallPlanInput('CNY'),entry:'56',sizeInputMode:'amount',sizeInputValue:'56050',sizing:{quantityStep:'100',stepSource:'manual-reference',rounding:'floor',derivedUnroundedQuantity:null,roundingDelta:null}});
 render(<RecallPlanSidebar input={input} phase="pre-entry" readOnly={false} onChange={()=>{}} onClose={()=>{}}/>);
 fireEvent.click(screen.getByText('币种、价格口径、参考资金与数量步长'));
 const exact=input.sizing!.derivedUnroundedQuantity!;
 expect(screen.getByTitle(exact)).toHaveTextContent('≈1000.892857');
 expect(screen.getByLabelText('计划名义金额')).toHaveValue('56050');
 expect(screen.getByTitle(exact).parentElement).toHaveStyle({overflowWrap:'anywhere'});
});

it('limits long R values to six decimals and reveals the exact value by keyboard or click', () => {
 const input = {
   ...emptyRecallPlanInput('CNY'),
   direction: 'long' as const,
   entry: '56',
   initialStop: '51.6',
   targets: [{ id: 'target-1', price: '76.6', quantity: null, ratio: null }],
   sizeInputValue: '4200',
   resolvedQuantity: '4200',
   sizing: undefined,
 };
 render(<RecallPlanSidebar input={input} phase="holding" readOnly compactReadOnly onChange={() => {}} onClose={() => {}} />);

 const compact = screen.getByText('≈4.681818R');
 expect(compact).toBeInTheDocument();
 const toggle = screen.getByRole('button', { name: '查看完整数值 4.6818181818181818182' });
 expect(toggle).toHaveTextContent('≈4.681818R');
 expect(toggle.parentElement).toHaveAttribute('title', '4.6818181818181818182');
 fireEvent.keyDown(toggle, { key: ' ', code: 'Space' });
 expect(toggle).toHaveTextContent('≈4.681818R');
 fireEvent.click(toggle);
 expect(toggle).toHaveTextContent('4.6818181818181818182R');
});

it('keeps the three derived plan metrics legible and uses text input for currency and ISO as-of values', () => {
 const input = {
   ...emptyRecallPlanInput('CNY'),
   direction: 'long' as const,
   entry: '56',
   initialStop: '52',
   targets: [{ id: 'target-1', price: '68', quantity: null, ratio: null }],
   sizeInputValue: '1000',
   resolvedQuantity: '1000',
   capital: { amount: '200000', currency: 'CNY', asOf: '2026-09-26T00:00:00.000Z', source: 'manual-reference' as const },
   sizing: undefined,
 };
 render(<RecallPlanSidebar input={input} phase="pre-entry" readOnly={false} onChange={() => {}} onClose={() => {}} />);
 expect(screen.getByText('56000').parentElement).toHaveTextContent('56000 CNY / 28%');
 expect(screen.getByText('4000').parentElement).toHaveTextContent('4000 CNY / 2%');
 const expectedReward = document.querySelector('.recall-plan-derived-metrics > div:last-child dd');
 expect(expectedReward).not.toBeNull();
 expect(expectedReward).toHaveTextContent('3R');
 expect(expectedReward).toHaveTextContent('3:1');
 expect(expectedReward).not.toHaveTextContent('12000');
 expect(expectedReward).toHaveAttribute('title', '预期收益 12000 CNY');
 expect(expectedReward).toHaveAttribute('aria-label', '预期收益 12000 CNY；预期 3R；收益风险比 3:1');
 expect(document.querySelector('.recall-plan-metrics')).toBeNull();
 expect(screen.queryByText(/收益 : 风险/)).not.toBeInTheDocument();
 fireEvent.click(screen.getByText('币种、价格口径、参考资金与数量步长'));
 expect(screen.getByLabelText('参考资金金额')).toHaveAttribute('inputmode', 'decimal');
 expect(screen.getByLabelText('参考资金币种')).toHaveAttribute('inputmode', 'text');
 expect(screen.getByLabelText('参考资金时点')).toHaveAttribute('inputmode', 'text');
});

it('fails closed for an incomplete capital amount without losing the raw input', () => {
 const input = {
   ...emptyRecallPlanInput('CNY'),
   direction: 'long' as const,
   entry: '56',
   initialStop: '52',
   targets: [{ id: 'target-1', price: '68', quantity: null, ratio: null }],
   sizeInputValue: '1000',
   resolvedQuantity: '1000',
   capital: { amount: '.', currency: 'CNY', asOf: null, source: 'manual-reference' as const },
 };
 render(<RecallPlanSidebar input={input} phase="pre-entry" readOnly={false} onChange={() => {}} onClose={() => {}} />);
 expect(screen.getByLabelText('参考资金金额')).toHaveValue('.');
 expect(document.querySelector('.recall-plan-derived-metrics')).toHaveTextContent('未知');
});

it('keeps the three size modes as an accessible compact button group', () => {
 const onChange=vi.fn();
 render(<RecallPlanSidebar input={{...emptyRecallPlanInput('CNY'), entry:'56'}} phase="pre-entry" readOnly={false} onChange={onChange} onClose={()=>{}}/>);
 expect(screen.getByRole('group', { name: '规模方式切换' })).toBeInTheDocument();
 expect(screen.getByLabelText('计划方向')).toBeVisible();
 expect(screen.getByRole('button', { name: '数量' })).toHaveAttribute('aria-pressed', 'true');
 expect(screen.getByRole('button', { name: '名义金额' })).toHaveAttribute('aria-pressed', 'false');
 fireEvent.click(screen.getByRole('button', { name: '名义金额' }));
 expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sizeInputMode: 'amount' }));
 const capitalDetails = screen.getByText('币种、价格口径、参考资金与数量步长').closest('details');
 expect(capitalDetails).not.toBeNull();
  expect(capitalDetails).not.toHaveProperty('open', true);
});

it('keeps E10 price geometry primary and direction/unit as compact supplements', () => {
 const onChange = vi.fn();
 const input = {
   ...emptyRecallPlanInput('CNY'),
   entry: '56',
   initialStop: '52',
   targets: [{ id: 'target-1', price: '68', quantity: null, ratio: null }],
   sizeInputValue: '1000',
 };
 render(<RecallPlanSidebar input={input} phase="pre-entry" readOnly={false} onChange={onChange} onClose={() => {}} />);

 const entry = screen.getByLabelText('计划入场');
 const stop = screen.getByLabelText('初始止损');
 const target = screen.getByLabelText('止盈目标');
 const direction = screen.getByLabelText('计划方向');
 const quantity = screen.getByLabelText('计划数量');
 const unit = screen.getByLabelText('计划数量单位');

 expect(entry.closest('label')).toHaveClass('recall-plan-primary-field');
 expect(entry.closest('.recall-plan-entry-row')).not.toHaveClass('recall-plan-pair');
 expect(stop.closest('.recall-plan-price-pair')).toBe(target.closest('.recall-plan-price-pair'));
 expect(direction.closest('label')).toHaveClass('recall-plan-compact-field');
 expect(quantity.closest('label')).toHaveClass('recall-plan-primary-field');
 expect(unit.closest('label')).toHaveClass('recall-plan-compact-field');
 expect(quantity.closest('.recall-plan-size-input')).not.toBeNull();
 expect(direction.closest('.recall-plan-supplementary-row')).toBe(unit.closest('.recall-plan-supplementary-row'));
 expect(direction).toHaveValue('');
 expect(screen.getByText(/选择计划方向后可计算风险与盈亏比/)).toBeInTheDocument();
 fireEvent.change(direction, { target: { value: 'long' } });
 expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'long' }));
});

it('does not label an amount or ratio input as a quantity when conversion is unavailable', () => {
 const input = { ...emptyRecallPlanInput('USD'), sizeInputMode: 'amount' as const, sizeInputValue: '1000', resolvedQuantity: null };
 render(<RecallPlanSidebar input={input} phase="post-review" readOnly retained compactReadOnly onChange={()=>{}} onClose={()=>{}}/>);
 expect(screen.getByRole('region', { name: '紧凑计划摘要' })).toHaveTextContent('未提供');
});

it('keeps read-only stage summaries compact and folds the full plan and secondary content', () => {
 const input = { ...emptyRecallPlanInput('USD'), entry: '10', initialStop: '9', targets: [{ id: 'target-1', price: '13', quantity: null, ratio: null }], resolvedQuantity: '2' };
 render(<RecallPlanSidebar input={input} phase="post-review" readOnly retained compactReadOnly onChange={()=>{}} onClose={()=>{}}
   primaryContent={<section aria-label="可信实际摘要">实际摘要</section>}
   secondaryContent={<section aria-label="完整计划与修订">完整计划与修订</section>}
 />);
 expect(screen.getByRole('region', { name: '紧凑计划摘要' })).toBeInTheDocument();
 expect(screen.getByRole('region', { name: '可信实际摘要' })).toBeInTheDocument();
 const fullPlan = screen.getByText('完整原计划').closest('details');
 expect(fullPlan).not.toBeNull();
 expect(fullPlan).not.toHaveProperty('open', true);
 expect(screen.getByRole('region', { name: '完整计划与修订' })).toBeInTheDocument();
});

it('limits long R values to six decimals and reveals the exact value by keyboard or click', () => {
 const input = {
   ...emptyRecallPlanInput('CNY'),
   direction: 'long' as const,
   entry: '56',
   initialStop: '51.6',
   targets: [{ id: 'target-1', price: '76.6', quantity: null, ratio: null }],
   sizeInputValue: '4200',
   resolvedQuantity: '4200',
   sizing: undefined,
 };
 render(<RecallPlanSidebar input={input} phase="holding" readOnly compactReadOnly onChange={() => {}} onClose={() => {}} />);

 const compact = screen.getByText('≈4.681818R');
 expect(compact).toBeInTheDocument();
 const toggle = screen.getByRole('button', { name: '查看完整数值 4.6818181818181818182' });
 expect(toggle).toHaveTextContent('≈4.681818R');
 expect(toggle.parentElement).toHaveAttribute('title', '4.6818181818181818182');
 fireEvent.keyDown(toggle, { key: ' ', code: 'Space' });
 expect(toggle).toHaveTextContent('≈4.681818R');
 fireEvent.click(toggle);
 expect(toggle).toHaveTextContent('4.6818181818181818182R');
});
