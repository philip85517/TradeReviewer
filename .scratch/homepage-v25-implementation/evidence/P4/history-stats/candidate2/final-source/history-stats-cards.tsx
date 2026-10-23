"use client";

import Decimal from "decimal.js";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { HomepageV25Metric } from "../../lib/reviews/homepage-v25-performance";
import "./history-stats-cards.css";

export type HistoryStatsObservation = Readonly<{ value: string | null; available: boolean; reasons: readonly string[] }>;
export type HistoryStatsMoney = Readonly<Omit<HomepageV25Metric, "coverage" | "reasons" | "money"> & {
  coverage: Readonly<HomepageV25Metric["coverage"]>;
  reasons: readonly string[];
  money: Readonly<Omit<HomepageV25Metric["money"], "fx"> & { fx: Readonly<NonNullable<HomepageV25Metric["money"]["fx"]>> | null }>;
}>;
export type HistoryStatsSummary = Readonly<{
  closedNet: HistoryStatsMoney;
  allocatedFees: HistoryStatsMoney;
  closedRounds: HistoryStatsObservation;
  winningRounds: HistoryStatsObservation;
  /** Already committed percentage in 0..100 units, never a ratio to calculate here. */
  winRate: HistoryStatsObservation;
}>;
export type HistoryStatsCardsProps = Readonly<{
  /** Caller retains the complete committed summary through pending/error. No local financial cache. */
  summary: HistoryStatsSummary | null;
  reportCurrency: string;
  sourceId: string | null;
  requestGeneration: string | null;
  status: Readonly<{ kind: "ready" }> | Readonly<{ kind: "pending" | "error" | "empty"; reason: string }>;
}>;

const CARDS = [
  { key: "closedNet", name: "已平仓净盈亏", label: "已平仓净盈亏", definition: "所选范围内已结束回合扣除分摊费用后的净盈亏，按实际平仓时间归属。未完成回合不计入。" },
  { key: "closedRounds", name: "已平仓回合数", label: "已平仓回合", definition: "所选范围内已经结束的完整交易回合数量；部分平仓与未结束回合不单独算作已平仓回合。金额未知不等于回合数未知。" },
  { key: "winRate", name: "胜率", label: "范围胜率", definition: "所选范围已提交的盈利回合占比，同时列出盈利回合数与已平仓总回合数。持平和未知回合的口径由数据来源说明；不使用分期胜率的平均值。" },
  { key: "allocatedFees", name: "已扣费用", label: "费用（已扣除）", definition: "已经分摊至所选范围已平仓回合、并在净盈亏中扣除的费用，包含相应开仓与平仓成本。未结束回合的费用不混入。" },
] as const;
type CardKey = typeof CARDS[number]["key"];
type Readout = { raw: string | null; reasons: string[] };
type MoneyReadout = Readout & { metric: HistoryStatsMoney | undefined };
type Selection = { key: CardKey; sourceId: string | null; generation: string | null; currency: string; closing?: boolean };
const unique = (items: readonly string[]) => [...new Set(items.filter(Boolean))];

