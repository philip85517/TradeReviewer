export type RefreshQueueResult<T, R> =
  | { item: T; status: "fulfilled"; value: R }
  | { item: T; status: "rejected"; reason: unknown }
  | { item: T; status: "cancelled"; reason?: unknown };

export type RefreshQueueItemSettledEvent<T = unknown, R = unknown> = {
  completed: number;
  total: number;
  active: number;
  result: RefreshQueueResult<T, R>;
};

export type RefreshQueueOptions<T = unknown, R = unknown> = {
  concurrency?: number;
  /**
   * Cancels work that has not started and is passed to each worker so an
   * in-flight provider request can abort as well. The queue waits for an
   * in-flight worker to settle before returning its ordered results.
   */
  signal?: AbortSignal;
  onItemStarted?: (event: { item: T; index: number; active: number }) => void;
  onItemSettled?: (event: RefreshQueueItemSettledEvent<T, R>) => void;
};

/**
 * Returns retry candidates from a completed queue run. Cancellation is kept
 * separate from failure so an explicit cancel never turns into an automatic
 * retry, while both worker exceptions and hard provider statuses remain
 * retryable.
 */
export function failedRefreshItems<T, R>(
  results: readonly RefreshQueueResult<T, R>[],
  isHardFailure: (value: R) => boolean,
): T[] {
  return results.flatMap((result) => {
    if (result.status === "rejected") return [result.item];
    if (result.status === "fulfilled" && isHardFailure(result.value)) {
      return [result.item];
    }
    return [];
  });
}

function cancellationReason(signal?: AbortSignal) {
  return signal?.reason ?? new DOMException("行情更新已取消", "AbortError");
}

function isAbortError(reason: unknown) {
  return (
    (reason instanceof DOMException && reason.name === "AbortError") ||
    (reason instanceof Error && reason.name === "AbortError")
  );
}

/** Runs refresh work with a bounded number of active provider operations. */
export async function runRefreshQueue<T, R>(
  items: readonly T[],
  worker: (item: T, index: number, signal?: AbortSignal) => Promise<R>,
  options: RefreshQueueOptions<T, R> = {},
): Promise<RefreshQueueResult<T, R>[]> {
  const results: RefreshQueueResult<T, R>[] = new Array(items.length);
  const concurrency = Math.max(
    1,
    Math.min(Math.floor(options.concurrency ?? 1), items.length || 1),
  );
  let nextIndex = 0;
  let active = 0;
  let completed = 0;

  const settle = (index: number, result: RefreshQueueResult<T, R>) => {
    results[index] = result;
    completed += 1;
    options.onItemSettled?.({
      completed,
      total: items.length,
      active,
      result,
    });
  };

  async function consume() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      const item = items[index]!;

      if (options.signal?.aborted) {
        settle(index, {
          item,
          status: "cancelled",
          reason: cancellationReason(options.signal),
        });
        continue;
      }

      active += 1;
      options.onItemStarted?.({ item, index, active });
      try {
        const value = await worker(item, index, options.signal);
        // A worker that has already persisted its result may finish just as
        // cancellation is requested. Let that successful value stand; a
        // worker that observes the signal before saving must throw/return an
        // explicit cancellation so it is reported separately below.
        const settled: RefreshQueueResult<T, R> = {
          item,
          status: "fulfilled",
          value,
        };
        active -= 1;
        settle(index, settled);
      } catch (reason) {
        active -= 1;
        settle(
          index,
          options.signal?.aborted || isAbortError(reason)
            ? {
                item,
                status: "cancelled",
                reason: options.signal?.aborted
                  ? cancellationReason(options.signal)
                  : reason,
              }
            : { item, status: "rejected", reason },
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, () => consume()),
  );
  return results;
}
