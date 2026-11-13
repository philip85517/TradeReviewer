import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HomepagePreview } from './homepage-preview';
import { createMockSource, DEFAULT_REQUEST } from './mock-source';
import type { HomepageSource, HomeView } from './display-contract';

beforeEach(() => { window.history.replaceState(null, '', '/preview/homepage'); });
afterEach(cleanup);
const ready = () => screen.findByRole('button', { name: /查看贵州茅台详情/ });
describe('homepage mock journey', () => {
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
    await userEvent.click(screen.getByRole('button', { name: '取消读取' }));
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
});
