import {
  normalizeDrawing,
  type LegacyDrawing,
  type NormalizedDrawing,
} from "../chart/drawings";
import type { Timeframe } from "../market/types";

export type EpisodeReviewState = {
  version: 2;
  episodeId: string;
  replayCursor: string;
  timeframe: Timeframe;
  activePanelTab: "stats" | "notes";
  drawings: NormalizedDrawing[];
};

type LegacyStoredReviewState = {
  version: 1;
  replayCursor: string;
  timeframe: Timeframe;
  thesis: string;
  drawings: LegacyDrawing[];
};

export type StoredReviewState = EpisodeReviewState;
export type PersistedReviewState = EpisodeReviewState | LegacyStoredReviewState;
export type LoadedReviewState = EpisodeReviewState & { legacyThesis?: string };

function isDrawingLike(value: unknown): value is LegacyDrawing {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LegacyDrawing).id === "string" &&
      Array.isArray((value as LegacyDrawing).anchors),
  );
}

function normalizeDrawings(
  drawings: unknown[],
  episodeId: string,
  replayCursor: string,
) {
  return drawings.flatMap((drawing, zIndex) => {
    if (!isDrawingLike(drawing)) return [];
    try {
      return [normalizeDrawing(drawing, episodeId, replayCursor, zIndex)];
    } catch {
      return [];
    }
  });
}

export function normalizeReviewState(
  episodeId: string,
  state: PersistedReviewState,
): LoadedReviewState {
  return {
    version: 2,
    episodeId,
    replayCursor: state.replayCursor,
    timeframe: state.timeframe,
    activePanelTab: state.version === 2 ? state.activePanelTab : "stats",
    drawings: normalizeDrawings(state.drawings, episodeId, state.replayCursor),
    ...(state.version === 1 ? { legacyThesis: state.thesis } : {}),
  };
}

function isValidTimeframe(value: unknown): value is Timeframe {
  return (
    value === "15m" ||
    value === "1h" ||
    value === "4h" ||
    value === "1D" ||
    value === "1W"
  );
}

export function parsePersistedReviewState(
  serialized: string | null,
): PersistedReviewState | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as unknown;
    if (!value || typeof value !== "object") return null;
    const state = value as Partial<PersistedReviewState>;
    if (
      typeof state.replayCursor !== "string" ||
      !isValidTimeframe(state.timeframe) ||
      !Array.isArray(state.drawings)
    ) {
      return null;
    }
    if (state.version === 1 && typeof state.thesis === "string") {
      return state as LegacyStoredReviewState;
    }
    if (
      state.version === 2 &&
      typeof state.episodeId === "string" &&
      (state.activePanelTab === "stats" || state.activePanelTab === "notes")
    ) {
      return state as EpisodeReviewState;
    }
    return null;
  } catch {
    return null;
  }
}

/** Parses and normalizes stored review JSON without reading or writing storage. */
export function parseStoredReviewState(
  episodeId: string,
  serialized: string | null,
): LoadedReviewState | null {
  const state = parsePersistedReviewState(serialized);
  return state ? normalizeReviewState(episodeId, state) : null;
}
