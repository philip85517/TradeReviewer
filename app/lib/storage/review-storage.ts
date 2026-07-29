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

export type StoredReviewState =
  EpisodeReviewState;

type LoadedReviewState = EpisodeReviewState & {
  legacyThesis?: string;
};

type PersistedReviewState =
  | EpisodeReviewState
  | LegacyStoredReviewState;

const LEGACY_PREFIX = "trade-reviewer:review:v1";
const PREFIX = "trade-reviewer:review:v2";

function storageKey(episodeId: string) {
  return `${PREFIX}:${episodeId}`;
}

function legacyStorageKey(episodeId: string) {
  return `${LEGACY_PREFIX}:${episodeId}`;
}

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

function normalizeState(
  episodeId: string,
  state: PersistedReviewState,
): LoadedReviewState {
  return {
    version: 2,
    episodeId,
    replayCursor: state.replayCursor,
    timeframe: state.timeframe,
    activePanelTab: state.version === 2 ? state.activePanelTab : "stats",
    drawings: normalizeDrawings(
      state.drawings,
      episodeId,
      state.replayCursor,
    ),
    ...(state.version === 1
      ? { legacyThesis: state.thesis }
      : {}),
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

function parseStoredState(value: unknown): PersistedReviewState | null {
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
}

function readStoredState(key: string) {
  const serialized = window.localStorage.getItem(key);
  if (!serialized) return null;
  try {
    return parseStoredState(JSON.parse(serialized) as unknown);
  } catch {
    return null;
  }
}

function toPersistedState(state: LoadedReviewState): EpisodeReviewState {
  return {
    version: 2,
    episodeId: state.episodeId,
    replayCursor: state.replayCursor,
    timeframe: state.timeframe,
    activePanelTab: state.activePanelTab,
    drawings: state.drawings,
  };
}

export function saveReviewState(
  episodeId: string,
  state: StoredReviewState,
) {
  if (typeof window === "undefined") return;
  const normalized = normalizeState(episodeId, state);
  window.localStorage.setItem(
    storageKey(episodeId),
    JSON.stringify(toPersistedState(normalized)),
  );
}

export function loadReviewState(
  episodeId: string,
): LoadedReviewState | null {
  if (typeof window === "undefined") return null;
  const current = readStoredState(storageKey(episodeId));
  if (current?.version === 2) {
    return normalizeState(episodeId, current);
  }

  const legacy = readStoredState(legacyStorageKey(episodeId));
  if (!legacy || legacy.version !== 1) return null;
  const migrated = normalizeState(episodeId, legacy);
  window.localStorage.setItem(
    storageKey(episodeId),
    JSON.stringify(toPersistedState(migrated)),
  );
  return migrated;
}
