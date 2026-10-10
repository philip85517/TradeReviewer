"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildHoldingsRefreshAttemptKey,
  createHoldingsRefreshCoalescer,
  type HoldingsRefreshInstrument,
} from "../../lib/market/holdings-valuation-refresh";
import type { HoldingsHistoryWorkerInput } from "../../lib/reviews/holdings-history-worker";

export type HoldingsValuationRefreshPhase =
  | "idle"
  | "interrupted"
  | "waiting"
  | "downloading"
  | "recomputing"
  | "complete"
  | "partial"
  | "failed"
  | "cancelled";

export type HoldingsValuationRefreshInput = {
  visible: boolean;
  scopeKey: string;
  asOf: string;
  instruments: readonly HoldingsRefreshInstrument[];
  /** Stable scope membership used for the once-per-session key.  Candidate
   * evidence may shrink while the request is active, but the attempt key must
   * continue to describe the whole visible scope. */
  scopeInstruments?: readonly HoldingsRefreshInstrument[];
  onRefresh: (instrumentIds: readonly string[], trigger?: "automatic" | "manual") => Promise<boolean | HoldingsRefreshReceipt> | boolean | HoldingsRefreshReceipt;
  onCancel?: (instrumentIds?: readonly string[]) => void;
  historyPending?: boolean;
  historyError?: string | null;
  marketDataRefresh?: {
    running: boolean;
    total: number;
    completed: number;
    processed?: number;
    partial: number;
    failed: number;
    cancelled?: number;
  };
  marketDataDailyStatuses?: Readonly<Record<string, string | undefined>>;
  marketDataJobs?: Readonly<Record<string, {
    status?: string;
    requestedAt?: string;
    message?: string;
    error?: { code?: string; message?: string };
    intervals?: readonly { interval?: string; status?: string; message?: string; error?: { code?: string; message?: string } }[];
  } | undefined>>;
  /** Optional identity emitted by the history worker after a fresh result. */
  historyResultKey?: string;
  /** Exact worker resultInput acknowledgement; false keeps the request active. */
  historyInputReady?: boolean;
  /** Exact worker input references used to reject an acknowledgement retained
   * from before this request. When supplied, these references are authoritative
   * over the compatibility boolean above. */
  historyCurrentInput?: HoldingsHistoryWorkerInput;
  historyAcceptedInput?: HoldingsHistoryWorkerInput | null;
};

export type HoldingsRefreshReceipt = {
  ok: true;
  /** requestedAt values read back after the durable job write for this run. */
  requestedAtByInstrument: Readonly<Record<string, string | undefined>>;
  /** Durable 1D outcome for each subscriber instrument. */
  dailyStatusByInstrument?: Readonly<Record<string, string | undefined>>;
} | {
  ok: false;
  reason: "failed" | "cancelled";
};

export type HoldingsValuationRefreshResult = {
  phase: HoldingsValuationRefreshPhase;
  label: string;
  detail: string | null;
  announcement: string | null;
  active: boolean;
  request: () => void;
  cancel: () => void;
};

const FAILURE_STATUSES = new Set([
  "source-rate-limited",
  "source-forbidden",
  "source-unavailable",
  "invalid-response",
  "storage-error",
  "error",
]);
const PARTIAL_STATUSES = new Set(["partial", "latest-available", "stale"]);
const TERMINAL_MARKET_STATUSES = new Set([
  "complete",
  "ready",
  "latest-available",
  "partial",
  "stale",
  ...FAILURE_STATUSES,
  "cancelled",
]);

const INTERRUPTED_JOB_CODE = "market-data-job-interrupted";

function isRelevantInterruptedJob(job: NonNullable<HoldingsValuationRefreshInput["marketDataJobs"]>[string]): boolean {
  if (!job) return false;
  const daily = job.intervals?.find(interval => interval.interval === "1D");
  // The persisted job error can cover several intervals. Only the 1D
  // interval's own terminal interruption evidence may reopen the valuation
  // state; a global error caused by an interrupted intraday interval must not
  // relabel settled daily data as interrupted.
  return daily?.status === "error" && daily.error?.code === INTERRUPTED_JOB_CODE;
}

