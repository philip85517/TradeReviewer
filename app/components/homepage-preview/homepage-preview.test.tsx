import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomepagePreview } from './archive/homepage-preview';
import { createMockSource, DEFAULT_REQUEST } from './mock-source';
import type { HomepageSource, HomeView } from './display-contract';

beforeEach(() => { window.history.replaceState(null, '', '/preview/homepage'); });
afterEach(cleanup);
const ready = () => screen.findByRole('button', { name: /查看贵州茅台详情/ });
describe('homepage mock journey', () => {
  it('does not flash updating feedback for a market read completed within 250ms', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    const hk = await base.readHome({ ...DEFAULT_REQUEST, market: 'HK' }, new AbortController().signal);
    let finish!: (view: HomeView) => void;
    render(<HomepagePreview source={{ ...base, readHome: (request, signal) => request.market === 'HK' ? new Promise(resolve => { finish = resolve; }) : base.readHome(request, signal) }} />);
    await ready();
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: '港股' }));
      expect(screen.queryAllByText(/更新中/)).toHaveLength(0);
      expect(screen.queryByRole('button', { name: '取消读取' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true');
      await act(async () => { await vi.advanceTimersByTimeAsync(30); finish(hk); });
      expect(screen.getByRole('button', { name: '港股' })).toHaveAttribute('aria-pressed', 'true');
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(screen.queryAllByText(/更新中/)).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
  it('resets delayed feedback for a replacement request and clears it on cancel and failure', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    render(<HomepagePreview source={{ ...base, readHome: (request, signal) => request.market === 'HK' || request.market === 'US' ? new Promise(() => {}) : request.market === 'CN' ? Promise.reject(new Error('范围读取失败')) : base.readHome(request, signal) }} />);
    await ready();
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: '港股' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(250); });
      expect(screen.getByRole('button', { name: '取消读取' })).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: '美股' }));
      expect(screen.queryAllByText(/更新中/)).toHaveLength(0);
      await act(async () => { await vi.advanceTimersByTimeAsync(249); });
      expect(screen.queryByRole('button', { name: '取消读取' })).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      fireEvent.click(screen.getByRole('button', { name: '取消读取' }));
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
      expect(screen.queryAllByText(/更新中/)).toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: 'A股' }));
      await act(async () => {});
      expect(screen.getByRole('alert')).toHaveTextContent('范围读取失败');
      expect(screen.queryAllByText(/更新中/)).toHaveLength(0);
      expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true');
    } finally { vi.useRealTimers(); }
  });
  it('identifies native unit prices independently of report-currency amounts', async () => {
    render(<HomepagePreview />);
    await ready();
    const row = screen.getByRole('row', { name: /腾讯控股/ });
    expect(within(row).getByText('HKEX:00700')).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: /305.50 HKD/ })).toHaveTextContent('305.50 HKD');
    expect(within(row).getByRole('cell', { name: /338.20 HKD/ })).toHaveTextContent('338.20 HKD');
    expect(screen.getByRole('columnheader', { name: '成本价(原币)' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /持仓市值.CNY/ })).toBeInTheDocument();
  });
  it('uses named SVG navigation and marks deferred destinations unavailable', async () => {
    render(<HomepagePreview />);
    await ready();
    const nav = screen.getByRole('navigation', { name: '预览导航' });
    expect(within(nav).getByRole('link', { name: '首页' })).toHaveAttribute('aria-current', 'page');
    for (const label of ['交易库', '分析', '数据', '策略', '设置']) {
      expect(within(nav).getByRole('button', { name: `${label}，本轮未开放` })).toBeDisabled();
    }
    expect(nav).not.toHaveTextContent('◫');
  });
  it('explains an unsuccessful scope change and an empty holding scope', async () => {
    const base = createMockSource({ scenario: 'empty', delayMs: 0 });
    render(<HomepagePreview source={{ ...base, readHome: (request, signal) => request.market === 'US' ? Promise.reject(new Error('读取失败')) : base.readHome(request, signal) }} />);
    await screen.findByText('暂无持仓');
    expect(screen.getByText('可切换市场或实盘账户，查看其他范围的持仓。')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '美股' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('新选择未应用，仍显示原范围');
  });
  it('keeps empty holdings and no-match results free of pagination even when the API clamps pages to one', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    render(<HomepagePreview source={{ ...base, readHome: async (request, signal) => {
      const view = await base.readHome(request, signal);
      return { ...view, holdings: { ...view.holdings, rows: [], total: 0, page: 1, pages: 1 } };
    } }} />);
    await screen.findByText('暂无持仓');
    expect(screen.getAllByTestId('holding-slot')).toHaveLength(8);
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '上一页' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '下一页' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索持仓' }), '不存在');
    await screen.findByText('没有匹配的持仓，清除搜索可恢复');
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除搜索' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeDisabled();
  });
  it('does not invent a stock classification for ETF identity readouts or details', async () => {
    render(<HomepagePreview />);
    await ready();
    const row = screen.getByRole('row', { name: /沪深300ETF/ });
    await userEvent.hover(within(row).getByText('沪深300ETF'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('沪深300ETF · 510300 · SSE');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('股票');
    await userEvent.click(within(row).getByRole('button', { name: '查看沪深300ETF详情' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/510300 · SSE · CNY/)).not.toHaveTextContent('股票');
  });
  it('shows four cards, eight slots, accurate detail and trades, restores origin', async () => {
    const user = userEvent.setup();
    render(<HomepagePreview />);
    const origin = await ready();
    expect(screen.getAllByTestId('hp-metric-value')).toHaveLength(4);
    expect(screen.getAllByTestId('holding-slot')).toHaveLength(8);
    await user.click(origin);
    const dialog = await screen.findByRole('dialog', { name: '贵州茅台 · 持仓详情' });
    expect(within(dialog).getByText(/600519 · SSE/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '查看交易' }));
    expect(await screen.findByRole('heading', { name: '贵州茅台 · 交易集合' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '返回持仓详情' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(origin));
  });
  it('keeps committed market and amount on failed switch', async () => {
    const base = createMockSource({ scenario: 'normal' });
    const source: HomepageSource = { ...base, readHome: (request, signal) => request.market === 'US' ? Promise.reject(new Error('读取失败')) : base.readHome(request, signal) };
    render(<HomepagePreview source={source} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: '美股' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('读取失败');
    expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('article', { name: '期间净盈亏' })).toHaveTextContent('CNY');
  });
  it('rejects late responses and supports cancel without losing the view', async () => {
    const base = createMockSource({ scenario: 'normal' });
    let late!: (view: HomeView) => void;
    const source: HomepageSource = { ...base, readHome: (request, signal) => request.market === 'US' ? new Promise(resolve => { late = resolve; }) : base.readHome(request, signal) };
    render(<HomepagePreview source={source} />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: '美股' }));
    await userEvent.click(screen.getByRole('button', { name: '港股' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '港股' })).toHaveAttribute('aria-pressed', 'true'));
    const stale = await base.readHome({ ...DEFAULT_REQUEST, market: 'US' }, new AbortController().signal);
    await act(async () => late(stale));
    expect(screen.getByRole('button', { name: '港股' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '美股' }));
    await userEvent.click(await screen.findByRole('button', { name: '取消读取' }));
    expect(screen.getByRole('button', { name: '港股' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('cancels date drafts and resets page on a committed query or sort', async () => {
    window.history.replaceState(null, '', '/preview/homepage?scenario=nine&page=2');
    render(<HomepagePreview />);
    await screen.findByText('2 / 2');
    await userEvent.click(screen.getByRole('button', { name: /自定义日期/ }));
    const date = screen.getByRole('textbox', { name: '开始日期' });
    fireEvent.change(date, { target: { value: '2026-02-01' } });
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(window.location.search).not.toContain('2026-02-01');
    await userEvent.click(screen.getByRole('button', { name: '按市值排序' }));
    await screen.findByText('1 / 2');
    await userEvent.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('2 / 2');
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索持仓' }), '腾讯');
    await screen.findByText('1 / 1');
    expect(screen.getAllByTestId('holding-slot')).toHaveLength(8);
  });
  it('keeps empty geometry and disables export', async () => {
    render(<HomepagePreview initialScenario="empty" />);
    expect(await screen.findByText('暂无持仓')).toBeTruthy();
    expect(screen.getAllByTestId('holding-slot')).toHaveLength(8);
    expect(screen.getByRole('button', { name: '导出 CSV' })).toBeDisabled();
    expect(screen.queryByText('1 / 1')).toBeNull();
  });
  it('shows historical six-field keyboard readout and disconnected gaps', async () => {
    render(<HomepagePreview initialScenario="gaps" />);
    await ready();
    const chart = screen.getByRole('group', { name: /当前表现｜/ });
    act(() => chart.focus());
    expect(screen.getAllByTestId('hp-chart-field')).toHaveLength(6);
    fireEvent.keyDown(chart, { key: 'End' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('2026-10-15');
    expect(screen.getAllByTestId('hp-chart-segment')).toHaveLength(2);
  });
  it('shows isolated valid days without connecting gaps', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    const source: HomepageSource = { ...base, readHome: async (request, signal) => {
      const view = await base.readHome(request, signal);
      return { ...view, series: { ...view.series, points: view.series.points.map((point, index) => index === 1 || index === 3
        ? { ...point, state: 'source-missing' as const, plottable: false } : point) } };
    } };
    render(<HomepagePreview source={source} />);
    await ready();
    expect(screen.getAllByTestId('hp-chart-isolated-point').length).toBeGreaterThan(0);
  });
  it('rejects mismatched detail identities instead of opening another holding', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    const source: HomepageSource = { ...base, readHolding: async (stamp, id, signal) => {
      const detail = await base.readHolding(stamp, id, signal);
      return { ...detail, holding: { ...detail.holding, id: 'different-holding' } };
    } };
    render(<HomepagePreview source={source} />);
    await userEvent.click(await ready());
    expect(await screen.findByRole('alert')).toHaveTextContent('身份');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('defers search while Chinese input is composing', async () => {
    render(<HomepagePreview />);
    await ready();
    const search = screen.getByRole('searchbox', { name: '搜索持仓' });
    fireEvent.compositionStart(search);
    fireEvent.change(search, { target: { value: '腾讯' } });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(screen.getByText('共 8 条持仓')).toBeTruthy();
    fireEvent.compositionEnd(search);
    expect(await screen.findByText('共 1 条持仓')).toBeTruthy();
  });
  it('exposes the full decimal when a compact table amount receives focus', async () => {
    render(<HomepagePreview initialScenario="extreme" />);
    const trigger = await screen.findByRole('button', { name: /查看贵州茅台.*详情/ });
    const row = trigger.closest('tr')!;
    const value = within(row).getAllByRole('cell')[5];
    fireEvent.focus(value);
    expect(screen.getByRole('tooltip')).toHaveTextContent('123456789012.3456789');
  });
  it('restores a direct detail URL', async () => {
    window.history.replaceState(null, '', '/preview/homepage?holding=account-1%3ASSE%3A600519%3A0&panel=detail');
    render(<HomepagePreview />);
    expect(await screen.findByRole('dialog', { name: '贵州茅台 · 持仓详情' })).toBeTruthy();
  });
  it('uses the approved holding-days column and module title', async () => {
    render(<HomepagePreview />);
    const origin = await ready();
    expect(screen.getByRole('heading', { name: '当前持仓（最新）' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '持仓天数' })).toBeTruthy();
    expect(within(origin.closest('tr')!).getAllByRole('cell')[1]).toHaveTextContent('288');
  });
  it('does not restart a cancelled uncommitted search', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    const readHome = vi.fn((request, signal) => request.query ? new Promise<HomeView>(() => {}) : base.readHome(request, signal));
    render(<HomepagePreview source={{ ...base, readHome }} />);
    await ready();
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索持仓' }), '腾讯');
    await screen.findByRole('button', { name: '取消读取' });
    await userEvent.click(await screen.findByRole('button', { name: '取消读取' }));
    const count = readHome.mock.calls.length;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(readHome).toHaveBeenCalledTimes(count);
    expect(screen.queryByRole('button', { name: '取消读取' })).toBeNull();
  });
  it('shows trade errors and retry inside the active dialog', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    let fail = true;
    const source: HomepageSource = { ...base, readTrades: (stamp, id, signal) => fail ? (fail = false, Promise.reject(new Error('交易读取失败'))) : base.readTrades(stamp, id, signal) };
    render(<HomepagePreview source={source} />);
    await userEvent.click(await ready());
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '查看交易' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('交易读取失败');
    await userEvent.click(within(dialog).getByRole('button', { name: '重试读取交易' }));
    expect(await screen.findByRole('heading', { name: '贵州茅台 · 交易集合' })).toBeTruthy();
  });
  it('leaves a failed search dormant until another user action', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    const readHome = vi.fn((request, signal) => request.query ? Promise.reject(new Error('搜索读取失败')) : base.readHome(request, signal));
    render(<HomepagePreview source={{ ...base, readHome }} />);
    await ready();
    await userEvent.type(screen.getByRole('searchbox'), '腾讯');
    await screen.findByRole('alert');
    const count = readHome.mock.calls.length;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    expect(readHome).toHaveBeenCalledTimes(count);
  });
  it('times out a trade read with accessible manual recovery inside the dialog', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    render(<HomepagePreview source={{ ...base, readTrades: () => new Promise(() => {}) }} />);
    await userEvent.click(await ready());
    const dialog = await screen.findByRole('dialog');
    vi.useFakeTimers();
    try {
      fireEvent.click(within(dialog).getByRole('button', { name: '查看交易' }));
      expect(within(dialog).getByRole('button', { name: '取消读取' })).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(15001); });
      expect(within(dialog).getByRole('alert')).toHaveTextContent('15秒');
      expect(within(dialog).getByRole('button', { name: '重试读取交易' })).toBeEnabled();
    } finally { vi.useRealTimers(); }
  });
  it('shows full detail precision on keyboard focus and locks background scrolling', async () => {
    render(<HomepagePreview initialScenario="extreme" />);
    await userEvent.click(await screen.findByRole('button', { name: /查看贵州茅台.*详情/ }));
    const dialog = await screen.findByRole('dialog');
    expect(document.body.style.overflow).toBe('hidden');
    const card = within(dialog).getByRole('heading', { name: '市值(CNY)' }).parentElement!;
    const amount = card.querySelector('p')!;
    act(() => amount.focus());
    const readout = screen.getByRole('tooltip');
    expect(readout).toHaveTextContent('123456789012.3456789');
    expect(amount).toHaveAttribute('aria-describedby', readout.id);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('plots period net separately from cumulative net', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    const source: HomepageSource = { ...base, readHome: async (request, signal) => {
      const view = await base.readHome(request, signal);
      return { ...view, series: { ...view.series, points: view.series.points.map(point => ({ ...point, net: { ...point.net, value: '999999' }, periodNet: { ...point.periodNet, value: '12' } })) } };
    } };
    render(<HomepagePreview source={source} />);
    await ready();
    expect(screen.getAllByTestId('hp-chart-money-tick').map(tick => tick.textContent).join(' ')).not.toContain('万');
    fireEvent.focus(screen.getByRole('group', { name: /当前表现｜/ }));
    expect(screen.getByTestId('hp-chart-value-net')).toHaveTextContent('999,999.00');
    expect(screen.getByTestId('hp-chart-value-periodNet')).toHaveTextContent('12.00');
  });
  it('rounds chart amounts while retaining precise evidence and unknowns', async () => {
    const base = createMockSource({ scenario: 'normal', delayMs: 0 });
    const source: HomepageSource = { ...base, readHome: async (request, signal) => {
      const view = await base.readHome(request, signal);
      return { ...view, series: { ...view.series, points: view.series.points.map(point => ({ ...point,
        marketValue: { ...point.marketValue, value: '1234.5678' },
        unrealized: { ...point.unrealized, value: '-0.004' },
        realized: { ...point.realized, value: '0.004' },
        net: { ...point.net, value: null },
        periodNet: { ...point.periodNet, value: '-4380.745' },
      })) } };
    } };
    render(<HomepagePreview source={source} />);
    await ready();
    fireEvent.focus(screen.getByRole('group', { name: /当前表现｜/ }));
    expect(screen.getByTestId('hp-chart-value-marketValue')).toHaveTextContent('1,234.57');
    expect(screen.getByTestId('hp-chart-value-unrealized').textContent).toBe('0.00');
    expect(screen.getByTestId('hp-chart-value-realized').textContent).toBe('0.00');
    expect(screen.getByTestId('hp-chart-value-net').textContent).toBe('—');
    const amount = screen.getByTestId('hp-chart-value-periodNet');
    expect(amount.textContent).toBe('-4,380.75');
    fireEvent.focus(amount);
    expect(document.getElementById(amount.getAttribute('aria-describedby')!)).toHaveTextContent('原始金额：-4380.745 CNY');
  });
  it('explains normalized invalid URL values', async () => {
    window.history.replaceState(null, '', '/preview/homepage?market=invalid&page=-5&from=bad');
    render(<HomepagePreview />);
    await ready();
    expect(screen.getByRole('status', { name: '链接参数说明' })).toHaveTextContent('已恢复有效范围');
  });
});
