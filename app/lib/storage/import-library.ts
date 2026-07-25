import type { TradeEpisode } from "../trades/types";

const STORAGE_KEY = "trade-reviewer:imports:v1";

function isEpisode(value: unknown): value is TradeEpisode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TradeEpisode>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.accountId === "string" &&
    typeof candidate.instrument?.id === "string" &&
    typeof candidate.instrument.symbol === "string" &&
    Array.isArray(candidate.executions) &&
    candidate.executions.every(
      (execution) =>
        execution &&
        typeof execution.id === "string" &&
        typeof execution.executedAt === "string" &&
        (execution.side === "buy" || execution.side === "sell"),
    )
  );
}

export function saveImportedEpisodes(episodes: TradeEpisode[]) {
  if (typeof window === "undefined") return;
  const unique = [...new Map(episodes.map((item) => [item.id, item])).values()];
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, episodes: unique }),
  );
}

export function loadImportedEpisodes(): TradeEpisode[] {
  if (typeof window === "undefined") return [];
  const serialized = window.localStorage.getItem(STORAGE_KEY);
  if (!serialized) return [];

  try {
    const parsed = JSON.parse(serialized) as {
      version?: unknown;
      episodes?: unknown;
    };
    if (parsed.version !== 1 || !Array.isArray(parsed.episodes)) return [];
    return parsed.episodes.filter(isEpisode);
  } catch {
    return [];
  }
}
