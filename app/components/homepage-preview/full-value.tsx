'use client';
import { useState, type KeyboardEvent, type SyntheticEvent } from 'react';

/** Formatting never discards the source decimal; mouse and keyboard share one readout. */
export function useFullValueReadout() {
  const [readout, setReadout] = useState<{ value: string; x: number; y: number } | null>(null);
  const bind = (value: string) => {
    const show = (event: SyntheticEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setReadout({ value, x: Math.max(12, Math.min(innerWidth - 372, rect.left)), y: Math.max(12, Math.min(innerHeight - 80, rect.bottom + 6)) });
    };
    return { tabIndex: 0, title: value, onFocus: show, onMouseEnter: show,
      onBlur: () => setReadout(null), onMouseLeave: (event: SyntheticEvent<HTMLElement>) => { if (document.activeElement !== event.currentTarget) setReadout(null); },
      onKeyDown: (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setReadout(null); } } };
  };
  return { bind, tooltip: readout && <div role="tooltip" className="hp-full-readout" style={{ left: readout.x, top: readout.y }}>{readout.value}</div> };
}
