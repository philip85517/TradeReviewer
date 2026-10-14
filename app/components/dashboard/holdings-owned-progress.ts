export type HoldingsOwnedProgressPhase =
  | "downloading"
  | "recomputing"
  | "complete"
  | "partial"
  | "failed"
  | "cancelled";

export type HoldingsOwnedProgressTerminal =
  | "complete"
  | "partial"
  | "failed"
  | "cancelled";

export type HoldingsOwnedProgress = {
  generation: number;
  /** The first current producer run bound to this projection. */
  runId: number;
  /** Additional current runs are possible when the queue splits a request. */
  runIds: readonly number[];
  requiredIds: readonly string[];
  settledIds: readonly string[];
  terminalById: Readonly<Record<string, HoldingsOwnedProgressTerminal>>;
  cacheOnlyIds: readonly string[];
  phase: HoldingsOwnedProgressPhase;
};

export function createHoldingsOwnedProgress({
  generation,
  runId,
  requiredIds,
}: {
  generation: number;
  runId: number;
  requiredIds: readonly string[];
}): HoldingsOwnedProgress {
  return {
    generation,
    runId,
    runIds: [runId],
    requiredIds: uniqueIds(requiredIds),
    settledIds: [],
    terminalById: {},
    cacheOnlyIds: [],
    phase: "downloading",
  };
}

export function mergeHoldingsOwnedProgressRequiredIds(
  progress: HoldingsOwnedProgress,
  requiredIds: readonly string[],
): HoldingsOwnedProgress {
  const merged = uniqueIds([...progress.requiredIds, ...requiredIds]);
  return merged.length === progress.requiredIds.length
    ? progress
    : { ...progress, requiredIds: merged };
}

export function bindHoldingsOwnedProgressRun(
  progress: HoldingsOwnedProgress,
  runId: number,
): HoldingsOwnedProgress {
  if (progress.runIds.includes(runId)) return progress;
  return { ...progress, runIds: [...progress.runIds, runId] };
}

export function settleHoldingsOwnedProgress(
  progress: HoldingsOwnedProgress,
  input: {
    generation: number;
    runId: number;
    instrumentId: string;
    status: HoldingsOwnedProgressTerminal;
    cacheOnly?: boolean;
  },
): HoldingsOwnedProgress {
  if (input.generation !== progress.generation || !progress.runIds.includes(input.runId)) return progress;
  if (progress.phase === "cancelled") return progress;
  if (!progress.requiredIds.includes(input.instrumentId)) return progress;
  if (progress.settledIds.includes(input.instrumentId)) return progress;
  return {
    ...progress,
    settledIds: [...progress.settledIds, input.instrumentId],
    terminalById: { ...progress.terminalById, [input.instrumentId]: input.status },
    cacheOnlyIds: input.cacheOnly && input.status !== "failed" && input.status !== "cancelled"
      ? [...progress.cacheOnlyIds, input.instrumentId]
      : progress.cacheOnlyIds,
  };
}

export function setHoldingsOwnedProgressPhase(
  progress: HoldingsOwnedProgress,
  input: {
    generation: number;
    runId?: number;
    phase: HoldingsOwnedProgressPhase;
  },
): HoldingsOwnedProgress {
  if (input.generation !== progress.generation) return progress;
  if (input.runId !== undefined && !progress.runIds.includes(input.runId)) return progress;
  if (progress.phase === "cancelled" && input.phase !== "cancelled") return progress;
  return progress.phase === input.phase ? progress : { ...progress, phase: input.phase };
}

export function holdingsOwnedProgressDetail(
  progress: HoldingsOwnedProgress | null | undefined,
): string | undefined {
  if (!progress || progress.requiredIds.length === 0) return undefined;
  const required = new Set(progress.requiredIds);
  const settled = progress.settledIds.filter(id => required.has(id)).length;
  return `${settled}/${progress.requiredIds.length} 个标的已处理`;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
