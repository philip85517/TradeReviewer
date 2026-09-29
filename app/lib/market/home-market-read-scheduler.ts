type ReadTask<T> = (signal: AbortSignal) => Promise<T>;

export type HomeMarketReadPriority = "background" | "interactive";

type ReadEntry<T> = {
  key: string;
  task: ReadTask<T>;
  priority: HomeMarketReadPriority;
  controller: AbortController;
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  state: "queued" | "active" | "settled";
  subscribers: number;
  timeout?: ReturnType<typeof setTimeout>;
};

export type HomeMarketReadSchedulerOptions = {
  /** Maximum number of bottom-level local/cache reads that may be active at once. */
  concurrency?: number;
  /** Optional capacity kept available for an interactive replay read. */
  interactiveReserve?: number;
  /** Maximum time an active local read may consume. */
  timeoutMs?: number;
};

export type HomeMarketReadScheduler = {
  read<T>(
    key: string,
    task: ReadTask<T>,
    signal?: AbortSignal,
    priority?: HomeMarketReadPriority,
  ): Promise<T>;
  dispose(): void;
};

function abortError(signal?: AbortSignal) {
  return signal?.reason ?? new DOMException("行情读取已取消", "AbortError");
}

function rejected<T>(reason: unknown): Promise<T> {
  return Promise.reject(reason);
}

/**
 * Coordinates homepage cache reads.
 *
 * Keys represent the complete semantic read (instrument, interval and range),
 * so concurrent callers share one promise. Each caller still gets its own
 * cancellation boundary; an abandoned caller cannot publish a late result,
 * while a shared read remains alive for another subscriber.
 */
