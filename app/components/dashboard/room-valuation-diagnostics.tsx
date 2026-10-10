"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import type { CashSummary } from "../../lib/cash/cash-model";
import type { TradingRoomQualityDimensionId } from "../../lib/reviews/trading-room-quality";
import type { CurrentPortfolioModel } from "../../lib/reviews/trading-room-portfolio";
import styles from "./room-valuation-diagnostics.module.css";

export type RoomValuationDiagnosticGroupId = "valuation" | "holding" | "record";

export type RoomValuationDiagnostic = {
  id: string;
  group: RoomValuationDiagnosticGroupId;
  label: string;
  reason: string;
  category: string;
  instrumentId?: string;
  episodeId?: string;
  at?: string | null;
  action: "retry-valuation" | "open-data-check";
  dimension: TradingRoomQualityDimensionId;
};

export type BuildRoomValuationDiagnosticsOptions = {
  model: CurrentPortfolioModel;
  cashSummary?: CashSummary | null;
  additionalReasons?: readonly string[];
};

export type RoomValuationDiagnosticsProps = BuildRoomValuationDiagnosticsOptions & {
  onRetryValuation?: () => void;
  onOpenDataCheck?: (
    dimension: TradingRoomQualityDimensionId,
    ids: readonly string[],
    episodeId?: string,
  ) => void;
};

const GROUP_LABELS: Record<RoomValuationDiagnosticGroupId, string> = {
  valuation: "行情与估值",
  holding: "持仓数据",
  record: "现金与记录",
};

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function rowLabel(row: CurrentPortfolioModel["rows"][number]): string {
  return row.holding.instrumentName || row.holding.symbol || row.holding.instrumentId || row.holding.episodeId;
}

function rowReasons(row: CurrentPortfolioModel["rows"][number]): string[] {
  const reasons = [...(row.reasons ?? [])];
  const quoteGap = row.holding.quoteStatus !== "available" || !row.holding.quote || !row.holding.quote.price;
  if (quoteGap && row.marketValue === null && !reasons.some(reason => /行情|报价|市值/.test(reason))) reasons.push("缺少可信行情，市值不可用");
  if (row.holding.quantity === null && !reasons.some(reason => reason.includes("数量"))) reasons.push("持仓数量待核对");
  if (row.cost === null && !reasons.some(reason => reason.includes("成本"))) reasons.push("剩余成本待核对");
  if (row.holding.direction === "unknown" && !reasons.some(reason => reason.includes("方向"))) reasons.push("多空方向待核对");
  if (!row.holding.settlementCurrency && !reasons.some(reason => reason.includes("币种"))) reasons.push("结算币种待核对");
  return unique(reasons);
}

function reasonGroups(reason: string, row: CurrentPortfolioModel["rows"][number]): RoomValuationDiagnosticGroupId[] {
  const groups = new Set<RoomValuationDiagnosticGroupId>();
  const quoteGap = row.holding.quoteStatus !== "available" || !row.holding.quote || !row.holding.quote.price;
  if (/币种|现金|成交|账户|记录/.test(reason)) groups.add("record");
  if (/数量|成本|方向|空头收益率分母|持仓/.test(reason)) groups.add("holding");
  if (/行情|报价|市值|估值/.test(reason) && quoteGap) groups.add("valuation");
  if (groups.size === 0) groups.add(quoteGap ? "valuation" : "holding");
  return [...groups];
}

/** Normalize only known diagnostic semantics; unknown text remains lossless. */
export function diagnosticReasonCategory(reason: string): string {
  if (/实盘|模拟|性质未知/.test(reason) && /未知|未配置|缺失/.test(reason)) return "实盘/模拟性质未知";
  if (/现金基准|基准现金|现金.*基准/.test(reason)) return "现金基准缺失";
  if (/汇率|换算/.test(reason)) return "换算汇率缺口";
  if (/行情|报价|市值|估值/.test(reason)) return "行情与估值缺口";
  if (/数量/.test(reason)) return "持仓数量缺口";
  if (/成本/.test(reason)) return "持仓成本缺口";
  if (/方向|多空|空头/.test(reason)) return "多空方向缺口";
  if (/币种|现金|成交|账户|记录/.test(reason)) return "现金与记录缺口";
  return reason;
}