function terminalPhase(
  ids: readonly string[],
  statuses: HoldingsValuationRefreshInput["marketDataDailyStatuses"],
  jobs: HoldingsValuationRefreshInput["marketDataJobs"],
  requestStartedAt: number | null,
  baselineJobs: Readonly<Record<string, string | undefined>> | null,
  receipt: Readonly<Record<string, string | undefined>> | null,
  receiptDailyStatuses: Readonly<Record<string, string | undefined>> | null,
): HoldingsValuationRefreshPhase | null {
  const values = ids.map(id => {
    const job = jobs?.[id];
    const dailyStatus = receiptDailyStatuses?.[id] ?? statuses?.[id];
    if (dailyStatus === "syncing" || dailyStatus === "not-requested" || dailyStatus === "unknown") return null;
    if (dailyStatus !== undefined && !TERMINAL_MARKET_STATUSES.has(dailyStatus)) return null;
    if (!job || !job.status || job.status === "syncing" || job.status === "not-requested" || job.status === "unknown") return null;
    const dailyIntervalStatus = job.intervals?.find(interval => interval.interval === "1D")?.status;
    const effectiveJobStatus = dailyStatus ?? dailyIntervalStatus ?? job.status;
    if (effectiveJobStatus === "syncing" || effectiveJobStatus === "not-requested" || effectiveJobStatus === "unknown") return null;
    if (!TERMINAL_MARKET_STATUSES.has(effectiveJobStatus)) return null;
    const receiptAt = receipt?.[id];
    if (receiptAt !== undefined) {
      if (!job.requestedAt || job.requestedAt !== receiptAt) return null;
    } else if (requestStartedAt !== null && (!job.requestedAt || !Number.isFinite(Date.parse(job.requestedAt)) || Date.parse(job.requestedAt) < requestStartedAt)) return null;
    const evidence = `${job.status}|${job.requestedAt ?? ""}`;
    if (baselineJobs?.[id] === evidence && !receipt) return null;
    return [effectiveJobStatus];
  });
  if (values.some(value => value === null || value.length === 0)) return null;
  const allValues = values.flatMap(value => value ?? []);
  if (allValues.some(value => FAILURE_STATUSES.has(value))) return "failed";
  if (allValues.some(value => PARTIAL_STATUSES.has(value))) return "partial";
  if (allValues.some(value => value === "cancelled" || value === "unknown")) return "cancelled";
  return "complete";
}

function historyInputIncludesNewPublishedData(
  accepted: HoldingsHistoryWorkerInput,
  baseline: HoldingsHistoryWorkerInput | null | undefined,
): boolean {
  if (!baseline) return true;
  // A worker input recreated only because the as-of clock advanced can be
  // accepted while retaining the same source snapshots. It cannot acknowledge
  // this request's durable candle/entry publication.
  return accepted.candlesByInstrument !== baseline.candlesByInstrument
    || accepted.entries !== baseline.entries;
}

