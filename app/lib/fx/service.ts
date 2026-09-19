import type { DatabaseSync } from "node:sqlite";

import {
  assertFxSnapshot,
  type FxProblem,
  type FxRefreshResponse,
  type FxSnapshot,
} from "./contracts";
import { fetchLatestFxSnapshot } from "./provider";
import { readFxSnapshot, replaceFxSnapshot } from "./storage";

export type FxSnapshotFetcher = () => Promise<FxSnapshot>;

const refreshGeneration = new WeakMap<DatabaseSync, number>();

function beginRefresh(database: DatabaseSync) {
  const generation = (refreshGeneration.get(database) ?? 0) + 1;
  refreshGeneration.set(database, generation);
  return generation;
}

function isCurrentRefresh(database: DatabaseSync, generation: number) {
  return refreshGeneration.get(database) === generation;
}

type RefreshOptions = {
  fetchLatest?: FxSnapshotFetcher;
  now?: () => string;
};

function problemFrom(error: unknown): FxProblem {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return {
      code: error.code,
      message: error instanceof Error ? error.message : "汇率源暂时不可用",
    };
  }
  return {
    code: "source-unavailable",
    message: error instanceof Error ? error.message : "汇率源暂时不可用",
  };
}

export async function refreshFxSnapshot(
  database: DatabaseSync,
  options: RefreshOptions = {},
): Promise<FxRefreshResponse> {
  const generation = beginRefresh(database);
  const now = options.now ?? (() => new Date().toISOString());
  const lastAttemptedAt = now();
  const fetchLatest = options.fetchLatest ?? (() => fetchLatestFxSnapshot());

  try {
    const candidate = await fetchLatest();
    assertFxSnapshot(candidate);
    const fresh: FxSnapshot = {
      ...candidate,
      cacheStatus: "fresh",
      lastAttemptedAt,
      lastError: undefined,
    };
    if (!isCurrentRefresh(database, generation)) {
      const current = readFxSnapshot(database);
      return current
        ? { status: current.cacheStatus, snapshot: current }
        : { status: "unavailable", snapshot: null };
    }
    replaceFxSnapshot(database, fresh);
    return { status: "fresh", snapshot: fresh };
  } catch (error) {
    const problem = problemFrom(error);
    if (!isCurrentRefresh(database, generation)) {
      const current = readFxSnapshot(database);
      return current
        ? { status: current.cacheStatus, snapshot: current }
        : { status: "unavailable", snapshot: null };
    }
    const previous = readFxSnapshot(database);
    if (!previous) {
      return { status: "unavailable", snapshot: null, error: problem };
    }

    const cached: FxSnapshot = {
      ...previous,
      cacheStatus: "cached",
      lastAttemptedAt,
      lastError: problem.message,
    };
    replaceFxSnapshot(database, cached);
    return { status: "cached", snapshot: cached, error: problem };
  }
}