function stableDiagnosticId(parts: readonly string[], seen: Map<string, number>): string {
  const base = parts.map(part => encodeURIComponent(part || "unknown")).join(":");
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}:duplicate-${count}`;
}

/** Build diagnostics from the current read model without inventing object ids. */
export function buildRoomValuationDiagnostics({
  model,
  cashSummary,
  additionalReasons = [],
}: BuildRoomValuationDiagnosticsOptions): RoomValuationDiagnostic[] {
  const diagnostics: RoomValuationDiagnostic[] = [];
  const seenIds = new Map<string, number>();
  for (const row of model.rows) {
    const reasons = rowReasons(row);
    reasons.forEach((reason, index) => {
      reasonGroups(reason, row).forEach((group, groupIndex) => {
        const quoteGap = row.holding.quoteStatus !== "available" || !row.holding.quote || !row.holding.quote.price;
        const action = group === "valuation" && quoteGap && row.holding.instrumentId && !reason.includes("空头收益率分母") ? "retry-valuation" : "open-data-check";
        const dimension: TradingRoomQualityDimensionId = group === "valuation" ? "historical" : group === "record" ? "transaction" : "holdings";
        diagnostics.push({
          id: stableDiagnosticId(["holding", row.holding.episodeId ?? row.holding.instrumentId ?? rowLabel(row), group, reason, row.holding.quote?.quoteDate ?? model.asOf], seenIds),
          group,
          label: rowLabel(row),
          reason,
          category: diagnosticReasonCategory(reason),
          instrumentId: row.holding.instrumentId || undefined,
          episodeId: row.holding.episodeId || undefined,
          at: row.holding.quote?.quoteDate ?? model.asOf,
          action,
          dimension,
        });
      });
    });
  }

  const existingReasons = new Set(diagnostics.map(item => item.reason));
  for (const reason of additionalReasons) {
    if (!reason || existingReasons.has(reason)) continue;
    diagnostics.push({
      id: stableDiagnosticId(["allocation", reason, model.asOf], seenIds),
      group: "valuation",
      label: "当前估值范围",
      reason,
      category: diagnosticReasonCategory(reason),
      at: model.asOf,
      action: "open-data-check",
      dimension: "holdings",
    });
    existingReasons.add(reason);
  }

  if (cashSummary) {
    const cashReasons = unique([
      ...(cashSummary.missingReasons ?? []),
      ...(cashSummary.todayProceedsStatus === "unavailable" ? [cashSummary.todayProceeds.note] : []),
      ...(cashSummary.cashTotalStatus === "unavailable" ? [cashSummary.cashTotal.note] : []),
    ]);
    cashReasons.forEach(reason => diagnostics.push({
      id: stableDiagnosticId(["cash", reason, cashSummary.asOf ?? cashSummary.updatedAt ?? model.asOf], seenIds),
      group: "record",
      label: "现金记录",
      reason,
      category: diagnosticReasonCategory(reason),
      at: cashSummary.asOf ?? cashSummary.updatedAt,
      action: "open-data-check",
      dimension: "transaction",
    }));
  }
  return diagnostics;
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
  }).formatToParts(parsed).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.timeZoneName ?? "UTC"}`;
}

function objectKey(item: RoomValuationDiagnostic): string | null {
  return item.episodeId ?? item.instrumentId ?? null;
}

function diagnosticSummary(diagnostics: readonly RoomValuationDiagnostic[]) {
  const issueTypes = new Set(diagnostics.map(item => `${item.group}:${item.category}`));
  const objects = new Set(diagnostics.flatMap(item => {
    const key = objectKey(item);
    return key ? [key] : [];
  }));
  return { issueTypes: issueTypes.size, objects: objects.size, rawRecords: diagnostics.length };
}

function actionLabel(action: RoomValuationDiagnostic["action"]): string {
  return action === "retry-valuation" ? "更新行情" : "核对数据";
}

function impactLabel(group: RoomValuationDiagnosticGroupId): string {
  if (group === "valuation") return "影响可信市值或收益率展示";
  if (group === "holding") return "影响持仓数量、成本或方向判断";
  return "影响现金或成交记录的完整性";
}

