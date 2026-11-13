"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { presetRange, validateDateRange, type PracticeDatePreset, type PracticeDateRange } from "../../lib/library-preview/practice-date-range";
import "./practice-date-filter.css";

type Props = { value: PracticeDateRange; onChange: (value: PracticeDateRange) => void; now?: () => Date };

export function PracticeDateFilter(props: Props) {
  return <DateFilter {...props} />;
}
function DateFilter({ value, onChange, now = () => new Date("2026-10-15T04:00:00Z") }: Props) {
  const [panelState, setPanel] = useState<"day" | "range" | null>(null);
  const valueKey = JSON.stringify([value.from, value.to]);
  const previousValueKey = useRef(valueKey);
  const panel = panelState;
  const [draft, setDraft] = useState(value);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (previousValueKey.current === valueKey) return;
    previousValueKey.current = valueKey;
    if (panelRef.current?.contains(document.activeElement)) trigger.current?.focus();
    setPanel(null);
  }, [valueKey]);
  useLayoutEffect(() => {
    if (!panel) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const box = panelRef.current?.getBoundingClientRect();
      if (!anchor || !box) return;
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - box.width - 8));
      const below = anchor.bottom + 6;
      const top = below + box.height <= window.innerHeight - 8
        ? below : Math.max(8, Math.min(anchor.top - box.height - 6, window.innerHeight - box.height - 8));
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [panel]);
  useEffect(() => {
    if (panel) panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [Boolean(panel)]);
  useEffect(() => {
    if (!panel) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !panelRef.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [panel]);
  const error = panel === "day" ? (!draft.from ? "请选择日期" : validateDateRange({ from: draft.from, to: draft.from })) : validateDateRange(draft);
  function open(which: "day" | "range", button: HTMLButtonElement) { trigger.current = button; setDraft(value); setPanel(which); }
  function close() { setPanel(null); trigger.current?.focus(); }
  function selectPreset(preset: PracticeDatePreset) { close(); onChange(presetRange(preset, now())); }
  const label = !value.from && !value.to ? "全部日期" : `${value.from || "不限"} 至 ${value.to || "不限"}`;
  return <div ref={root} className="preview-date-filter" onBlur={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !panelRef.current?.contains(event.relatedTarget)) setPanel(null);
  }}>
    <span className="preview-date-filter-label">练习日期</span>
    <div className="preview-date-filter-controls" aria-label="练习日期筛选">
      <button type="button" aria-label={`练习日期：${label}`} aria-expanded={panel !== null} onClick={event => panel ? close() : open("range", event.currentTarget)}>{label}<CalendarDays size={16} aria-hidden="true" /></button>
    </div>
    {panel && createPortal(<div ref={panelRef} className="preview-date-filter-panel" style={position} onKeyDown={event => {
      if (event.key === "Escape") { event.stopPropagation(); close(); }
    }} onBlur={event => {
      if (event.relatedTarget instanceof Node && !panelRef.current?.contains(event.relatedTarget) && !root.current?.contains(event.relatedTarget)) setPanel(null);
    }} role="dialog" aria-label={panel === "day" ? "选择单日" : "自定义日期"}>
      <div className="preview-date-filter-presets">
        <button type="button" onClick={() => selectPreset("all")}>全部</button>
        <button type="button" aria-pressed={panel === "day"} onClick={() => { setDraft(value); setPanel("day"); }}>单日</button>
        <button type="button" onClick={() => selectPreset("week")}>本周</button>
        <button type="button" onClick={() => selectPreset("month")}>本月</button>
        <button type="button" onClick={() => selectPreset("year")}>本年</button>
        <button type="button" aria-pressed={panel === "range"} onClick={() => { setDraft(value); setPanel("range"); }}>区间</button>
      </div>
      <label>{panel === "day" ? "日期" : "开始日期"}<input type="date" value={draft.from} onChange={event => setDraft(current => ({ ...current, from: event.target.value }))} /></label>
      {panel === "range" && <label>结束日期<input type="date" value={draft.to} onChange={event => setDraft(current => ({ ...current, to: event.target.value }))} /></label>}
      {error && <p role="alert">{error}</p>}
      <div><button type="button" onClick={close}>取消</button><button type="button" disabled={Boolean(error)} onClick={() => { if (!error) { const next = panel === "day" ? { from: draft.from, to: draft.from } : draft; close(); onChange(next); } }}>应用</button></div>
    </div>, document.body)}
  </div>;
}
