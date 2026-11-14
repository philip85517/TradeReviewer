'use client';
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';

type Readout = { value: string; anchor: HTMLElement; context: unknown };
/** Formatting never discards the source decimal; mouse and keyboard share one readout. */
export function useFullValueReadout(context: unknown) {
  const [readout, setReadout] = useState<Readout | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const panel = useRef<HTMLDivElement>(null), id = useId();
  const focused = useRef<Readout | null>(null), hovered = useRef<Readout | null>(null);
  const current = readout?.context === context ? readout : null;
  if (readout && !current) setReadout(null);

  useLayoutEffect(() => {
    if (!current) return;
    function place() {
      if (!current!.anchor.isConnected || !panel.current) { setReadout(null); return; }
      const anchor = current!.anchor.getBoundingClientRect(), bounds = panel.current.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      if (anchor.bottom < 0 || anchor.top > height || anchor.right < 0 || anchor.left > width) { setReadout(null); return; }
      let leftEdge = 0, rightEdge = width, topEdge = 0, bottomEdge = height;
      for (let parent = current!.anchor.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), clip = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) { leftEdge = Math.max(leftEdge, clip.left); rightEdge = Math.min(rightEdge, clip.right); }
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) { topEdge = Math.max(topEdge, clip.top); bottomEdge = Math.min(bottomEdge, clip.bottom); }
      }
      if (anchor.right < leftEdge || anchor.left > rightEdge || anchor.bottom < topEdge || anchor.top > bottomEdge) { setReadout(null); return; }
      const below = anchor.bottom + 6;
      const top = Math.max(12, Math.min(below + bounds.height <= height - 12 ? below : anchor.top - bounds.height - 6, height - bounds.height - 12));
      const left = Math.max(12, Math.min(anchor.left, width - bounds.width - 12));
      setPosition(previous => previous.left === left && previous.top === top ? previous : { left, top });
    }
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (panel.current) observer?.observe(panel.current);
    observer?.observe(current.anchor);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [current]);

  const bind = (value: string) => {
    const show = (event: SyntheticEvent<HTMLElement>, target: typeof focused) => {
      target.current = { value, anchor: event.currentTarget, context };
      if (document.activeElement === event.currentTarget) focused.current = target.current;
      setReadout(target.current);
    };
    const restore = (source: Readout | null) => setReadout(source && source.context === context && source.anchor.isConnected ? source : null);
    return { tabIndex: 0, 'aria-describedby': current?.value === value ? id : undefined,
      onFocus: (event: SyntheticEvent<HTMLElement>) => show(event, focused), onMouseEnter: (event: SyntheticEvent<HTMLElement>) => show(event, hovered),
      onBlur: () => { focused.current = null; restore(hovered.current); },
      onMouseLeave: () => { hovered.current = null; restore(focused.current); },
      onKeyDown: (event: KeyboardEvent) => { if (event.key === 'Escape' && current) { event.stopPropagation(); focused.current = null; hovered.current = null; setReadout(null); } } };
  };
  // A portal keeps viewport coordinates independent of modal transforms and table clipping.
  return { bind, tooltip: current && createPortal(<div ref={panel} id={id} role="tooltip" className="hp-full-readout" style={position}>{current.value}</div>, document.body) };
}