type RoomValuationDiagnosticsContentProps = {
  diagnostics: readonly RoomValuationDiagnostic[];
  onRetryValuation?: () => void;
  onOpenDataCheck?: RoomValuationDiagnosticsProps["onOpenDataCheck"];
  fallbackRef: RefObject<HTMLDivElement | null>;
};

type DiagnosticDisplayGroup = {
  key: string;
  group: RoomValuationDiagnosticGroupId;
  category: string;
  label: string;
  objectKey: string | null;
  items: RoomValuationDiagnostic[];
};

function buildDisplayGroups(items: readonly RoomValuationDiagnostic[]): DiagnosticDisplayGroup[] {
  const byKey = new Map<string, DiagnosticDisplayGroup>();
  for (const item of items) {
    const object = objectKey(item);
    const key = `${item.group}:${item.category}:${object ?? "unknown"}:${item.action}`;
    const existing = byKey.get(key);
    if (existing) existing.items.push(item);
    else byKey.set(key, { key, group: item.group, category: item.category, label: object ? item.label : "未识别对象（不推断为同一对象）", objectKey: object, items: [item] });
  }
  return [...byKey.values()];
}

function RoomValuationDiagnosticsContent({
  diagnostics,
  onRetryValuation,
  onOpenDataCheck,
  fallbackRef,
}: RoomValuationDiagnosticsContentProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [rawPages, setRawPages] = useState<Record<string, number>>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? diagnostics.filter(item => `${GROUP_LABELS[item.group]} ${item.category} ${item.label} ${item.reason} ${item.id} ${item.instrumentId ?? ""} ${item.episodeId ?? ""} ${item.at ?? ""} ${actionLabel(item.action)}`.toLocaleLowerCase().includes(normalized))
      : diagnostics;
  }, [diagnostics, query]);
  const pageSize = 30;
  const displayGroups = useMemo(() => buildDisplayGroups(filtered), [filtered]);
  const pageCount = Math.max(1, Math.ceil(displayGroups.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = displayGroups.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        (triggerRef.current ?? fallbackRef.current)?.focus();
      }
      return;
    }
    wasOpenRef.current = true;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button, input, summary, [href], [tabindex]:not([tabindex='-1'])")]
        .filter(element => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fallbackRef, open]);

  useEffect(() => () => {
    if (wasOpenRef.current) fallbackRef.current?.focus();
  }, [fallbackRef]);

  const close = () => setOpen(false);
  const openDrawer = () => {
    setOpen(true);
  };
  const runAction = (item: RoomValuationDiagnostic) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (item.action === "retry-valuation") {
      onRetryValuation?.();
      return;
    }
    onOpenDataCheck?.(item.dimension, item.instrumentId ? [item.instrumentId] : [], item.episodeId);
  };

  const summary = diagnosticSummary(diagnostics);
  const summaryCategories = [...buildDisplayGroups(diagnostics).reduce((categories, group) => {
    const key = `${group.group}:${group.category}`;
    const current = categories.get(key);
    categories.set(key, current ? { ...current, count: current.count + group.items.length } : { group: group.group, category: group.category, count: group.items.length });
    return categories;
  }, new Map<string, { group: RoomValuationDiagnosticGroupId; category: string; count: number }>()).values()];
  return <div className={styles.root}>
    <div className={styles.summary} aria-label="估值问题摘要">
      <strong>估值问题</strong>
      <p className={styles.impact}>当前范围有部分估值或记录不可用；可更新行情或核对原始数据。</p>
      <p className={styles.counts} aria-label="估值问题计数">问题类型数 {summary.issueTypes} · 已识别对象数 {summary.objects} · 原始记录数 {summary.rawRecords}</p>
      <div className={styles.groupList}>
        {summaryCategories.slice(0, 3).map(({ group, category, count }) => <span key={`${group}:${category}`}><b>{category}</b> · {count}</span>)}
      </div>
      <button ref={triggerRef} type="button" className={styles.openButton} onClick={openDrawer}>查看问题详情</button>
    </div>
    {open && <div className={styles.scrim} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <div ref={dialogRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="valuation-diagnostics-title">
        <header className={styles.drawerHeader}>
          <div><span className={styles.eyebrow}>数据完整性</span><h2 id="valuation-diagnostics-title">估值问题详情</h2><p>保留当前范围的全部原始原因，可搜索并逐页核对。</p></div>
          <button ref={closeRef} type="button" className={styles.closeButton} onClick={close} aria-label="关闭估值问题详情">关闭</button>
        </header>
        <div className={styles.controls}>
          <label>搜索原因<input value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="搜索标的、原因或原始证据" /></label>
          <span className={styles.resultCount}>{displayGroups.length} 组 / {filtered.length} 条原始记录</span>
        </div>
        <div className={styles.issueList}>
          {visible.length === 0 ? <p className={styles.empty}>没有匹配的问题</p> : visible.map(group => {
            const primary = group.items[0];
            const isExpanded = expandedGroups.has(group.key) || query.trim().length > 0;
            const rawPage = Math.min(rawPages[group.key] ?? 0, Math.max(0, Math.ceil(group.items.length / 30) - 1));
            const rawVisible = isExpanded ? group.items.slice(rawPage * 30, (rawPage + 1) * 30) : [];
            const rawPageCount = Math.max(1, Math.ceil(group.items.length / 30));
            return <article className={styles.issue} key={group.key}>
              <div className={styles.issueBody}><span className={styles.issueGroup}>{GROUP_LABELS[group.group]}</span><h3>{group.category}</h3><p>{group.label}</p><p className={styles.impactDetail}>{impactLabel(group.group)} · 下一步：{actionLabel(primary.action)}</p>
                <details className={styles.evidence} open={isExpanded}>
                  <summary aria-label={`查看原始证据（${group.items.length} 条）`} onClick={event => { event.preventDefault(); setExpandedGroups(previous => { const next = new Set(previous); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; }); }}>查看原始证据</summary>
                  {rawVisible.map(item => {
                    const timestamp = formatTimestamp(item.at);
                    return <div className={styles.rawEvidence} key={item.id}><dl>
                      <div><dt>规则/原因</dt><dd>{item.reason}</dd></div>
                      {item.at && <div><dt>原始时间（ISO）</dt><dd>{item.at}</dd></div>}
                    </dl>{timestamp && <time dateTime={item.at ?? undefined} title={item.at ?? undefined}>{timestamp}</time>}</div>;
                  })}
                  {isExpanded && rawPageCount > 1 && <div className={styles.rawPagination}><button type="button" onClick={() => setRawPages(previous => ({ ...previous, [group.key]: Math.max(0, rawPage - 1) }))} disabled={rawPage === 0}>上一批</button><span>原始证据第 {rawPage + 1} / {rawPageCount} 批</span><button type="button" onClick={() => setRawPages(previous => ({ ...previous, [group.key]: Math.min(rawPageCount - 1, rawPage + 1) }))} disabled={rawPage >= rawPageCount - 1}>下一批</button></div>}
                </details>
              </div>
              <button type="button" className={styles.actionButton} onClick={() => runAction(primary)}>{actionLabel(primary.action)}</button>
            </article>;
          })}
        </div>
        <footer className={styles.pagination}>
          <button type="button" onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>上一页</button>
          <span>第 {currentPage + 1} / {pageCount} 页</span>
          <button type="button" onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1}>下一页</button>
        </footer>
      </div>
    </div>}
  </div>;
}

export function RoomValuationDiagnostics({
  model,
  cashSummary,
  additionalReasons,
  onRetryValuation,
  onOpenDataCheck,
}: RoomValuationDiagnosticsProps) {
  const diagnostics = useMemo(() => buildRoomValuationDiagnostics({ model, cashSummary, additionalReasons }), [model, cashSummary, additionalReasons]);
  const fallbackRef = useRef<HTMLDivElement>(null);

  return <div ref={fallbackRef} className={styles.root} tabIndex={-1}>
    {diagnostics.length > 0 && <RoomValuationDiagnosticsContent
      diagnostics={diagnostics}
      fallbackRef={fallbackRef}
      onRetryValuation={onRetryValuation}
      onOpenDataCheck={onOpenDataCheck}
    />}
  </div>;
}
