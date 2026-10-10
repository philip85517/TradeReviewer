import { latestCompletedSessionAt } from "./sync-range";
import type { SupportedMarket } from "./contracts";

export type HoldingsRefreshInstrument = {
  instrumentId: string;
  market: string;
};

function supportedMarket(value: string): SupportedMarket | null {
  const normalized = value.trim().toUpperCase();
  return normalized === "US" || normalized === "HK" || normalized === "CN-SH" || normalized === "CN-SZ"
    ? normalized
    : null;
}

/**
 * A stable automatic-attempt key. The session component deliberately uses a
 * completed market session rather than a wall-clock minute so a ticking
 * `holdingsAsOf` does not create a retry loop.
 */
export function buildHoldingsRefreshAttemptKey(input: {
  scopeKey: string;
  asOf: string;
  instruments: readonly HoldingsRefreshInstrument[];
}): string {
  const sessions = input.instruments
    .map(instrument => {
      const market = supportedMarket(instrument.market);
      if (!market) return `${instrument.instrumentId}@unknown`;
      try {
        return `${instrument.instrumentId}@${latestCompletedSessionAt(market, input.asOf).session}`;
      } catch {
        return `${instrument.instrumentId}@pending`;
      }
    })
    .sort();
  return `${input.scopeKey}|${sessions.join(",")}`;
}

export type HoldingsRefreshRequestResult<T> = {
  value?: T;
  shared: boolean;
  instrumentIds: readonly string[];
};
export type HoldingsRefreshTrigger = "automatic" | "manual";

type ActiveTask<T> = {
  ids: Set<string>;
  owners: Map<string, number>;
  promise: Promise<T | undefined>;
  started: boolean;
  cancelled: boolean;
};

function mergeRefreshResults<T>(values: readonly (T | undefined)[]): T | undefined {
  if (values.some(value => value === false)) return false as T;
  const explicitFailure = values.find(value => value && typeof value === "object"
    && "ok" in value && (value as { ok?: unknown }).ok === false);
  if (explicitFailure !== undefined) return explicitFailure;
  const receipts = values
    .map(value => value && typeof value === "object" && "ok" in value
      && (value as { ok?: unknown }).ok === true
      && "requestedAtByInstrument" in value
      ? value as {
        ok: true;
        requestedAtByInstrument: Readonly<Record<string, string | undefined>>;
        dailyStatusByInstrument?: Readonly<Record<string, string | undefined>>;
      }
      : null)
    .filter((value): value is {
      ok: true;
      requestedAtByInstrument: Readonly<Record<string, string | undefined>>;
      dailyStatusByInstrument?: Readonly<Record<string, string | undefined>>;
    } => value !== null);
  if (receipts.length > 0) {
    return {
      ok: true,
      requestedAtByInstrument: Object.assign({}, ...receipts.map(value => value.requestedAtByInstrument)),
      ...(receipts.some(value => value.dailyStatusByInstrument !== undefined)
        ? { dailyStatusByInstrument: Object.assign({}, ...receipts.map(value => value.dailyStatusByInstrument ?? {})) }
        : {}),
    } as T;
  }
  return values.find(value => value !== undefined);
}

/**
 * Coalesce same-page holdings refreshes before the global market lock. An
 * overlapping request waits for the active task; if it adds new instruments,
 * only those new ids are run after the existing task settles. Disjoint tasks
 * are serialized as finite queue entries as well.
 */
export function createHoldingsRefreshCoalescer<T>(
  run: (instrumentIds: readonly string[], trigger: HoldingsRefreshTrigger) => Promise<T> | T,
) {
  let runner = run;
  let tail: Promise<T | undefined> = Promise.resolve(undefined);
  const active = new Set<ActiveTask<T>>();

  return {
    setRunner(next: (instrumentIds: readonly string[], trigger: HoldingsRefreshTrigger) => Promise<T> | T): void {
      runner = next;
    },
    request(instrumentIds: readonly string[], trigger: HoldingsRefreshTrigger = "manual"): Promise<HoldingsRefreshRequestResult<T>> {
      const ids = [...new Set(instrumentIds.filter(Boolean))];
      if (ids.length === 0) return Promise.resolve({ shared: false, instrumentIds: [] });
      const overlapping = [...active].filter(task => ids.some(id => task.ids.has(id)));
      for (const task of overlapping) {
        for (const id of ids) {
          if (task.owners.has(id)) task.owners.set(id, (task.owners.get(id) ?? 0) + 1);
        }
      }
      const covered = new Set(overlapping.flatMap(task => [...task.ids]));
      const remaining = ids.filter(id => !covered.has(id));
      const shared = overlapping.length > 0;
      if (remaining.length === 0) {
        return Promise.all(overlapping.map(task => task.promise)).then(values => ({
          value: mergeRefreshResults(values),
          shared: true,
          instrumentIds: [],
        }));
      }

      const taskIds = new Set(remaining);
      const taskOwners = new Map(remaining.map(id => [id, 1] as const));
      const activeTask: ActiveTask<T> = {
        ids: taskIds,
        owners: taskOwners,
        promise: Promise.resolve(undefined),
        started: false,
        cancelled: false,
      };
      const taskPromise = tail.then(() => {
        if (activeTask.cancelled) return undefined as T;
        activeTask.started = true;
        return runner([...activeTask.ids], trigger);
      });
      activeTask.promise = taskPromise;
      active.add(activeTask);
      tail = taskPromise.catch(() => undefined);
      void taskPromise.then(
        () => active.delete(activeTask),
        () => active.delete(activeTask),
      );
      return Promise.all([...overlapping.map(task => task.promise), taskPromise]).then(values => ({
        value: mergeRefreshResults(values),
        shared,
        instrumentIds: remaining,
      }));
    },
    cancel(instrumentIds: readonly string[]): void {
      const targets = new Set(instrumentIds.filter(Boolean));
      for (const task of active) {
        if (task.started) continue;
        for (const id of targets) {
          const owners = task.owners.get(id);
          if (owners === undefined) continue;
          if (owners <= 1) task.owners.delete(id);
          else task.owners.set(id, owners - 1);
        }
        task.ids = new Set(task.owners.keys());
        task.cancelled = task.ids.size === 0;
      }
    },
  };
}
