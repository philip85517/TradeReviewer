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
  it('closes on Escape after focus returns to the trigger', () => {
    const onChange = vi.fn();
    render(<PracticeDateFilter value={{ from: '', to: '' }} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /练习日期/ });
    fireEvent.click(trigger);
    expect(screen.getByText('全部')).toHaveFocus();
    trigger.focus(); // Shift+Tab from the first preset returns here.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
  it('remeasures near the viewport bottom when validation changes height', () => {
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const height = this.getAttribute('role') === 'dialog'
        ? (this.querySelector('[role="alert"]') ? 240 : 200) : 36;
      const top = this.getAttribute('aria-expanded') !== null ? 700 : 0;
      return { x: 20, y: top, left: 20, top, right: 320, bottom: top + height, width: 300, height, toJSON: () => ({}) };
    });
    try {
      render(<PracticeDateFilter value={{ from: '2026-10-01', to: '2026-10-02' }} onChange={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /练习日期/ }));
      const dialog = screen.getByRole('dialog');
      expect(dialog.style.top).toBe('494px');
      fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '' } });
      expect(dialog.style.top).toBe('454px');
      fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-10-02' } });
      expect(dialog.style.top).toBe('494px');
    } finally {
      rect.mockRestore();
    }
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