export function createHomeMarketReadScheduler(
  options: HomeMarketReadSchedulerOptions = {},
): HomeMarketReadScheduler {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 2));
  const interactiveReserve = Math.min(
    Math.max(0, Math.floor(options.interactiveReserve ?? 0)),
    Math.max(0, concurrency - 1),
  );
  const backgroundConcurrency = concurrency - interactiveReserve;
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? 10_000));
  const entries = new Map<string, ReadEntry<unknown>>();
  const queue: ReadEntry<unknown>[] = [];
  let active = 0;
  let activeBackground = 0;
  let disposed = false;

  const timeoutReason = () =>
    new DOMException("本地行情读取超时", "TimeoutError");

  const removeEntry = <T>(entry: ReadEntry<T>) => {
    if (entries.get(entry.key) === entry) entries.delete(entry.key);
  };

  const armActiveTimeout = (entry: ReadEntry<unknown>) => {
    entry.timeout = setTimeout(() => {
      if (entry.state !== "active") return;
      const reason = timeoutReason();
      entry.controller.abort(reason);
      // Reject subscribers immediately even if a legacy repository ignores
      // AbortSignal. The active slot remains occupied until the task settles.
      entry.reject(reason);
    }, timeoutMs);
  };

  const pump = () => {
    while (!disposed && active < concurrency && queue.length > 0) {
      const runnableIndex = queue.findIndex((entry) =>
        entry.state === "queued" &&
        (entry.priority === "interactive" || activeBackground < backgroundConcurrency),
      );
      if (runnableIndex < 0) return;
      const [entry] = queue.splice(runnableIndex, 1);
      if (entry.state !== "queued") continue;
      entry.state = "active";
      active += 1;
      if (entry.priority === "background") activeBackground += 1;
      armActiveTimeout(entry);
      let taskPromise: Promise<unknown>;
      try {
        taskPromise = entry.task(entry.controller.signal);
      } catch (error) {
        taskPromise = Promise.reject(error);
      }
      void taskPromise.then(
        (value) => {
          // Mark the entry settled before resolving subscribers. Their
          // release() runs in a promise reaction before this task's finally;
          // keeping state=active there aborts a request that already won.
          entry.state = "settled";
          removeEntry(entry);
          entry.resolve(value);
        },
        (reason) => {
          entry.state = "settled";
          removeEntry(entry);
          entry.reject(reason);
        },
      ).finally(() => {
        if (entry.timeout) clearTimeout(entry.timeout);
        active -= 1;
        if (entry.priority === "background") activeBackground -= 1;
        pump();
      });
    }
  };

  const cancelEntryIfUnused = (entry: ReadEntry<unknown>) => {
    if (entry.subscribers > 0 || entry.state === "settled") return;
    entry.controller.abort(new DOMException("行情读取已取消", "AbortError"));
    if (entry.state === "queued") {
      if (entry.timeout) clearTimeout(entry.timeout);
      entry.state = "settled";
      removeEntry(entry);
      entry.reject(entry.controller.signal.reason);
      pump();
    }
  };

  const subscribe = <T>(entry: ReadEntry<T>, signal?: AbortSignal): Promise<T> => {
    if (signal?.aborted) {
      cancelEntryIfUnused(entry as ReadEntry<unknown>);
      return rejected<T>(abortError(signal));
    }

    entry.subscribers += 1;
    let settled = false;
    let onAbort: (() => void) | undefined;
    const promise = new Promise<T>((resolve, reject) => {
      const release = () => {
        if (settled) return;
        settled = true;
        entry.subscribers -= 1;
        if (onAbort && signal) signal.removeEventListener("abort", onAbort);
        cancelEntryIfUnused(entry as ReadEntry<unknown>);
      };
      onAbort = () => {
        if (settled) return;
        release();
        reject(abortError(signal));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      entry.promise.then(
        (value) => {
          if (settled) return;
          release();
          resolve(value);
        },
        (reason) => {
          if (settled) return;
          release();
          reject(reason);
        },
      );
    });
    return promise;
  };

  const read = <T>(
    key: string,
    task: ReadTask<T>,
    signal?: AbortSignal,
    priority: HomeMarketReadPriority = "background",
  ) => {
    if (disposed) return rejected<T>(new DOMException("行情读取调度器已释放", "AbortError"));
    if (signal?.aborted) return rejected<T>(abortError(signal));

    let entry = entries.get(key) as ReadEntry<T> | undefined;
    // An abandoned active task may still be settling after its request
    // signal was aborted. It cannot be reused by a newer consumer; keeping
    // it in the active count still preserves the concurrency bound.
    if (entry?.controller.signal.aborted) {
      if (entries.get(key) === entry) entries.delete(key);
      entry = undefined;
    }
    if (entry && priority === "interactive" && entry.priority === "background" && entry.state === "queued") {
      entry.priority = "interactive";
      const queuedIndex = queue.indexOf(entry as ReadEntry<unknown>);
      if (queuedIndex >= 0) {
        queue.splice(queuedIndex, 1);
        const firstBackground = queue.findIndex((queued) => queued.priority === "background");
        if (firstBackground < 0) queue.push(entry as ReadEntry<unknown>);
        else queue.splice(firstBackground, 0, entry as ReadEntry<unknown>);
      }
      // Promotion can make the reserved interactive slot runnable while all
      // background capacity is occupied. Dispatch immediately instead of
      // waiting for an unrelated read to settle.
      pump();
    }
    if (!entry) {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      entry = {
        key,
        task,
        priority,
        controller: new AbortController(),
        promise,
        resolve,
        reject,
        state: "queued",
        subscribers: 0,
      };
      entries.set(key, entry as ReadEntry<unknown>);
      const queuedEntry = entry as ReadEntry<unknown>;
      if (priority === "interactive") {
        const firstBackground = queue.findIndex((queued) => queued.priority === "background");
        if (firstBackground < 0) queue.push(queuedEntry);
        else queue.splice(firstBackground, 0, queuedEntry);
      } else {
        queue.push(queuedEntry);
      }
      pump();
    }
    return subscribe(entry, signal);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const entry of entries.values()) {
      const reason = new DOMException("行情读取已取消", "AbortError");
      entry.controller.abort(reason);
      if (entry.timeout) clearTimeout(entry.timeout);
      if (entry.state === "queued") {
        entry.state = "settled";
      }
      // A legacy repository may ignore AbortSignal. Reject the shared promise
      // now so unmount cannot leave subscribers waiting for that repository.
      entry.reject(reason);
    }
    queue.length = 0;
    entries.clear();
  };

  return { read, dispose };
}
