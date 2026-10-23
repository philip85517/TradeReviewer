"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from "react";
import type { HomepageAttachments } from "../../lib/reviews/homepage-v25-state";
import "./attachment-filter.css";

export type AttachmentFilterPopoverProps = {
  open: boolean;
  draft: HomepageAttachments;
  pending: boolean;
  error: string | null;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onDraft: (attachments: HomepageAttachments) => void;
  onApply: () => void;
  onClear: () => void;
  onReset: () => void;
  onCancel: (reason: "escape" | "outside") => void;
};
/** D is controlled by S v3. This editor never owns or commits applied state. */
export function AttachmentFilterPopover({ open, draft, pending, error, triggerRef, onDraft, onApply, onClear, onReset, onCancel }: AttachmentFilterPopoverProps) {
  const panel = useRef<HTMLFormElement>(null);
  const wasOpen = useRef(false);
  const id = useId();
  const unsupported = draft.categories.filter(category => category !== "stock" && category !== "etf");
  useEffect(() => {
    if (open && !wasOpen.current) {
      const first = panel.current?.querySelector<HTMLInputElement>('input:not(:disabled)');
      (first ?? panel.current)?.focus();
    } else if (!open && wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open, triggerRef]);
  useEffect(() => {
    // Disabled fields must not strand focus outside the pending editor. Esc and
    // Tab still work while its request is waiting; S owns cancellation.
    if (open && pending) panel.current?.focus();
  }, [open, pending]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || panel.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      onCancel("outside");
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, onCancel, triggerRef]);
  function edit(next: HomepageAttachments) { if (!pending) onDraft(next); }
  function category(value: string, checked: boolean) {
    edit({ ...draft, categories: checked ? [...new Set([...draft.categories, value])].sort() : draft.categories.filter(item => item !== value) });
  }
  function review(value: boolean, checked: boolean) {
    edit({ ...draft, pendingReview: [...new Set(checked ? [...draft.pendingReview, value] : draft.pendingReview.filter(item => item !== value))].sort((a, b) => Number(a) - Number(b)) });
  }
  function keyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel("escape"); return; }
    if (event.key === "Enter" && !(event.target instanceof Element && event.target.closest("button"))) {
      event.preventDefault(); if (!pending) onApply(); return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex="0"]') ?? [])];
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); panel.current?.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <form ref={panel} role="dialog" aria-label="附加筛选" aria-busy={pending} aria-hidden={!open} inert={!open} tabIndex={-1}
    className="hp-attachment-filter" data-open={open} onKeyDown={keyDown}
    onSubmit={event => { event.preventDefault(); if (!pending) onApply(); }}>
    <fieldset className="hp-attachment-filter__section">
      <legend>类别</legend>
      <label className="hp-attachment-filter__field"><input type="checkbox" checked={draft.categories.includes("stock")} disabled={pending} onChange={event => category("stock", event.target.checked)} />股票</label>
      <label className="hp-attachment-filter__field"><input type="checkbox" checked={draft.categories.includes("etf")} disabled={pending} onChange={event => category("etf", event.target.checked)} />ETF</label>
      <label className="hp-attachment-filter__field hp-attachment-filter__field--unavailable"><input type="checkbox" checked={draft.categories.includes("fund")} disabled aria-describedby={`${id}-fund`} readOnly />基金</label>
      <p id={`${id}-fund`} className="hp-attachment-filter__note">尚不支持基金类别：缺少可信分类数据</p>
      {unsupported.length > 0 && <p className="hp-attachment-filter__note">保留的未支持条件：{unsupported.join("、")}</p>}
    </fieldset>
    <fieldset className="hp-attachment-filter__section">
      <legend>持仓状态</legend>
      <label className="hp-attachment-filter__field"><input type="checkbox" checked={draft.openOnly} disabled={pending} onChange={event => edit({ ...draft, openOnly: event.target.checked })} />仅看未平仓持仓</label>
    </fieldset>
    <fieldset className="hp-attachment-filter__section">
      <legend>是否待复盘</legend>
      <label className="hp-attachment-filter__field"><input type="checkbox" aria-label="待复盘：是" checked={draft.pendingReview.includes(true)} disabled={pending} onChange={event => review(true, event.target.checked)} />是</label>
      <label className="hp-attachment-filter__field"><input type="checkbox" aria-label="待复盘：否" checked={draft.pendingReview.includes(false)} disabled={pending} onChange={event => review(false, event.target.checked)} />否</label>
    </fieldset>
    {error && <p role="alert" tabIndex={0} className="hp-attachment-filter__error">{error}</p>}
    {pending && <p role="status" className="hp-attachment-filter__note">正在应用，页面保留原已生效范围</p>}
    <div className="hp-attachment-filter__actions">
      <button type="submit" className="hp-attachment-filter__apply" disabled={pending}>应用</button>
      <button type="button" disabled={pending} onClick={onClear}>清除附加条件</button>
      <button type="button" disabled={pending} onClick={onReset}>恢复全部默认</button>
    </div>
  </form>;
}
