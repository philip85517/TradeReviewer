"use client";

import Decimal from "decimal.js";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lifetimeCoverageNotice, type Amount as HomepageV25Metric, type HomeView } from "./display-contract";
import "./metric-cards.css";
import {hasUnalignedSplit, SubtotalEvidence} from "./confirmed-subtotal";
import {EvidenceAmount} from './evidence-amount';

type MetricCardsStatus = Readonly<{ kind: "ready" }> | Readonly<{ kind: "pending" | "error" | "empty"; reason: string }>;
export type MetricCardsView = HomeView;
/** Host supplies one committed view, including during pending/error. No local data cache. */
export type MetricCardsProps = Readonly<
  | { view: MetricCardsView; status: MetricCardsStatus }
  | { view: null; placeholderCurrency: string; status: Exclude<MetricCardsStatus, { kind: "ready" }> }
>;

const CARDS = [
  { key: "net", label: "期间净盈亏", definition: "期间已实现，加上期末与期初浮盈的差额。期间净盈亏 = 期间已实现 + 期末浮盈 − 期初浮盈。", signed: true },
  { key: "periodRealized", label: "期间已实现", definition: "按实际平仓日归属、扣除费用的已实现结果；部分平仓逐笔按平仓日期和金额归属。", signed: true },
  { key: "unrealizedChange", label: "期间浮盈变动", definition: "期末浮盈减期初浮盈，表示所选期间的浮盈变化。", signed: true },
  { key: "currentMarketValue", label: "当前持仓市值", definition: "最新可用行情下的当前持仓市值，独立于所选期间；不随期间切换。", signed: false },
] as const;
type MetricKey = typeof CARDS[number]["key"];
type Selection = { key: MetricKey; context: string; closing?: boolean };
type Readout = { metric: HomepageV25Metric | undefined; raw: string | null; reasons: string[] };
const unique = (items: readonly string[]) => [...new Set(items.filter(Boolean))];

// Compare the complete committed identity, independent of object/dictionary insertion order.
// The key is only for open-detail lifetime; it never caches or qualifies financial data.
function viewIdentity(view: MetricCardsView | null, placeholderCurrency: string): string {
  if (!view) return JSON.stringify([null, placeholderCurrency]);
  return JSON.stringify(view.stamp);
}

/** Presentation consistency only. The committed view owns amount availability. */
function readout(metric: HomepageV25Metric | undefined, reportCurrency: string, unavailable?: string): Readout {
  const mismatch = metric !== undefined && metric.currency !== reportCurrency;
  return { metric: unavailable ? undefined : metric, raw: !unavailable && !mismatch && metric && metric.value !== null ? metric.value : null,
    reasons: unique([...(metric?.reasons ?? []), ...(unavailable ? [unavailable] : []),
      ...(mismatch ? ["币种与报表不一致"] : []),
      ...(!unavailable && !metric ? ["当前范围没有可计算指标"] : []),
      ...(!unavailable && metric && (metric.value === null || metric.value === null) && !metric.reasons.length ? ["金额未知"] : [])]) };
}

// Unit scaling and rounding are display formatting only; detail retains the exact source string.
function formatPrimary(raw: string, signed: boolean): { number: string; unit: string; tone: string } {
  const amount = new Decimal(raw);
  const unit = amount.abs().gte(100_000_000) ? "亿" : amount.abs().gte(10_000) ? "万" : "";
  const shown = unit === "亿" ? amount.div(100_000_000) : unit === "万" ? amount.div(10_000) : amount;
  const formatted = shown.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return { number: `${signed && amount.gt(0) ? "+" : ""}${formatted}`, unit,
    tone: !signed || amount.isZero() ? "neutral" : amount.gt(0) ? "positive" : "negative" };
}

function MetricEvidence({ read, currency, accounts }: { read: Readout; currency: string; accounts?:HomeView['accounts'] }) {
  const metric = read.metric;
  return <>
    <dl className="hp-metric-cards__facts">
      <dt>完整金额</dt><dd>{read.raw === null ? "—" : <EvidenceAmount value={read.raw} currency={currency}/>}</dd>
      <dt>币种覆盖</dt><dd>{metric ? `${metric.coverage.available} / ${metric.coverage.total}` : "—"}</dd>
      <dt>原币金额</dt><dd>{metric && Object.keys(metric.originals).length
        ? Object.entries(metric.originals).map(([code, amount]) => <EvidenceAmount key={code} value={amount} currency={code}/>) : "未提供原币金额"}</dd>
      <dt>汇率来源</dt><dd>{metric?.fxSource ?? "未提供汇率来源"}</dd>
      {metric?.value !== null && metric?.value !== undefined && read.raw === null && <>
        <dt>来源金额</dt><dd>{metric.value} {metric.currency ?? "币种未知"}</dd>
      </>}
    </dl>
    {read.raw===null&&metric?.partial&&metric.partial.currency===currency&&<SubtotalEvidence partial={metric.partial} accounts={accounts}/>}
    {(metric?.valuationNotes ?? []).map(note => <p key={note}>{note}</p>)}
    {read.reasons.filter(reason => !(metric?.valuationNotes ?? []).includes(reason) && !reason.startsWith("拆股推算：")).length > 0 && <ul className="hp-metric-cards__reasons">{read.reasons.filter(reason => !(metric?.valuationNotes ?? []).includes(reason) && !reason.startsWith("拆股推算：")).map(reason => <li key={reason}>{reason}</li>)}</ul>}
  </>;
}

