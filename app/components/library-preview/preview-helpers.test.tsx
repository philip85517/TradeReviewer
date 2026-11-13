import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InfoPopover } from './info-popover';
import { MetricValue } from './metric-value';
afterEach(cleanup);
describe('preview disclosures', () => {
  it('keeps the disclosure open after the first mouse enter, focus and click', () => {
    render(<InfoPopover label="说明">完整说明</InfoPopover>);
    const trigger = screen.getByLabelText('说明');
    fireEvent.mouseEnter(trigger);
    fireEvent.focus(trigger);
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('tooltip').textContent).toBe('完整说明');
  });
  it('distinguishes zero from unknown and discloses full values', () => {
    render(<><MetricValue value={{ state: 'known', value: { amount: '0', currency: 'CNY' } }} /><MetricValue value={{ state: 'unknown', reasonCode: 'missing', reason: '缺少价格' }} /></>);
    expect(screen.getByText('0.00')).toBeTruthy(); expect(screen.getByText('—')).toBeTruthy();
    fireEvent.focus(screen.getByLabelText('查看完整数值')); expect(screen.getByRole('tooltip').textContent).toBe('0.00 CNY');
    fireEvent.keyDown(document, { key: 'Escape' }); fireEvent.focus(screen.getByLabelText('查看未知原因')); expect(screen.getByRole('tooltip').textContent).toBe('缺少价格');
  });
  it('closes on Escape and outside pointer', () => {
    render(<InfoPopover label="说明">内容</InfoPopover>); const trigger = screen.getByLabelText('说明');
    fireEvent.focus(trigger); expect(screen.getByRole('tooltip')).toBeTruthy(); fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(trigger); expect(screen.getByRole('tooltip')).toBeTruthy(); fireEvent.pointerDown(document.body); expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
