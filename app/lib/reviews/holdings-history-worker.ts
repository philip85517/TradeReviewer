import {
  computeHoldingsHistory,
  type HoldingsHistoryWorkerInput,
  type HoldingsHistoryWorkerRequestMessage,
  type HoldingsHistoryWorkerResponseMessage,
  type HoldingsHistoryWorkerResult,
} from "./holdings-history-worker-protocol";

export {
  computeHoldingsHistory,
  type HoldingsHistoryWorkerInput,
  type HoldingsHistoryWorkerRequestMessage,
  type HoldingsHistoryWorkerResponseMessage,
  type HoldingsHistoryWorkerResult,
};

/** The small surface shared by the real browser worker and deterministic tests. */
export type HoldingsHistoryWorkerLike = {
  onmessage: ((event: MessageEvent<HoldingsHistoryWorkerResponseMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: HoldingsHistoryWorkerRequestMessage): void;
  terminate(): void;
};

export type HoldingsHistoryWorkerState = {
  identity: string | null;
  pending: boolean;
  result: HoldingsHistoryWorkerResult | null;
  resultInput: HoldingsHistoryWorkerInput | null;
  /** Latest compatible completed snapshot, which may belong to an older input while a newer one is pending. */
  completedResult: HoldingsHistoryWorkerResult | null;
  completedInput: HoldingsHistoryWorkerInput | null;
  error: string | null;
  generation: number;
  activeRequestId: number | null;
};

export type HoldingsHistoryWorkerController = {
  request(input: HoldingsHistoryWorkerInput): void;
  retry(): void;
  subscribe(listener: (state: HoldingsHistoryWorkerState) => void): () => void;
  getState(): HoldingsHistoryWorkerState;
  terminate(): void;
};

export type HoldingsHistoryWorkerControllerOptions = {
  workerFactory?: () => HoldingsHistoryWorkerLike;
  fallback?: (input: HoldingsHistoryWorkerInput) => HoldingsHistoryWorkerResult | Promise<HoldingsHistoryWorkerResult>;
};

function defaultWorkerFactory(): HoldingsHistoryWorkerLike {
  if (typeof Worker === "undefined") throw new Error("当前环境不支持持仓历史 Worker");
  return new Worker(new URL("./holdings-history-worker-entry.ts", import.meta.url), { type: "module" });
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}

type PendingRequest = { id: number; input: HoldingsHistoryWorkerInput };

function structuralKey(input: HoldingsHistoryWorkerInput): string {
  return JSON.stringify([
    input.observationScope,
    input.currentDayScope,
    input.targetCurrency ?? null,
    input.fxSnapshot ?? null,
  ]);
}

function safeAsOfAdvance(previous: string | undefined, next: string | undefined): boolean {
  if (previous === next) return true;
  if (!previous || !next || !previous.includes("T") || !next.includes("T")) return false;
  const previousTime = Date.parse(previous);
  const nextTime = Date.parse(next);
  return Number.isFinite(previousTime) && Number.isFinite(nextTime) && nextTime >= previousTime;
}

function canRetainResult(previous: HoldingsHistoryWorkerInput, next: HoldingsHistoryWorkerInput): boolean {
  return structuralKey(previous) === structuralKey(next) && safeAsOfAdvance(previous.asOf, next.asOf);
}

export function createHoldingsHistoryWorkerController(
  options: HoldingsHistoryWorkerControllerOptions = {},
): HoldingsHistoryWorkerController {
  const workerFactory = options.workerFactory ?? defaultWorkerFactory;
  const fallback = options.fallback ?? computeHoldingsHistory;
  const listeners = new Set<(state: HoldingsHistoryWorkerState) => void>();
  let worker: HoldingsHistoryWorkerLike | null = null;
  let active: PendingRequest | null = null;
  let queued: PendingRequest | null = null;
  let latestInput: HoldingsHistoryWorkerInput | null = null;
  let nextRequestId = 0;
  let disposed = false;
  let state: HoldingsHistoryWorkerState = {
    identity: null,
    pending: false,
    result: null,
    resultInput: null,
    completedResult: null,
    completedInput: null,
    error: null,
    generation: 0,
    activeRequestId: null,
  };

  const emit = () => {
    if (disposed) return;
    for (const listener of listeners) listener(state);
  };

  const terminateWorker = () => {
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
    worker = null;
  };

  const setState = (next: Partial<HoldingsHistoryWorkerState>) => {
    if (disposed) return;
    state = { ...state, ...next };
    emit();
  };

  const finishQueuedOrIdle = (request: PendingRequest, result: HoldingsHistoryWorkerResult | null, error: string | null) => {
    if (disposed) return;
    active = null;
    const next = queued;
    queued = null;
    if (next) {
      // Same-scope refreshes may publish each completed snapshot immediately
      // while the newest input is pending. A changed scope/period must never
      // expose a result calculated for the previous identity.
      const sameDisplayScope = canRetainResult(request.input, next.input);
      setState({
        pending: true,
        activeRequestId: null,
        error,
        ...(sameDisplayScope && result
          ? {
              completedResult: result,
              completedInput: request.input,
              ...(request.input.identity === next.input.identity ? { result, resultInput: request.input } : { result: null, resultInput: null }),
            }
          : { completedResult: null, completedInput: null, result: null, resultInput: null }),
      });
      start(next);
      return;
    }
    if (result) {
      setState({
        pending: false,
        result,
        resultInput: request.input,
        completedResult: result,
        completedInput: request.input,
        error,
        activeRequestId: null,
      });
    } else {
      setState({ pending: false, error, activeRequestId: null });
    }
  };

  const applyFallback = (request: PendingRequest, reason: string) => {
    if (disposed || active?.id !== request.id) return;
    try {
      const fallbackResult = fallback(request.input);
      if (fallbackResult instanceof Promise) {
        fallbackResult.then(
          result => finishFallback(request, result, reason),
          error => finishFallbackError(request, reason, error),
        );
      } else {
        finishFallback(request, fallbackResult, reason);
      }
    } catch (error) {
      finishFallbackError(request, reason, error);
    }
  };

  const fail = (request: PendingRequest, reason: string) => {
    if (disposed || active?.id !== request.id) return;
    terminateWorker();
    applyFallback(request, reason);
  };

  const handleResponse = (request: PendingRequest, source: HoldingsHistoryWorkerLike, message: HoldingsHistoryWorkerResponseMessage) => {
    if (disposed || active?.id !== request.id || worker !== source || message.requestId !== request.id) return;
    if ("error" in message) {
      fail(request, message.error || "持仓历史 Worker 计算失败");
      return;
    }
    finishQueuedOrIdle(request, message.result, null);
  };

  const start = (request: PendingRequest) => {
    if (disposed) return;
    active = request;
    setState({ pending: true, activeRequestId: request.id });
    try {
      if (!worker) worker = workerFactory();
      const source = worker;
      source.onmessage = event => handleResponse(request, source, event.data);
      source.onerror = event => fail(request, event.message || "持仓历史 Worker 运行失败");
      // Worker.postMessage performs one structured clone. The input contract
      // intentionally contains only cloneable records, maps, and arrays.
      source.postMessage({ requestId: request.id, input: request.input });
    } catch (error) {
      fail(request, errorMessage(error));
    }
  };

  const finishFallback = (request: PendingRequest, result: HoldingsHistoryWorkerResult, reason: string) => {
    if (disposed || active?.id !== request.id) return;
    finishQueuedOrIdle(request, result, reason);
  };

  const finishFallbackError = (request: PendingRequest, reason: string, error: unknown) => {
    if (disposed || active?.id !== request.id) return;
    finishQueuedOrIdle(request, null, `${reason}；回退计算失败：${errorMessage(error)}`);
  };

  return {
    request(input) {
      if (disposed) return;
      latestInput = input;
      const request = { id: ++nextRequestId, input };
      const identityChanged = state.identity !== input.identity;
      const displayResult = state.completedResult ?? state.result;
      const displayInput = state.completedInput ?? state.resultInput;
      const canKeepDisplay = Boolean(
        displayResult
        && displayInput
        && canRetainResult(displayInput, input),
      );
      setState({
        identity: input.identity,
        pending: true,
        error: null,
        ...(!canKeepDisplay
          ? { result: null, resultInput: null, completedResult: null, completedInput: null }
          : identityChanged ? { result: null, resultInput: null } : {}),
        generation: request.id,
      });
      if (active) {
        queued = request;
        return;
      }
      start(request);
    },
    retry() {
      if (disposed || active || !latestInput) return;
      const retryInput = latestInput;
      latestInput = null;
      this.request(retryInput);
    },
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    getState() {
      return state;
    },
    terminate() {
      if (disposed) return;
      disposed = true;
      active = null;
      queued = null;
      latestInput = null;
      terminateWorker();
      listeners.clear();
    },
  };
}
