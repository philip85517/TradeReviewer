"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { canonicalFxPublicationIdentity } from "../../lib/fx/room-contracts";
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
  /** Persisted current holdings/cache and the first exact history result are
   * prerequisites for the automatic default refresh. Manual requests remain
   * available while this baseline is loading. */
  initialDataReady?: boolean;
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
  "needs-provider",
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
const AUTOMATIC_ATTEMPT_CACHE_LIMIT = 8;
const EMPTY_REFRESH_ANNOUNCEMENT = "当前范围暂无需要补齐的行情。";
type TerminalPhaseValue = readonly [string] | "superseded" | null;
type TerminalPhaseResult = HoldingsValuationRefreshPhase | "superseded" | null;

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
): TerminalPhaseResult {
  const values: TerminalPhaseValue[] = ids.map(id => {
    const job = jobs?.[id];
    if (!job || !job.status) return null;
    const dailyIntervalStatus = job.intervals?.find(interval => interval.interval === "1D")?.status;
    // A durable 1D interval that is still running (or has not been requested)
    // is authoritative even when a receipt or aggregate status already looks
    // terminal. The accepted daily receipt cannot bypass an actual day-level
    // pending state; only unrelated intraday intervals may remain unrequested.
    if (dailyIntervalStatus === "syncing" || dailyIntervalStatus === "not-requested" || dailyIntervalStatus === "unknown") return null;
    if (dailyIntervalStatus !== undefined && !TERMINAL_MARKET_STATUSES.has(dailyIntervalStatus)) return null;
    // Aggregate pending states are only overridable by this request's owned
    // receipt. A stale live daily status alone must not turn an unowned
    // unknown/not-requested job into an accepted terminal result.
    if ((job.status === "syncing" || job.status === "not-requested" || job.status === "unknown")
      && receipt?.[id] === undefined) return null;
    const dailyStatus = receiptDailyStatuses?.[id] ?? statuses?.[id];
    if (dailyStatus === "syncing" || dailyStatus === "not-requested" || dailyStatus === "unknown") return null;
    if (dailyStatus !== undefined && !TERMINAL_MARKET_STATUSES.has(dailyStatus)) return null;
    const effectiveJobStatus = dailyStatus ?? dailyIntervalStatus ?? job.status;
    if (effectiveJobStatus === "syncing" || effectiveJobStatus === "not-requested" || effectiveJobStatus === "unknown") return null;
    if (!TERMINAL_MARKET_STATUSES.has(effectiveJobStatus)) return null;
    const receiptAt = receipt?.[id];
    if (receiptAt !== undefined) {
      if (!job.requestedAt || job.requestedAt !== receiptAt) {
        const jobTime = Date.parse(job.requestedAt ?? "");
        const receiptTime = Date.parse(receiptAt);
        if (Number.isFinite(jobTime)
          && Number.isFinite(receiptTime)
          && jobTime > receiptTime) return "superseded";
        return null;
      }
    } else if (requestStartedAt !== null && (!job.requestedAt || !Number.isFinite(Date.parse(job.requestedAt)) || Date.parse(job.requestedAt) < requestStartedAt)) return null;
    const evidence = `${job.status}|${job.requestedAt ?? ""}`;
    if (baselineJobs?.[id] === evidence && !receipt) return null;
    return [effectiveJobStatus] as const;
  });
  if (values.some(value => value === "superseded")) return "superseded";
  if (values.some(value => value === null)) return null;
  const allValues = values.flatMap(value => value !== null && value !== "superseded" ? value : []);
  const failures = allValues.filter(value => FAILURE_STATUSES.has(value)).length;
  const partials = allValues.filter(value => PARTIAL_STATUSES.has(value)).length;
  const cancellations = allValues.filter(value => value === "cancelled" || value === "unknown").length;
  // A batch with at least one usable terminal result can publish a partial
  // accepted snapshot. Only an all-failure batch remains retryable without
  // changing the visible financial result. Cancellation follows the same
  // rule for a mixed batch, while an all-cancelled batch retains the explicit
  // cancelled state.
  if (failures === allValues.length) return "failed";
  if (cancellations === allValues.length) return "cancelled";
  if (failures > 0 || partials > 0 || cancellations > 0) return "partial";
  return "complete";
}

