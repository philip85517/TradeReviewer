export type RefreshQueueResult<T, R> =
  | { item: T; status: "fulfilled"; value: R }
  | { item: T; status: "rejected"; reason: unknown };

export type RefreshQueueOptions = {
  concurrency?: number;
  onItemSettled?: (event: {
    completed: number;
    total: number;
    active: number;
    result: RefreshQueueResult<unknown, unknown>;
  }) => void;
};

/** Runs refresh work with a bounded number of active provider operations. */
export async function runRefreshQueue<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: RefreshQueueOptions = {},
): Promise<RefreshQueueResult<T, R>[]> {
  const results: RefreshQueueResult<T, R>[] = new Array(items.length);
  const concurrency = Math.max(
    1,
    Math.min(Math.floor(options.concurrency ?? 1), items.length || 1),
  );
  let nextIndex = 0;
  let active = 0;
  let completed = 0;

  async function consume() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) return;
      active += 1;
      try {
        const settled: RefreshQueueResult<T, R> = {
          item,
          status: "fulfilled",
          value: await worker(item, index),
        };
        results[index] = settled;
      } catch (reason) {
        results[index] = { item, status: "rejected", reason };
      } finally {
        active -= 1;
        completed += 1;
        options.onItemSettled?.({
          completed,
          total: items.length,
          active,
          result: results[index] as RefreshQueueResult<unknown, unknown>,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, () => consume()),
  );
  return results;
}
