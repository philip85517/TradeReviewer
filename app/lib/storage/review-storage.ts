import type { Drawing } from "../chart/drawings";
import type { Timeframe } from "../market/types";

export type StoredReviewState = {
  version: 1;
  replayCursor: string;
  timeframe: Timeframe;
  thesis: string;
  drawings: Drawing[];
};

const PREFIX = "trade-reviewer:review:v1";

function storageKey(episodeId: string) {
  return `${PREFIX}:${episodeId}`;
}

export function saveReviewState(
  episodeId: string,
  state: StoredReviewState,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(episodeId), JSON.stringify(state));
}

export function loadReviewState(
  episodeId: string,
): StoredReviewState | null {
  if (typeof window === "undefined") return null;
  const serialized = window.localStorage.getItem(storageKey(episodeId));
  if (!serialized) return null;

  try {
    const parsed = JSON.parse(serialized) as StoredReviewState;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