function historyInputIncludesNewPublishedData(
  accepted: HoldingsHistoryWorkerInput,
  baseline: HoldingsHistoryWorkerInput | null | undefined,
): boolean {
  if (!baseline) return true;
  // The worker identity is recreated for every as-of tick. It is therefore
  // only a candidate version, not proof that this refresh published source
  // data. A candle/ledger reference change is causal evidence for a new
  // result; an FX publication is also evidence because its rate/as-of is part
  // of the accepted financial bundle. A clock-only identity change reaches a
  // terminal failed state below so the request cannot remain downloading
  // forever while retaining the previous bundle.
  if (accepted.candlesByInstrument !== baseline.candlesByInstrument
    || accepted.entries !== baseline.entries) return true;
  const acceptedFx = accepted.fxSnapshot;
  const baselineFx = baseline.fxSnapshot;
  return JSON.stringify(canonicalFxPublicationIdentity(acceptedFx))
    !== JSON.stringify(canonicalFxPublicationIdentity(baselineFx));
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
  const requesting = useRef<{ generation: number; scopeKey: string; ids: readonly string[] } | null>(null);
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
  const previousScopeKey = useRef(input.scopeKey);
  const [recoveryDismissedForAttempt, setRecoveryDismissedForAttempt] = useState<string | null>(null);
  const [autoDrainTick, setAutoDrainTick] = useState(0);
  const generation = useRef(0);
  const onCancelRef = useRef(input.onCancel);
  const inputRef = useRef(input);
  const [coalescer] = useState(() => createHoldingsRefreshCoalescer(input.onRefresh));
  // Publish the live input before passive effects and before any promise
  // continuation can observe a committed scope change. Promise guards below
  // intentionally read this ref instead of the request callback's captured
  // input, so an old producer receipt cannot settle a newer scope.
  useLayoutEffect(() => {
    inputRef.current = input;
  }, [input]);
  useEffect(() => {
    onCancelRef.current = input.onCancel;
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
    // A request from the previous display scope may still be running in the
    // shared producer. It can finish and write its own durable cache, but its
    // receipt must not settle this hook after the user moved to a new scope.
    if (requesting.current && requesting.current.scopeKey !== input.scopeKey) {
      const staleIds = requesting.current.ids;
      ++generation.current;
      requesting.current = null;
      settledGeneration.current = null;
      settledIds.current = null;
      requestStartedAt.current = null;
      baselineJobs.current = null;
      requestReceipt.current = null;
      requestDailyStatuses.current = null;
      historyBaselineInput.current = undefined;
      historyBaselineCurrentInput.current = undefined;
      pendingAutomatic.current = null;
      coalescer.cancel(staleIds);
      setRequestActive(false);
      setDisplayIds(null);
      setPendingRecompute(false);
      setPhase("idle");
      setAnnouncement(null);
    }
    if (requestedIds.length === 0 || requesting.current) {
      if (requesting.current) setAnnouncement("已加入当前估值更新，正在共享本页任务。");
      else if (trigger === "manual") setAnnouncement(EMPTY_REFRESH_ANNOUNCEMENT);
      return;
    }
    const requestGeneration = ++generation.current;
    setRecoveryDismissedForAttempt(attemptKey);
    requesting.current = { generation: requestGeneration, scopeKey: input.scopeKey, ids: requestedIds };
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
      if (requesting.current?.generation !== requestGeneration
        || requesting.current.scopeKey !== inputRef.current.scopeKey
        || inputRef.current.scopeKey !== input.scopeKey) return;
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
      // The durable receipt is stored in refs so it cannot be observed as a
      // transient input candidate. Tick the existing drain state when it
      // arrives so a terminal render that happened just before the promise
      // settled gets another pass through the exact-history and job-boundary
      // checks without adding another hook to this long-lived component.
      setAutoDrainTick(value => value + 1);
      setPendingRecompute(Boolean(inputRef.current.historyPending));
      setPhase(inputRef.current.historyPending ? "recomputing" : "downloading");
    }).catch(() => {
      if (requesting.current?.generation !== requestGeneration
        || requesting.current.scopeKey !== inputRef.current.scopeKey
        || inputRef.current.scopeKey !== input.scopeKey) return;
      requesting.current = null;
      setRequestActive(false);
      setDisplayIds(null);
      setAutoDrainTick(value => value + 1);
      setPhase("failed");
      setAnnouncement("估值更新失败，可再次重试。");
    });
  }, [attemptKey, coalescer, hasRecoveredInterruption, ids, input.scopeKey]);

  useEffect(() => {
    if (previousScopeKey.current === input.scopeKey) return;
    previousScopeKey.current = input.scopeKey;

    // A scope change owns a new transient phase even when the previous scope
    // already settled. Invalidate any late receipt, and cancel only this hook's
    // active subscription before deriving B's own interruption state.
    const staleRequest = requesting.current;
    ++generation.current;
    requesting.current = null;
    settledGeneration.current = null;
    settledIds.current = null;
    requestStartedAt.current = null;
    baselineJobs.current = null;
    requestReceipt.current = null;
    requestDailyStatuses.current = null;
    historyBaselineKey.current = undefined;
    historyBaselineInput.current = undefined;
    historyBaselineCurrentInput.current = undefined;
    pendingAutomatic.current = null;
    if (staleRequest) coalescer.cancel(staleRequest.ids);
    setRequestActive(false);
    setDisplayIds(null);
    setPendingRecompute(false);
    setRecoveryDismissedForAttempt(null);
    setPhase(hasRecoveredInterruption ? "interrupted" : "idle");
    setAnnouncement(null);
    setAutoDrainTick(value => value + 1);
  }, [coalescer, hasRecoveredInterruption, input.scopeKey]);

  useEffect(() => {
    if (!input.visible || ids.length === 0 || input.initialDataReady === false || input.historyInputReady === false) return;
    const attemptedIds = automaticAttemptedIds.current.get(attemptKey) ?? new Set<string>();
    const newIds = ids.filter(id => !attemptedIds.has(id));
    if (newIds.length === 0) return;
    for (const id of newIds) attemptedIds.add(id);
    automaticAttemptedIds.current.delete(attemptKey);
    automaticAttemptedIds.current.set(attemptKey, attemptedIds);
    while (automaticAttemptedIds.current.size > AUTOMATIC_ATTEMPT_CACHE_LIMIT) {
      const oldestKey = automaticAttemptedIds.current.keys().next().value;
      if (oldestKey === undefined || oldestKey === attemptKey) break;
      automaticAttemptedIds.current.delete(oldestKey);
    }
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
  }, [attemptKey, ids, input.historyInputReady, input.initialDataReady, input.visible, request]);

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
    // A newer terminal job can prove that this request's durable receipt was
    // superseded even while the history worker is still pending. End that
    // request before the exact-history gate so an abandoned receipt cannot
    // keep the hook recomputing forever. The newer job is only failure
    // evidence here; its result is not accepted by this request.
    const earlyTerminalPhase = terminalPhase(
      settledIds.current ?? ids,
      input.marketDataDailyStatuses,
      input.marketDataJobs,
      requestStartedAt.current,
      baselineJobs.current,
      requestReceipt.current,
      requestDailyStatuses.current,
    );
    if (earlyTerminalPhase === "superseded") {
      setPendingRecompute(false);
      setPhase("failed");
      setRequestActive(false);
      setDisplayIds(null);
      setAnnouncement("估值更新失败，可再次重试。");
      requesting.current = null;
      settledGeneration.current = null;
      settledIds.current = null;
      requestStartedAt.current = null;
      baselineJobs.current = null;
      requestReceipt.current = null;
      requestDailyStatuses.current = null;
      historyBaselineInput.current = undefined;
      historyBaselineCurrentInput.current = undefined;
      pendingAutomatic.current = null;
      setAutoDrainTick(value => value + 1);
      return;
    }
    if (input.historyPending) return;
    const hasExactHistoryInput = input.historyCurrentInput !== undefined || input.historyAcceptedInput !== undefined;
    let hasNewPublishedData = true;
    if (hasExactHistoryInput) {
      if (input.historyAcceptedInput !== input.historyCurrentInput
        || !input.historyAcceptedInput) return;
      hasNewPublishedData = input.historyAcceptedInput !== historyBaselineInput.current
        && input.historyAcceptedInput !== historyBaselineCurrentInput.current
        && historyInputIncludesNewPublishedData(input.historyAcceptedInput, historyBaselineCurrentInput.current);
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
    const superseded = nextPhase === "superseded";
    // A durable market receipt can legitimately contain no new daily source
    // rows (for example a provider reports the same completed candle while
    // the workspace as-of clock advanced). End that attempt explicitly as a
    // retryable failure and keep the accepted bundle frozen. Treating the
    // identity-only worker result as complete would publish a second bundle
    // without causal financial evidence; leaving it active would strand the
    // refresh in downloading forever.
    const hasNoNewPublishedData = hasExactHistoryInput && !hasNewPublishedData;
    const publishedPhase = superseded || hasNoNewPublishedData ? "failed" : nextPhase;
    setPendingRecompute(false);
    setPhase(publishedPhase);
    setRequestActive(false);
    setDisplayIds(null);
    setAnnouncement(superseded
      ? "估值更新失败，可再次重试。"
      : hasNoNewPublishedData
        ? "本次更新没有新的可用数据，已保留上次结果，可再次手动重试。"
        : null);
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
  }, [autoDrainTick, ids, input.historyAcceptedInput, input.historyCurrentInput, input.historyError, input.historyInputReady, input.historyPending, input.historyResultKey, input.marketDataDailyStatuses, input.marketDataJobs, pendingRecompute, phase]);

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
  const emptyRefresh = announcement === EMPTY_REFRESH_ANNOUNCEMENT;
  // Keep one stateful phase for the live request while deriving the reopened
  // durable interruption from the current 1D evidence. This avoids an effect
  // write racing the automatic retry: request() immediately owns the phase.
  const visiblePhase = phase === "idle" && hasRecoveredInterruption && recoveryDismissedForAttempt !== attemptKey
    ? "interrupted"
    : phase === "interrupted" && !hasRecoveredInterruption
      ? "idle"
      : phase;
  const label = emptyRefresh
    ? "当前无需补齐行情"
    : active && (visiblePhase === "waiting" || visiblePhase === "downloading" || visiblePhase === "recomputing")
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
              ? "部分行情未更新"
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
    : visiblePhase === "partial"
      ? "估值基于可用行情"
      : null;

  return { phase: visiblePhase, label, detail, announcement, active, request, cancel };
}
