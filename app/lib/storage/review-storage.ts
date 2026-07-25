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
  localStorage.setItem(storageKey(episodeId), JSON.stringify(state));
}

export function loadReviewState(
  episodeId: string,
): StoredReviewState | null {
  const serialized = localStorage.getItem(storageKey(episodeId));
  if (!serialized) return null;

  try {
    const parsed = JSON.parse(serialized) as StoredReviewState;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}
