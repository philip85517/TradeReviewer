"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { HomepagePeriod, HomepageState } from "../../lib/reviews/homepage-v25-state";
import type { HomepagePeriodView } from "./financial-view-model";
import { MetricCards } from "./metric-cards";
import { PerformanceChart } from "./performance-chart";
import { PeriodSelector, type PeriodDraft } from "./period-selector";
import "./period-surface.css";

export type PeriodSurfaceProps = Readonly<{
  view: HomepagePeriodView | null;
  ui: Pick<HomepageState, "snapshot" | "requests" | "errors" | "timeouts">;
  ready: boolean;
  active: boolean;
  statusId: string;
  onApply: (period: HomepagePeriod) => boolean;
}>;

const shanghaiDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
function draftFor(view: HomepagePeriodView | null): PeriodDraft {
  if (!view) return { from: "", to: "" };
  return view.range.preset === "all"
    ? { from: view.bounds.start ?? "", to: view.bounds.end ?? "" }
    : { from: view.range.from, to: view.range.to };
}

/** Owns editing only. All financial presentations receive the same committed view. */
export function PeriodSurface({ view, ui, ready, active, statusId, onApply }: PeriodSurfaceProps) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const source = view ? JSON.stringify([view.stamp.sourceId, view.stamp.selectionKey, view.stamp.revisions, view.stamp.policies, view.stamp.asOf, view.stamp.reportCurrency]) : null;
  const [editing, setEditing] = useState(() => ({ source, draft: draftFor(view), open: false }));
  // A new global source resets its editor. Local failure never replaces the typed draft
  // or writes host.periodDraft (which is the last submitted retry target).
  if (editing.source !== source) setEditing({ source, draft: draftFor(view), open: false });
  const globalBlocked = !active || !ready || Boolean(ui.requests.global);
  const localPending = Boolean(ui.requests.period);
  const open = editing.open && !globalBlocked;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && globalBlocked) heading.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open, globalBlocked]);
  // Forget a forced close so completing a global request cannot reopen the popup.
  if (editing.open && globalBlocked) setEditing({ ...editing, open: false });
  const error = ui.errors.period ? ui.timeouts.period ? "期间读取已超时，仍显示原期间。" : ui.errors.period : null;
  const reason = globalBlocked ? "正在读取范围，仍显示已提交数据。" : localPending ? "正在应用期间，仍显示原期间。" : error;
  const status = reason ? { kind: globalBlocked || localPending ? "pending" as const : "error" as const, reason } : { kind: "ready" as const };
  const blocked = globalBlocked || (localPending && !open);
  return <section className="hp-period-surface" aria-labelledby={`${id}-title`}>
    <div className="hp-period-surface__toolbar">
      <h2 ref={heading} id={`${id}-title`} tabIndex={-1}>当前表现</h2>
      <fieldset className="hp-period-surface__controls" disabled={blocked} aria-label="期间选择" aria-busy={globalBlocked || localPending} aria-describedby={statusId}>
        {view ? <PeriodSelector applied={view.range} draft={editing.draft} open={open}
          pending={open && localPending} error={open ? error : null}
          today={shanghaiDate.format(new Date(view.stamp.asOf))}
          allRange={view.range.preset === "all" && view.bounds.state === "known" ? { from: view.bounds.start, to: view.bounds.end } : null}
          onDraftChange={draft => setEditing(current => ({ ...current, draft }))}
          onOpenChange={next => { if (!next || (!globalBlocked && !localPending)) setEditing(current => ({ ...current, open: next })); }}
          onApply={period => { if (!globalBlocked && !localPending) onApply(period); }} />
          : <div className="hp-period-surface__placeholder"><div>{["本年", "本月", "本周"].map(label => <button type="button" disabled key={label}>{label}</button>)}</div><button type="button" disabled>期间数据读取中</button></div>}
      </fieldset>
    </div>
    {view ? <MetricCards view={view} status={status} /> : <MetricCards view={null} placeholderCurrency="CNY" status={{ kind: ui.errors.global ? "error" : "pending", reason: ui.errors.global ?? "正在读取当前表现" }} />}
    <PerformanceChart series={view?.series ?? null} reportCurrency={view?.stamp.reportCurrency ?? "CNY"}
      unavailableReason={!view ? "期间数据尚未就绪" : undefined} />
  </section>;
}
