import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PreviewShell } from './preview-shell';
import { decodePreviewLocation } from '../../lib/library-preview/preview-url';
import type { LibraryOptions } from '../../lib/library-preview/contracts';

afterEach(cleanup);
const query = { ...decodePreviewLocation('').query, search: 'abc', sort: 'date-desc' as const, pageIndex: 3 };
const options: LibraryOptions = { snapshotVersion: 'v', defaultScope: { from: '', to: '', market: 'all', accountId: 'all', search: '' }, markets: [{ id: 'CN', label: 'A股' }], accounts: [{ id: 'sim', label: '模拟身份' }] };
function setup() { const onQueryChange = vi.fn(); render(<PreviewShell query={query} options={options} onQueryChange={onQueryChange}>内容</PreviewShell>); return onQueryChange; }
it('applies market and account selections and resets the page', () => {
  const change = setup();
  fireEvent.change(screen.getByLabelText('市场'), { target: { value: 'CN' } });
  expect(change).toHaveBeenLastCalledWith({ ...query, market: 'CN', pageIndex: 1 });
  fireEvent.change(screen.getByLabelText('账户 / 身份'), { target: { value: 'sim' } });
  expect(change).toHaveBeenLastCalledWith({ ...query, accountId: 'sim', pageIndex: 1 });
});
it('clears scope while preserving search and sort', () => {
  const change = setup(); fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
  expect(change).toHaveBeenCalledWith({ ...query, from: '', to: '', market: 'all', accountId: 'all', pageIndex: 1 });
});
it('passes a date range applied in the real date control', () => {
  const change = setup(); fireEvent.click(screen.getByRole('button', { name: /练习日期：/ }));
  fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-10-02' } });
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(change).toHaveBeenCalledWith({ ...query, from: '2026-10-01', to: '2026-10-02', pageIndex: 1 });
});
it('retains readonly filter context and navigation in detail', () => {
  const change = vi.fn();
  render(<PreviewShell isDetail query={query} options={options} onQueryChange={change}>内容</PreviewShell>);
  const date = screen.getByRole('button', { name: /练习日期/ });
  expect(date).toHaveAttribute('aria-disabled', 'true');
  expect(date).toHaveAccessibleDescription('返回列表后修改筛选');
  expect(screen.getByLabelText('市场')).toBeDisabled();
  expect(screen.getByLabelText('账户 / 身份')).toBeDisabled();
  const clear = screen.getByRole('button', { name: '清除筛选' });
  expect(clear).toBeDisabled();
  expect(screen.getByRole('navigation', { name: '交易库视图' })).toBeInTheDocument();
  fireEvent.click(date); fireEvent.click(clear);
  expect(screen.queryByLabelText('开始日期')).toBeNull();
  fireEvent.change(screen.getByLabelText('市场'), { target: { value: 'CN' } });
  fireEvent.change(screen.getByLabelText('账户 / 身份'), { target: { value: 'sim' } });
  expect(change).not.toHaveBeenCalled();
});
it('supports the existing host without a callback', () => {
  render(<PreviewShell>内容</PreviewShell>);
  expect(screen.getByLabelText('市场')).toBeDisabled(); expect(screen.getByRole('button', { name: /练习日期/ })).toHaveAttribute('aria-disabled', 'true');
});
