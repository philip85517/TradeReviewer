import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticeDateFilter } from './practice-date-filter';

afterEach(cleanup);

describe('PracticeDateFilter', () => {
  it('cancels without changing the value', () => {
    const onChange = vi.fn();
    render(<PracticeDateFilter value={{ from: '', to: '' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /练习日期/ }));
    fireEvent.click(screen.getByText('取消'));
    expect(onChange).not.toHaveBeenCalled();
  });
  it('keeps the portal open during internal focus and closes on Escape', () => {
    const onChange = vi.fn();
    render(<PracticeDateFilter value={{ from: '', to: '' }} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /练习日期/ });
    fireEvent.click(trigger);
    const first = screen.getByText('全部');
    expect(first).toHaveFocus();
    screen.getByText('单日').focus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByText('单日'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
  it('closes on outside pointer and applies the week preset', () => {
    const onChange = vi.fn();
    render(<PracticeDateFilter value={{ from: '', to: '' }} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /练习日期/ });
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText('本周'));
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-12', to: '2026-10-15' });
  });
  it('rejects an incomplete range and applies a single day', () => {
    const onChange = vi.fn();
    render(<PracticeDateFilter value={{ from: '', to: '' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /练习日期/ }));
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-10-01' } });
    expect(screen.getByText('应用')).toBeDisabled();
    fireEvent.click(screen.getByText('单日'));
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-10-02' } });
    fireEvent.click(screen.getByText('应用'));
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-02', to: '2026-10-02' });
  });
});