/** Validate presentation inputs only; never infer one statistic from another. */
function decimal(raw: string | null | undefined): Decimal | null {
  if (raw === null || raw === undefined || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return null;
  try { const value = new Decimal(raw); return value.isFinite() ? value : null; } catch { return null; }
}
function scalarRead(observation: HistoryStatsObservation | undefined, percentage = false): Readout {
  const value = decimal(observation?.value);
  const valid = value !== null && value.gte(0) && (percentage ? value.lte(100) : value.isInteger());
  const invalid = observation?.value !== null && observation?.value !== undefined && !valid;
  return { raw: observation?.available && valid ? observation.value : null,
    reasons: unique([...(observation?.reasons ?? []), ...(invalid ? [percentage ? "百分比格式无效" : "回合数格式无效"] : []),
      ...(!observation || !observation.available || observation.value === null ? [percentage ? "胜率未知" : "回合数未知"] : [])]) };
}
function moneyRead(metric: HistoryStatsMoney | undefined, currency: string): MoneyReadout {
  const valid = decimal(metric?.value) !== null;
  const mismatch = metric !== undefined && metric.money.targetCurrency !== currency;
  return { metric, raw: metric?.available && valid && !mismatch ? metric.value : null,
    reasons: unique([...(metric?.reasons ?? []), ...(metric?.value !== null && metric?.value !== undefined && !valid ? ["金额格式无效"] : []),
      ...(mismatch ? ["币种与报表不一致"] : []), ...(!metric || !metric.available || metric.value === null ? ["金额未知"] : [])]) };
}
const grouped = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function amountDisplay(raw: string, signed: boolean) {
  const value = new Decimal(raw);
  const unit = value.abs().gte(100_000_000) ? "亿" : value.abs().gte(10_000) ? "万" : "";
  const shown = unit === "亿" ? value.div(100_000_000) : unit === "万" ? value.div(10_000) : value;
  return { number: `${signed && value.gt(0) ? "+" : ""}${grouped(shown.toFixed(2))}`, unit,
    tone: !signed || value.isZero() ? "neutral" : value.gt(0) ? "positive" : "negative" };
}
function MoneyEvidence({ read, currency }: { read: MoneyReadout; currency: string }) {
  const metric = read.metric;
  return <>
    <dl className="hp-history-stats__facts">
      <dt>完整金额</dt><dd>{read.raw === null ? "—" : `${read.raw} ${currency}`}</dd>
      <dt>覆盖数量</dt><dd>{metric ? `${metric.coverage.available} / ${metric.coverage.total}` : "—"}</dd>
      <dt>原币金额</dt><dd>{metric && Object.keys(metric.money.originalByCurrency).length
        ? Object.entries(metric.money.originalByCurrency).map(([code, amount]) => <span key={code}>{amount} {code}</span>) : "未提供原币金额"}</dd>
      <dt>汇率来源</dt><dd>{metric?.money.fx ? <>
        <span>{metric.money.fx.source}</span><span>{metric.money.fx.asOf} · {metric.money.fx.id} · {metric.money.fx.status}</span>
      </> : metric?.money.conversion === "same-currency" ? "同币种，无需换汇" : "未提供汇率来源"}</dd>
      {metric?.value !== null && metric?.value !== undefined && read.raw === null && <><dt>来源金额</dt><dd>{metric.value} {metric.money.targetCurrency ?? "币种未知"}</dd></>}
    </dl>
    <Reasons reasons={read.reasons} />
  </>;
}
function Reasons({ reasons }: { reasons: readonly string[] }) {
  return reasons.length > 0 ? <ul className="hp-history-stats__reasons">{unique(reasons).map(reason => <li key={reason}>{reason}</li>)}</ul> : null;
}

export function HistoryStatsCards({ summary, reportCurrency, sourceId, requestGeneration, status }: HistoryStatsCardsProps) {
  const id = useId();
  const [selection, setSelection] = useState<Selection | null>(null);
  const triggers = useRef<Partial<Record<CardKey, HTMLButtonElement | null>>>({});
  const dialog = useRef<HTMLDivElement>(null);
  const previousOpen = useRef<CardKey | null>(null);
  const [position, setPosition] = useState({ left: 24, top: 24 });
  const sameContext = selection && selection.sourceId === sourceId && selection.generation === requestGeneration && selection.currency === reportCurrency;
  const presented = sameContext ? selection.key : null;
  const active = selection?.closing ? null : presented;
  // Context invalidation is permanent, including an A→B→A return before another click.
  if (selection && !sameContext) setSelection(null);
  const definition = CARDS.find(card => card.key === presented);
  const net = moneyRead(summary?.closedNet, reportCurrency);
  const fees = moneyRead(summary?.allocatedFees, reportCurrency);
  const rounds = scalarRead(summary?.closedRounds);
  const wins = scalarRead(summary?.winningRounds);
  const rate = scalarRead(summary?.winRate, true);
  const reads = { closedNet: net, closedRounds: rounds, winRate: rate, allocatedFees: fees };
  // Every displayed value subtree replaces in this same render; triggers never remount.
  const committedReadingsKey = JSON.stringify([reportCurrency, net.raw, rounds.raw, rate.raw, wins.raw, fees.raw, status.kind === "pending" && !summary]);
  const closeDetail = useCallback(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setSelection(current => !current || current.closing ? current : reduced ? null : { ...current, closing: true });
  }, []);

  useLayoutEffect(() => {
    if (active) dialog.current?.focus();
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
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { observer?.disconnect(); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [active, summary, status, reportCurrency]);

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
    document.addEventListener("keydown", onKey); document.addEventListener("click", onOutside);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", onOutside); };
  }, [active, closeDetail]);

  const ratioLabel = `盈利回合 ${wins.raw ?? "未知"} / 总回合 ${rounds.raw ?? "未知"}`;
  return <section className="hp-history-stats" aria-label="历史已平仓指标" aria-busy={status.kind === "pending"}>
    <div className="hp-history-stats__grid">
      {CARDS.map(card => {
        const read = reads[card.key];
        const isMoney = card.key === "closedNet" || card.key === "allocatedFees";
        const display = read.raw === null ? { number: "—", unit: "", tone: "unknown" }
          : isMoney ? amountDisplay(read.raw, card.key === "closedNet")
          : { number: card.key === "winRate" ? `${new Decimal(read.raw).toFixed(1).replace(/\.0$/, "")}%` : grouped(new Decimal(read.raw).toFixed(0)), unit: "", tone: "neutral" };
        const exact = read.raw === null ? "读数未知" : `完整读数 ${read.raw}${isMoney ? ` ${reportCurrency}` : card.key === "winRate" ? "%" : " 回合"}`;
        return <article key={card.key} className={`hp-history-stats__card hp-history-stats__card--${card.key}`} aria-label={card.name}>
          <div className="hp-history-stats__content">
            <h3>{card.label}{isMoney && <span className="hp-history-stats__currency">({reportCurrency})</span>}</h3>
            <div key={committedReadingsKey} className="hp-history-stats__readings">
              {status.kind === "pending" && !summary
                ? <div className="hp-history-stats__skeleton" data-testid="hp-history-stat-skeleton" aria-label="读数加载中" />
                : <p className={`hp-history-stats__value hp-history-stats__value--${display.tone}`} data-testid="hp-history-stat-value" data-tone={display.tone}>
                  <span className="hp-history-stats__number">{display.number}</span>{display.unit && <span className="hp-history-stats__unit"> {display.unit}</span>}
                </p>}
              {card.key === "winRate" && !(status.kind === "pending" && !summary) && <span className="hp-history-stats__ratio" aria-label={ratioLabel} title={ratioLabel}>
                <span className="hp-history-stats__ratio-prefix" aria-hidden="true">盈利回合</span>
                <span className="hp-history-stats__ratio-count" aria-hidden="true">{wins.raw === null ? "—" : grouped(new Decimal(wins.raw).toFixed(0))} / {rounds.raw === null ? "—" : grouped(new Decimal(rounds.raw).toFixed(0))}</span>
                <span className="hp-history-stats__ratio-suffix" aria-hidden="true"> 盈利回合</span>
              </span>}
            </div>
          </div>
          {status.kind === "pending" && summary && <span className="hp-history-stats__update" aria-hidden="true">更新中</span>}
          <button type="button" className="hp-history-stats__trigger" ref={node => { triggers.current[card.key] = node; }}
            aria-label={`${card.name}，${status.kind === "error" ? "查看原因" : "口径详情"}，${exact}${card.key === "winRate" ? `，${ratioLabel}` : ""}`}
            aria-haspopup="dialog" aria-expanded={active === card.key} aria-controls={active === card.key ? `${id}-detail` : undefined}
            onClick={() => active === card.key ? closeDetail() : setSelection({ key: card.key, sourceId, generation: requestGeneration, currency: reportCurrency })}>
            <span className={`hp-history-stats__affordance${status.kind === "error" ? " hp-history-stats__affordance--error" : ""}`}>
              {status.kind === "error" ? "查看原因" : "口径详情"}
            </span>
          </button>
        </article>;
      })}
    </div>
    {status.kind !== "ready" && <p className={`hp-history-stats__status hp-history-stats__status--${status.kind}`} role="status">{status.reason}</p>}
    {presented && definition && createPortal(<div id={`${id}-detail`} ref={dialog} role="dialog" aria-modal="false"
      aria-hidden={selection?.closing || undefined} inert={selection?.closing || undefined} aria-labelledby={`${id}-detail-title`} tabIndex={-1}
      className={`hp-history-stats__detail${selection?.closing ? " hp-history-stats__detail--closing" : ""}`} style={position}>
      <div className="hp-history-stats__detail-header"><h4 id={`${id}-detail-title`}>{definition.name} · 口径详情</h4>
        <button type="button" aria-label="关闭详情" onClick={closeDetail}>×</button></div>
      <p>{definition.definition}</p>
      {status.kind !== "ready" && <p className={`hp-history-stats__notice hp-history-stats__notice--${status.kind}`}>{status.reason}</p>}
      {presented === "closedNet" || presented === "allocatedFees" ? <MoneyEvidence read={presented === "closedNet" ? net : fees} currency={reportCurrency} />
        : presented === "closedRounds" ? <>
          <dl className="hp-history-stats__facts"><dt>完整回合数</dt><dd>{rounds.raw ?? "—"}</dd></dl><Reasons reasons={rounds.reasons} />
        </> : <>
          <dl className="hp-history-stats__facts"><dt>完整胜率</dt><dd>{rate.raw === null ? "—" : `${rate.raw}%`}</dd>
            <dt>盈利回合</dt><dd>{wins.raw ?? "—"}</dd><dt>已平仓总回合</dt><dd>{rounds.raw ?? "—"}</dd></dl>
          <Reasons reasons={[...rate.reasons, ...wins.reasons, ...rounds.reasons]} />
        </>}
    </div>, document.body)}
  </section>;
}
