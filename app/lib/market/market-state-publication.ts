/**
 * A small boundary between asynchronous market-data reads and the React state
 * that consumes their terminal results.
 *
 * The caller owns the meaning of `state` (including success and failure
 * states), the read generation, and durable hydration keys. This module only
 * decides when an accepted terminal result is delivered to `onFlush`.
 */

export type MarketStatePublicationPriority =
  | "background"
  | "holding"
  | "selected";

export type MarketStatePublication<TState> = {
  /** Stable instrument identity used for coalescing a pending result. */
  instrumentId: string;
  /** Caller-owned request generation used to reject late older callbacks. */
  generation: number;
  /** The complete terminal state, whether the read succeeded or failed. */
  state: TState;
  /** Holding and selected reads are interactive and bypass the batch window. */
  priority?: MarketStatePublicationPriority;
};

export type MarketStatePublicationTimer = {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
};

export type MarketStatePublicationOptions<TState> = {
  /** Maximum time a background result may remain pending before delivery. */
  windowMs?: number;
  /** Injectable monotonic clock used to keep the batching window bounded. */
  clock?: () => number;
  /** Injectable timer pair for deterministic tests and non-browser callers. */
  timer?: MarketStatePublicationTimer;
  /**
   * Optional caller-owned fence checked immediately before delivery. Use it
   * when another caller can publish a newer state while this batch waits.
   */
  isCurrent?: (item: MarketStatePublication<TState>) => boolean;
  /** Receives one immutable-by-convention batch of terminal results. */
  onFlush: (
    items: readonly MarketStatePublication<TState>[],
  ) => void;
};

export type MarketStatePublicationController<TState> = {
  /**
   * Accept one terminal read result. Returns false when it is stale or the
   * coordinator has been disposed/finished.
   */
  publish(input: MarketStatePublication<TState>): boolean;
  /** Flush pending results immediately without ending the coordinator. */
  flush(): void;
  /** Flush the final partial batch and close the coordinator. */
  finish(): void;
  /** Cancel the timer and drop pending results from an abandoned generation. */
  dispose(): void;
};

const DEFAULT_WINDOW_MS = 50;

const defaultTimer: MarketStatePublicationTimer = {
  set(callback, delayMs) {
    return setTimeout(callback, delayMs);
  },
  clear(handle) {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/**
 * Coalesces background market-state completions into bounded batches.
 *
 * There is deliberately no hydration bookkeeping here. The sink must first
 * validate generation/ownership and then update market state and durable
 * hydration keys together in its own state transition.
 */
export function createMarketStatePublication<TState>(
  options: MarketStatePublicationOptions<TState>,
): MarketStatePublicationController<TState> {
  const windowMs = Math.max(
    0,
    Number.isFinite(options.windowMs ?? DEFAULT_WINDOW_MS)
      ? Math.floor(options.windowMs ?? DEFAULT_WINDOW_MS)
      : DEFAULT_WINDOW_MS,
  );
  const clock = options.clock ?? (() => Date.now());
  const timer = options.timer ?? defaultTimer;
  const pending = new Map<string, MarketStatePublication<TState>>();
  const latestGenerationByInstrument = new Map<string, number>();
  let earliestPendingAt: number | undefined;
  let timerHandle: unknown;
  let timerArmed = false;
  let closed = false;

  const clearPendingTimer = () => {
    if (!timerArmed) return;
    timer.clear(timerHandle);
    timerArmed = false;
    timerHandle = undefined;
  };

  const flushPending = () => {
    if (pending.size === 0) {
      earliestPendingAt = undefined;
      clearPendingTimer();
      return;
    }
    const items = [...pending.values()].filter(
      (item) => options.isCurrent?.(item) ?? true,
    );
    pending.clear();
    earliestPendingAt = undefined;
    clearPendingTimer();
    if (items.length === 0) return;
    options.onFlush(items);
  };

  const runWindow = () => {
    timerArmed = false;
    timerHandle = undefined;
    if (closed || pending.size === 0) {
      earliestPendingAt = undefined;
      return;
    }

    const pendingSince = earliestPendingAt ?? clock();
    const remaining = pendingSince + windowMs - clock();
    if (remaining > 0) {
      timerArmed = true;
      timerHandle = timer.set(runWindow, remaining);
      return;
    }
    flushPending();
  };

  const armWindowIfNeeded = () => {
    if (timerArmed || pending.size === 0) return;
    const pendingSince = earliestPendingAt ?? clock();
    earliestPendingAt = pendingSince;
    const remaining = Math.max(0, pendingSince + windowMs - clock());
    if (remaining === 0) {
      flushPending();
      return;
    }
    timerArmed = true;
    timerHandle = timer.set(runWindow, remaining);
  };

  return {
    publish(input) {
      if (closed) return false;
      const previousGeneration = latestGenerationByInstrument.get(input.instrumentId);
      if (
        previousGeneration !== undefined &&
        input.generation <= previousGeneration
      ) {
        return false;
      }

      latestGenerationByInstrument.set(input.instrumentId, input.generation);
      pending.set(input.instrumentId, input);

      if (input.priority === "holding" || input.priority === "selected") {
        flushPending();
      } else {
        armWindowIfNeeded();
      }
      return true;
    },
    flush() {
      if (closed) return;
      flushPending();
    },
    finish() {
      if (closed) return;
      flushPending();
      closed = true;
    },
    dispose() {
      if (closed) return;
      closed = true;
      pending.clear();
      earliestPendingAt = undefined;
      clearPendingTimer();
    },
  };
}