export function useHoldingsValuationRefresh(input: HoldingsValuationRefreshInput): HoldingsValuationRefreshResult {
  const initialInterrupted = input.instruments.some(instrument => isRelevantInterruptedJob(input.marketDataJobs?.[instrument.instrumentId]));
  const [phase, setPhase] = useState<HoldingsValuationRefreshPhase>(initialInterrupted ? "interrupted" : "idle");
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [pendingRecompute, setPendingRecompute] = useState(false);
  const [requestActive, setRequestActive] = useState(false);
  const [displayIds, setDisplayIds] = useState<readonly string[] | null>(null);
  /**
   * Automatic attempts are once per stable scope/session *and candidate*. The
   * scope key must stay stable while the history worker discovers additional
   * historical holdings, so remembering only the key would permanently skip
   * those newly eligible instruments.
   */
  const automaticAttemptedIds = useRef(new Map<string, Set<string>>());
  const requesting = useRef<{ generation: number; ids: readonly string[] } | null>(null);
  const settledGeneration = useRef<number | null>(null);
  const settledIds = useRef<readonly string[] | null>(null);
  const requestStartedAt = useRef<number | null>(null);
  const requestReceipt = useRef<Readonly<Record<string, string | undefined>> | null>(null);
  const requestDailyStatuses = useRef<Readonly<Record<string, string | undefined>> | null>(null);
  const baselineJobs = useRef<Readonly<Record<string, string | undefined>> | null>(null);
  const historyBaselineKey = useRef<string | undefined>(undefined);
  const historyBaselineInput = useRef<HoldingsHistoryWorkerInput | null | undefined>(undefined);
  const historyBaselineCurrentInput = useRef<HoldingsHistoryWorkerInput | undefined>(undefined);
  const pendingAutomatic = useRef<{ key: string; ids: readonly string[] } | null>(null);
  const [recoveryDismissedForAttempt, setRecoveryDismissedForAttempt] = useState<string | null>(null);
  const [autoDrainTick, setAutoDrainTick] = useState(0);
  const generation = useRef(0);
  const onCancelRef = useRef(input.onCancel);
  const inputRef = useRef(input);
  const [coalescer] = useState(() => createHoldingsRefreshCoalescer(input.onRefresh));
  useEffect(() => {
    onCancelRef.current = input.onCancel;
    inputRef.current = input;
    coalescer.setRunner(input.onRefresh);
  }, [coalescer, input, input.onCancel, input.onRefresh]);
  const ids = useMemo(() => [...new Set(input.instruments.map(value => value.instrumentId).filter(Boolean))], [input.instruments]);
  const scopeInstruments = input.scopeInstruments ?? input.instruments;
  const attemptKey = useMemo(() => buildHoldingsRefreshAttemptKey({
    scopeKey: input.scopeKey,
    asOf: input.asOf,
    instruments: scopeInstruments,
  }), [input.asOf, input.scopeKey, scopeInstruments]);
  const hasRecoveredInterruption = ids.some(id => isRelevantInterruptedJob(input.marketDataJobs?.[id]));

  const request = useCallback((trigger: "automatic" | "manual" = "manual", requestedIds: readonly string[] = ids) => {
    if (requestedIds.length === 0 || requesting.current) {
      if (requesting.current) setAnnouncement("已加入当前估值更新，正在共享本页任务。");
      return;
    }
    const requestGeneration = ++generation.current;
    setRecoveryDismissedForAttempt(attemptKey);
    requesting.current = { generation: requestGeneration, ids: requestedIds };
    setRequestActive(true);
    setDisplayIds(requestedIds);
    requestStartedAt.current = Date.now();
    baselineJobs.current = Object.fromEntries(requestedIds.map(id => {
      const job = inputRef.current.marketDataJobs?.[id];
      return [id, job ? `${job.status ?? ""}|${job.requestedAt ?? ""}` : undefined];
    }));
    historyBaselineKey.current = inputRef.current.historyResultKey;
    historyBaselineInput.current = inputRef.current.historyAcceptedInput;
    historyBaselineCurrentInput.current = inputRef.current.historyCurrentInput;
    settledGeneration.current = null;
    settledIds.current = null;
    setAnnouncement(null);
    if (hasRecoveredInterruption) {
      setAnnouncement("上次行情更新被中断，正在重新补齐。");
    }
    setPhase("waiting");
    void coalescer.request(requestedIds, trigger).then(result => {
      if (requesting.current?.generation !== requestGeneration) return;
      if (result.shared) setAnnouncement("已加入当前估值更新，正在共享本页任务。");
      if (result.value === false) {
        requesting.current = null;
        setRequestActive(false);
        setDisplayIds(null);
        setAutoDrainTick(value => value + 1);
        setPhase("waiting");
        setAnnouncement("其他页面正在更新行情，请稍后手动重试。");
        return;
      }
      if (typeof result.value === "object" && result.value?.ok === false) {
        requesting.current = null;
        setRequestActive(false);
        setDisplayIds(null);
        setAutoDrainTick(value => value + 1);
        setPendingRecompute(false);
        setPhase(result.value.reason);
        setAnnouncement(result.value.reason === "cancelled" ? "估值更新已取消，原有缓存已保留。" : "估值更新失败，可再次重试。");
        return;
      }
      settledGeneration.current = requestGeneration;
      settledIds.current = requestedIds;
      requestReceipt.current = typeof result.value === "object" && result.value?.ok
        ? result.value.requestedAtByInstrument
        : null;
      requestDailyStatuses.current = typeof result.value === "object" && result.value?.ok
        ? result.value.dailyStatusByInstrument ?? null
        : null;
      setPendingRecompute(Boolean(inputRef.current.historyPending));
      setPhase(inputRef.current.historyPending ? "recomputing" : "downloading");
    }).catch(() => {
      if (requesting.current?.generation !== requestGeneration) return;
      requesting.current = null;
      setRequestActive(false);
      setDisplayIds(null);
      setAutoDrainTick(value => value + 1);
      setPhase("failed");
      setAnnouncement("估值更新失败，可再次重试。");
    });
  }, [attemptKey, coalescer, hasRecoveredInterruption, ids]);

  useEffect(() => {
    if (!input.visible || ids.length === 0) return;
    const attemptedIds = automaticAttemptedIds.current.get(attemptKey) ?? new Set<string>();
    const newIds = ids.filter(id => !attemptedIds.has(id));
    if (newIds.length === 0) return;
    for (const id of newIds) attemptedIds.add(id);
    automaticAttemptedIds.current.set(attemptKey, attemptedIds);
    if (requesting.current) {
      const pending = pendingAutomatic.current;
      if (pending?.key === attemptKey) {
        pendingAutomatic.current = {
          key: attemptKey,
          ids: [...new Set([...pending.ids, ...newIds])],
        };
      } else {
        pendingAutomatic.current = { key: attemptKey, ids: newIds };
      }
      return;
    }
    request("automatic", newIds);
  }, [attemptKey, ids, input.visible, request]);

  useEffect(() => {
    if (requesting.current || !pendingAutomatic.current || !input.visible) return;
    const pending = pendingAutomatic.current;
    pendingAutomatic.current = null;
    request("automatic", pending.ids);
  }, [autoDrainTick, input.visible, request]);

  useEffect(() => {
    if (settledGeneration.current === null) return;
    if (input.historyError) {
      const failedGeneration = settledGeneration.current;
      queueMicrotask(() => {
        if (settledGeneration.current !== failedGeneration) return;
        setPendingRecompute(false);
        setPhase("failed");
        setAnnouncement("持仓历史重算失败，可再次重试。");
        setRequestActive(false);
        setDisplayIds(null);
        requesting.current = null;
        settledGeneration.current = null;
        settledIds.current = null;
        requestStartedAt.current = null;
        baselineJobs.current = null;
        requestReceipt.current = null;
        requestDailyStatuses.current = null;
        historyBaselineInput.current = undefined;
        historyBaselineCurrentInput.current = undefined;
        setAutoDrainTick(value => value + 1);
      });
      return;
    }
    if (input.historyPending) return;
    const hasExactHistoryInput = input.historyCurrentInput !== undefined || input.historyAcceptedInput !== undefined;
    if (hasExactHistoryInput) {
      if (input.historyAcceptedInput !== input.historyCurrentInput
        || input.historyAcceptedInput === historyBaselineInput.current
        || input.historyAcceptedInput === historyBaselineCurrentInput.current
        || !input.historyAcceptedInput
        || !historyInputIncludesNewPublishedData(input.historyAcceptedInput, historyBaselineCurrentInput.current)) return;
    } else if (input.historyInputReady === false) {
      return;
    }
    // Once Task 1's exact resultInput receipt is present, it is authoritative;
    // the derived model key is only a compatibility fallback for the handoff.
    if (input.historyInputReady === undefined
      && input.historyResultKey !== undefined
      && input.historyResultKey === historyBaselineKey.current) return;
    const nextPhase = terminalPhase(settledIds.current ?? ids, input.marketDataDailyStatuses, input.marketDataJobs, requestStartedAt.current, baselineJobs.current, requestReceipt.current, requestDailyStatuses.current);
    if (nextPhase === null) return;
    setPendingRecompute(false);
    setPhase(nextPhase);
    setRequestActive(false);
    setDisplayIds(null);
    setAnnouncement(null);
    requesting.current = null;
    settledGeneration.current = null;
    settledIds.current = null;
    requestStartedAt.current = null;
    baselineJobs.current = null;
    requestReceipt.current = null;
    requestDailyStatuses.current = null;
    historyBaselineInput.current = undefined;
    historyBaselineCurrentInput.current = undefined;
    setAutoDrainTick(value => value + 1);
  }, [ids, input.historyAcceptedInput, input.historyCurrentInput, input.historyError, input.historyInputReady, input.historyPending, input.historyResultKey, input.marketDataDailyStatuses, input.marketDataJobs, pendingRecompute, phase]);

  useEffect(() => {
    // A durable receipt hands ownership to the history recompute phase. The
    // producer may still report its batch as running for one or more renders;
    // do not downgrade that settled request back to "downloading" while the
    // worker publishes its acknowledged snapshot.
    if (!requesting.current || settledGeneration.current !== null || !input.marketDataRefresh?.running) return;
    setPhase(input.marketDataRefresh.processed || input.marketDataRefresh.completed ? "downloading" : "waiting");
  }, [input.marketDataRefresh]);

  const cancel = useCallback(() => {
    if (!requesting.current) return;
    const targetIds = requesting.current.ids;
    ++generation.current;
    requesting.current = null;
    setRequestActive(false);
    setDisplayIds(null);
    settledGeneration.current = null;
    settledIds.current = null;
    requestStartedAt.current = null;
    baselineJobs.current = null;
    requestReceipt.current = null;
    requestDailyStatuses.current = null;
    historyBaselineInput.current = undefined;
    historyBaselineCurrentInput.current = undefined;
    pendingAutomatic.current = null;
    coalescer.cancel(targetIds);
    onCancelRef.current?.(targetIds);
    setPendingRecompute(false);
    setPhase("cancelled");
    setAnnouncement("估值更新已取消，原有缓存已保留。");
    setAutoDrainTick(value => value + 1);
  }, [coalescer]);

  const active = requestActive || pendingRecompute;
  // Keep one stateful phase for the live request while deriving the reopened
  // durable interruption from the current 1D evidence. This avoids an effect
  // write racing the automatic retry: request() immediately owns the phase.
  const visiblePhase = phase === "idle" && hasRecoveredInterruption && recoveryDismissedForAttempt !== attemptKey
    ? "interrupted"
    : phase === "interrupted" && !hasRecoveredInterruption
      ? "idle"
      : phase;
  const label = active && (visiblePhase === "waiting" || visiblePhase === "downloading" || visiblePhase === "recomputing")
    ? "正在更新估值"
    : visiblePhase === "waiting"
    ? "等待行情更新"
    : visiblePhase === "interrupted"
      ? "上次行情更新被中断"
    : visiblePhase === "downloading"
      ? "正在下载行情…"
      : visiblePhase === "recomputing"
        ? "正在重算持仓历史…"
        : visiblePhase === "complete"
          ? "估值更新完成"
          : visiblePhase === "partial"
            ? "估值部分完成"
            : visiblePhase === "failed"
              ? "估值更新失败"
              : visiblePhase === "cancelled"
                ? "估值更新已取消"
                : "估值待更新";
  const detailIds = displayIds ?? ids;
  const detail = active && visiblePhase === "waiting"
    ? "等待行情更新"
    : active && visiblePhase === "recomputing"
      ? "正在重算持仓历史"
      : input.marketDataRefresh?.running && active
        ? (() => {
      const completed = detailIds.filter(id => {
        const status = input.marketDataDailyStatuses?.[id]
          ?? input.marketDataJobs?.[id]?.intervals?.find(interval => interval.interval === "1D")?.status
          ?? input.marketDataJobs?.[id]?.status;
        return status !== undefined && TERMINAL_MARKET_STATUSES.has(status);
      }).length;
      return `${completed}/${detailIds.length} 个标的已处理`;
    })()
        : null;

  return { phase: visiblePhase, label, detail, announcement, active, request, cancel };
}
