'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const show = () => { clearTimeout(timer.current); const rect = button.current?.getBoundingClientRect(); if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)), top: Math.min(rect.bottom + 4, window.innerHeight - 100) }); setOpen(true); };
  const leave = () => { timer.current = setTimeout(() => setOpen(false), 150); };
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); } };
    const outside = (event: PointerEvent) => { if (!button.current?.contains(event.target as Node) && !popover.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside); clearTimeout(timer.current); };
  }, [open]);
  return <><button ref={button} type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined} onMouseEnter={show} onMouseLeave={leave} onFocus={show} onBlur={leave} onClick={() => open ? setOpen(false) : show()} style={{ width: 36, height: 36, padding: 0, border: 0, background: 'transparent', color: '#40566D', cursor: 'pointer' }}><span aria-hidden="true" style={{ display: 'inline-flex', width: 16, height: 16, border: '1px solid currentColor', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>i</span></button>{open && createPortal(<div ref={popover} id={id} role="tooltip" onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={leave} style={{ position: 'fixed', zIndex: 1000, left: position.left, top: position.top, width: 280, maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', padding: 12, background: '#162332', color: '#fff', border: '1px solid #40566D', borderRadius: 6, overflowWrap: 'anywhere' }}>{children}</div>, document.body)}</>;
}
