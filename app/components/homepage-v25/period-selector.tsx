"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import type { HomepagePeriod } from "../../lib/reviews/homepage-v25-state";
import "./period-selector.css";

export type PeriodDraft = { from: string; to: string };
export type PeriodSelectorProps = {
  applied: HomepagePeriod;
  draft: PeriodDraft;
  open: boolean;
  pending: boolean;
  error: string | null;
  /** Shanghai civil YYYY-MM-DD, converted by the caller; never inferred from a clock. */
  today: string;
  /** Actual inclusive boundaries for all; null means unavailable, not an inferred range. */
  allRange: PeriodDraft | null;
  onDraftChange: (draft: PeriodDraft) => void;
  onOpenChange: (open: boolean) => void;
  onApply: (period: HomepagePeriod) => void;
};

const SHORTCUTS = [
  { preset: "ytd", label: "本年" },
  { preset: "month", label: "本月" },
  { preset: "week", label: "本周" },
] as const;

function civilDate(value: string): Date | null {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function shortcutPeriod(preset: "ytd" | "month" | "week", today: string): HomepagePeriod | null {
  const date = civilDate(today);
  if (!date) return null;
  if (preset === "ytd") return { preset, from: `${today.slice(0, 4)}-01-01`, to: today };
  if (preset === "month") return { preset, from: `${today.slice(0, 7)}-01`, to: today };
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return { preset, from: date.toISOString().slice(0, 10), to: today };
}

function fieldError(value: string, label: string): string | null {
  if (!value) return `请输入${label}`;
  return civilDate(value) ? null : `${label}格式应为 YYYY-MM-DD 且日期有效`;
}

function focusableControls(panel: HTMLElement | null): HTMLElement[] {
  return panel ? Array.from(panel.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled), [tabindex='0']")) : [];
}

export function PeriodSelector({
  applied, draft, open, pending, error, today, allRange, onDraftChange, onOpenChange, onApply,
}: PeriodSelectorProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const shortcutRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const wasOpen = useRef(false);
  const [focusedShortcut, setFocusedShortcut] = useState(() => Math.max(0, SHORTCUTS.findIndex(item => item.preset === applied.preset)));
  const fromError = fieldError(draft.from, "开始日期");
  const toError = fieldError(draft.to, "结束日期");
  const rangeError = !fromError && !toError && draft.from > draft.to ? "开始日期不能晚于结束日期" : null;
  const validDraft = !fromError && !toError && !rangeError;
  const validToday = civilDate(today) !== null;
  const range = applied.preset === "all" ? allRange : applied;
  const validRange = range && civilDate(range.from) && civilDate(range.to) && range.from <= range.to;
  const rangeDescription = validRange ? `${range.from} 至 ${range.to}`
    : applied.preset === "all" ? "全部期间，起止日期暂不可用" : "起止日期暂不可用";
  const rangeLabel = validRange ? `${range.from} — ${range.from.slice(0, 4) === range.to.slice(0, 4) ? range.to.slice(5) : range.to}`
    : applied.preset === "all" ? "全部期间 · 日期暂不可用" : "日期暂不可用";
  const pendingId = `${id}-pending`;
  const errorId = `${id}-request-error`;
  const todayErrorId = `${id}-today-error`;
  const hintId = `${id}-format`;
  const fromErrorId = `${id}-from-error`;
  const toErrorId = `${id}-to-error`;
  const rangeErrorId = `${id}-range-error`;

  useEffect(() => {
    if (open && !wasOpen.current) focusableControls(panelRef.current)[0]?.focus();
    if (!open && wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const toolbar = toolbarRef.current;
    const panel = panelRef.current;
    if (!root || !toolbar || !panel) return;
    const placePopover = () => {
      const rootBounds = root.getBoundingClientRect();
      const toolbarBounds = toolbar.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const left = Math.max(24, Math.min(toolbarBounds.left, viewportWidth - 24 - panel.getBoundingClientRect().width));
      panel.style.left = `${left - rootBounds.left}px`;
      panel.style.top = `${toolbarBounds.bottom - rootBounds.top + 24}px`;
    };
    // Measure before paint, keeping the original overlay width and the toolbar's 24px gap.
    placePopover();
    window.addEventListener("resize", placePopover);
    window.addEventListener("scroll", placePopover, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(placePopover);
    observer?.observe(root);
    observer?.observe(toolbar);
    observer?.observe(panel);
    return () => {
      window.removeEventListener("resize", placePopover);
      window.removeEventListener("scroll", placePopover, true);
      observer?.disconnect();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      // Consume only this dismissal click before an outside shortcut can request another period.
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(false);
    };
    document.addEventListener("click", onOutsideClick, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onOutsideClick, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const moveShortcutFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % SHORTCUTS.length;
    else if (event.key === "ArrowLeft") next = (index + SHORTCUTS.length - 1) % SHORTCUTS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = SHORTCUTS.length - 1;
    else return;
    event.preventDefault();
    setFocusedShortcut(next);
    shortcutRefs.current[next]?.focus();
  };

  const keepDialogBoundary = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Tab") return;
    const controls = focusableControls(panelRef.current);
    if (event.shiftKey && event.target === controls[0]) {
      event.preventDefault();
      triggerRef.current?.focus();
    } else if (!event.shiftKey && event.target === controls.at(-1)) {
      event.preventDefault();
      controls[0]?.focus();
    }
  };

  const requestFeedback = <>
    {pending && <p className="hp-period-selector__message" id={pendingId} role="status" tabIndex={0}>
      正在应用新期间，保留原已生效期间；请等待完成。
    </p>}
    {error && !pending && <p className="hp-period-selector__message hp-period-selector__error" id={errorId} role="alert" tabIndex={0}>
      新选择未应用，已保留原期间。{error}
    </p>}
  </>;

  return <div className="hp-period-selector" ref={rootRef}>
    <div className="hp-period-selector__toolbar" ref={toolbarRef}>
      <div className="hp-period-selector__shortcuts" role="group" aria-label="快捷期间">
        {SHORTCUTS.map(({ preset, label }, index) => <button key={preset} type="button"
          className="hp-period-selector__shortcut"
          ref={element => { shortcutRefs.current[index] = element; }}
          aria-pressed={applied.preset === preset}
          aria-disabled={pending || !validToday}
          aria-describedby={!validToday ? todayErrorId : pending ? pendingId : error ? errorId : undefined}
          disabled={!validToday}
          tabIndex={focusedShortcut === index ? 0 : -1}
          onFocus={() => setFocusedShortcut(index)}
          onKeyDown={event => moveShortcutFocus(event, index)}
          onClick={() => {
            if (pending) return;
            const period = shortcutPeriod(preset, today);
            if (period) onApply(period);
          }}
        >{label}</button>)}
      </div>
      <button type="button" className="hp-period-selector__trigger" ref={triggerRef}
        aria-label={`自定义日期，当前期间 ${rangeDescription}`} title={rangeDescription}
        aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? `${id}-dialog` : undefined}
        onClick={() => onOpenChange(!open)}>
        <CalendarDays size={16} aria-hidden="true" focusable="false" />
        <span>{rangeLabel}</span>
      </button>
    </div>
    {!validToday && <p className="hp-period-selector__message hp-period-selector__error" id={todayErrorId}>
      上海日期不可用，请提供有效日期后使用快捷期间；仍可编辑自定义日期。
    </p>}
    {!open && requestFeedback}
    {open && <form className="hp-period-selector__popover" ref={panelRef} id={`${id}-dialog`}
      role="dialog" aria-labelledby={`${id}-heading`} aria-busy={pending} noValidate
      onKeyDown={keepDialogBoundary}
      onSubmit={event => {
        event.preventDefault();
        if (validDraft && !pending) onApply({ preset: "custom", from: draft.from, to: draft.to });
      }}>
      <h3 id={`${id}-heading`}>自定义日期</h3>
      <span className="hp-period-selector__sr-only" id={hintId}>日期格式 YYYY-MM-DD，开始和结束日期均包含在内。</span>
      <div className="hp-period-selector__fields">
        <label className="hp-period-selector__field">
          <span className="hp-period-selector__sr-only">开始日期</span>
          <CalendarDays size={16} aria-hidden="true" focusable="false" />
          <input type="text" inputMode="numeric" placeholder="YYYY-MM-DD" autoComplete="off" spellCheck={false}
            value={draft.from} disabled={pending} aria-invalid={Boolean(fromError || rangeError)}
            aria-describedby={[hintId, fromError && fromErrorId, rangeError && rangeErrorId].filter(Boolean).join(" ")}
            onChange={event => onDraftChange({ ...draft, from: event.currentTarget.value })} />
        </label>
        <label className="hp-period-selector__field">
          <span className="hp-period-selector__sr-only">结束日期</span>
          <CalendarDays size={16} aria-hidden="true" focusable="false" />
          <input type="text" inputMode="numeric" placeholder="YYYY-MM-DD" autoComplete="off" spellCheck={false}
            value={draft.to} disabled={pending} aria-invalid={Boolean(toError || rangeError)}
            aria-describedby={[hintId, toError && toErrorId, rangeError && rangeErrorId].filter(Boolean).join(" ")}
            onChange={event => onDraftChange({ ...draft, to: event.currentTarget.value })} />
        </label>
      </div>
      {(fromError || toError || rangeError) && <div className="hp-period-selector__validation" aria-live="polite">
        {fromError && <p id={fromErrorId} tabIndex={0}>{fromError}</p>}
        {toError && <p id={toErrorId} tabIndex={0}>{toError}</p>}
        {rangeError && <p id={rangeErrorId} tabIndex={0}>{rangeError}</p>}
      </div>}
      {requestFeedback}
      <div className="hp-period-selector__actions">
        <button type="submit" className="hp-period-selector__apply" disabled={!validDraft || pending}
          aria-describedby={pending ? pendingId : !validDraft ? [fromError && fromErrorId, toError && toErrorId, rangeError && rangeErrorId].filter(Boolean).join(" ") : error ? errorId : undefined}>
          {pending ? "应用中…" : "应用"}
        </button>
        <button type="button" className="hp-period-selector__cancel" onClick={() => onOpenChange(false)}>取消</button>
      </div>
    </form>}
  </div>;
}