export function MetricCards(props: MetricCardsProps) {
  const { view, status } = props;
  const reportCurrency = props.view === null ? props.placeholderCurrency : props.view.stamp.reportCurrency;

  const context = viewIdentity(view, reportCurrency);
  const id = useId();
  const [selection, setSelection] = useState<Selection | null>(null);
  const triggers = useRef<Partial<Record<MetricKey, HTMLButtonElement | null>>>({});
  const dialog = useRef<HTMLDivElement>(null);
  const previousOpen = useRef<MetricKey | null>(null);
  const [position, setPosition] = useState({ left: 24, top: 24 });
  const sameContext = selection && selection.context === context;
  const presented = sameContext ? selection.key : null;
  const active = selection?.closing ? null : presented;
  // Invalidate before commit; returning to an earlier context is not a new activation.
  if (selection && !sameContext) setSelection(null);
  const definition = CARDS.find(card => card.key === presented);
  const closeDetail = useCallback(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setSelection(current => !current || current.closing ? current : reduced ? null : { ...current, closing: true });
  }, []);
  const read = (key: MetricKey) => readout(view?.metrics[key], reportCurrency);

  useLayoutEffect(() => {
    if (active && dialog.current) { dialog.current.scrollTop=0;dialog.current.focus(); }
    else if (previousOpen.current) triggers.current[previousOpen.current]?.focus();
    previousOpen.current = active;
  }, [active]);

  useLayoutEffect(() => {
    if (!active) return;
    function place() {
      const anchor = triggers.current[active!]?.getBoundingClientRect();
      const panel = dialog.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = document.documentElement.clientHeight || window.innerHeight;
      const top = anchor.bottom + 8 + panel.height <= height - 24 ? anchor.bottom + 8 : Math.max(24, anchor.top - panel.height - 8);
      setPosition({ left: Math.max(24, Math.min(anchor.left, width - panel.width - 24)), top });
    }
    place();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (dialog.current) observer?.observe(dialog.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [active, view, status, reportCurrency]);

  useEffect(() => {
    if (!selection?.closing) return;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const finish = () => setSelection(current => current?.closing ? null : current);
    if (motion?.matches) { finish(); return; }
    const timeout = window.setTimeout(finish, 160);
    const onMotionChange = (event: MediaQueryListEvent) => { if (event.matches) finish(); };
    motion?.addEventListener("change", onMotionChange);
    return () => { window.clearTimeout(timeout); motion?.removeEventListener("change", onMotionChange); };
  }, [selection]);

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); closeDetail(); } }
    function onOutside(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node) || dialog.current?.contains(target) || Object.values(triggers.current).some(trigger => trigger?.contains(target))) return;
      closeDetail();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onOutside);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", onOutside); };
  }, [active, closeDetail]);

  const currentUnrealized = readout(view?.currentUnrealized, reportCurrency);
  const detailMetric = presented ? view?.metrics[presented] : undefined;
  const detailReasons = new Set([...(detailMetric?.reasons ?? []), ...(detailMetric?.value === null
    ? detailMetric.partial?.missing.flatMap(item => item.reasons) ?? [] : [])]);
  const contextReasons = (view?.reasons ?? []).filter(reason => reason !== lifetimeCoverageNotice && !reason.startsWith("拆股推算：") && !detailReasons.has(reason));
  const periodContext = view ? `期间 ${view.request.period.from} 至 ${view.request.period.to} · 上海时区` : "期间数据尚不可用";
  return <section className="hp-metric-cards" aria-label="当前表现指标" aria-busy={status.kind === "pending"}>
    <div className="hp-metric-cards__grid">
      {CARDS.map(card => {
        const amount = read(card.key);
        const formatted = amount.raw === null ? { number: "—", unit: "", tone: "neutral" } : formatPrimary(amount.raw, card.signed);
        const partial=amount.raw===null&&amount.metric?.partial?.currency===reportCurrency?amount.metric.partial:null;
        const small=partial?.value===null||!partial?null:formatPrimary(partial.value,card.signed);
        const partialText=partial?`已确认小计 ${small?small.number+(small.unit?' '+small.unit:''):'—'}`:'';
        const coverageText = partial && `${partial.coverage.available} / ${partial.coverage.total} 项`;
        const singleMissing = partial && partial.coverage.total - partial.coverage.available === 1 && partial.missing.length === 1
          ? partial.missing[0] : undefined;
        const splitHint = singleMissing && hasUnalignedSplit(singleMissing.reasons) ? `${singleMissing.code} 拆股待核对` : null;
        return <article key={card.key} className="hp-metric-cards__card" aria-label={card.label}>
          <h3 id={`${id}-${card.key}-label`}>{card.label}({reportCurrency})</h3>
          {status.kind === "pending" && !view ? <div className="hp-metric-cards__skeleton" data-testid="hp-metric-skeleton" aria-label="金额加载中" />
            : <p key={`${reportCurrency}:${amount.raw ?? "unavailable"}`} className={`hp-metric-cards__value hp-metric-cards__value--${formatted.tone}`} data-testid="hp-metric-value" data-tone={formatted.tone}>
              <span className="hp-metric-cards__number">{formatted.number}</span>{formatted.unit && <span className="hp-metric-cards__unit"> {formatted.unit}</span>}
              {amount.raw !== null && !!amount.metric?.valuationNotes?.length && <span className="hp-estimate-label">含拆股推算</span>}
              {partial&&<span className="hp-metric-cards__partial"><span>{partialText}</span><span>{splitHint ? `已导入 ${partial.coverage.available}/${partial.coverage.total} 项 · ${splitHint}` : `已导入范围 ${coverageText}`}</span></span>}
            </p>}
          {status.kind === "pending" && view && <span className="hp-metric-cards__loading" aria-hidden="true">更新中</span>}
          <button className="hp-metric-cards__trigger" type="button" ref={node => { triggers.current[card.key] = node; }}
            aria-label={`${card.label}，${status.kind === "error" ? "查看原因" : "口径详情"}，${amount.raw === null ? "金额未知" : `完整金额 ${amount.raw} ${reportCurrency}`}${amount.metric?.valuationNotes?.length ? `；含拆股推算：${amount.metric.valuationNotes.join("；")}` : ""}${partial?`；${partialText} ${reportCurrency}，已导入范围 ${coverageText}`:""}${splitHint ? `，${splitHint}` : ""}`} aria-haspopup="dialog"
            aria-expanded={active === card.key} aria-controls={active === card.key ? `${id}-detail` : undefined}
            onClick={() => active === card.key ? closeDetail() : setSelection({ key: card.key, context })}>
            <span className={`hp-metric-cards__affordance${status.kind === "error" ? " hp-metric-cards__affordance--error" : ""}`}>
              {status.kind === "error" ? "查看原因" : "口径详情"}
            </span>
          </button>
        </article>;
      })}
    </div>
    {status.kind !== "ready" && <p className={`hp-metric-cards__status hp-metric-cards__status--${status.kind}`} role="status">{status.reason}</p>}
    {presented && definition && createPortal(<div id={`${id}-detail`} ref={dialog} role="dialog" aria-modal="false"
      aria-hidden={selection?.closing || undefined} inert={selection?.closing || undefined}
      aria-labelledby={`${id}-detail-title`} tabIndex={-1} className={`hp-metric-cards__detail${selection?.closing ? " hp-metric-cards__detail--closing" : ""}`} style={position}>
      <div className="hp-metric-cards__detail-header"><h4 id={`${id}-detail-title`}>{definition.label} · 口径详情</h4>
        <button type="button" aria-label="关闭详情" onClick={closeDetail}>×</button></div>
      <p>{definition.definition}</p>
      <p className="hp-metric-cards__context">{presented === "currentMarketValue" ? `当前时点 ${view?.stamp.asOf ?? "未知"}` : periodContext}</p>
      {status.kind !== "ready" && <p className="hp-metric-cards__notice">{status.reason}</p>}
      <MetricEvidence read={read(presented)} currency={reportCurrency} accounts={view?.accounts}/>
      {contextReasons.length > 0 && <ul className="hp-metric-cards__reasons">{unique(contextReasons).map(reason => <li key={reason}>{reason}</li>)}</ul>}
      {presented === "currentMarketValue" && <section aria-label="当前浮盈"><h5>当前浮盈</h5><MetricEvidence read={{...currentUnrealized, metric: currentUnrealized.metric ? {...currentUnrealized.metric, valuationNotes: currentUnrealized.metric.valuationNotes?.filter(note => !detailMetric?.valuationNotes?.includes(note))} : undefined}} currency={reportCurrency} accounts={view?.accounts}/></section>}
    </div>, document.body)}
  </section>;
}
