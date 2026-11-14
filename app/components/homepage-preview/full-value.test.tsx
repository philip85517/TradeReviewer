import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFullValueReadout } from './full-value';

function Readout({ value = '123456789012.3456789', context = 'first' }) {
  const { bind, tooltip } = useFullValueReadout(context);
  return <><button {...bind(value)}>金额</button>{tooltip}</>;
}
const rect = (x: number, y: number, width: number, height: number) => new DOMRect(x, y, width, height);
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('full decimal readout', () => {
  it('follows its source cell on document and nested horizontal scroll', () => {
    let source = rect(220, 120, 80, 40);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'tooltip' ? rect(0, 0, 180, 42) : source;
    });
    render(<Readout />);
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '220px', top: '166px' });
    source = rect(160, 220, 80, 40);
    fireEvent.scroll(document);
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '160px', top: '266px' });
    source = rect(-200, 220, 80, 40);
    fireEvent.scroll(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('measures long content when avoiding the lower and right viewport edges', () => {
    vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'tooltip' ? rect(0, 0, 320, 126) : rect(300, 760, 70, 40);
    });
    render(<Readout />);
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '58px', top: '628px' });
  });

  it('closes when its source scrolls behind an ancestor clipping edge', () => {
    let source = rect(120, 120, 40, 40);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.dataset.clip) return rect(100, 100, 200, 200);
      return this.getAttribute('role') === 'tooltip' ? rect(0, 0, 180, 42) : source;
    });
    render(<div data-clip="true" style={{ overflowX: 'auto' }}><Readout /></div>);
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    source = rect(50, 120, 40, 40); // Still in the window, fully outside the table.
    fireEvent.scroll(screen.getByRole('button').parentElement!);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('restores the focused value after hover and dismisses that hover before its dialog', () => {
    const outerKey = vi.fn();
    function Pair() {
      const { bind, tooltip } = useFullValueReadout('same');
      return <div onKeyDown={outerKey}><button {...bind('first')}>A</button><button {...bind('second')}>B</button>{tooltip}</div>;
    }
    render(<Pair />);
    const focused = screen.getByRole('button', { name: 'A' }), hovered = screen.getByRole('button', { name: 'B' });
    act(() => focused.focus());
    fireEvent.mouseEnter(hovered);
    expect(screen.getByRole('tooltip')).toHaveTextContent('second');
    fireEvent.mouseLeave(hovered);
    expect(screen.getByRole('tooltip')).toHaveTextContent('first');
    fireEvent.mouseEnter(hovered);
    fireEvent.keyDown(focused, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(outerKey).not.toHaveBeenCalled();
    fireEvent.mouseLeave(hovered);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.keyDown(focused, { key: 'Escape' });
    expect(outerKey).toHaveBeenCalledTimes(1);
  });

  it('invalidates the old readout when its data snapshot changes', () => {
    const page = render(<Readout />);
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('123456789012.3456789');
    page.rerender(<Readout value="0" context="next" />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('0');
  });

  it('associates its complete value with the trigger and closes without stealing focus', () => {
    render(<Readout />);
    const trigger = screen.getByRole('button');
    act(() => trigger.focus());
    expect(trigger).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
