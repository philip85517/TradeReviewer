import type { RoomFxSnapshot } from "../../lib/reviews/trading-room-scope";

/** Parse the read-only production response without treating missing/partial rates as complete. */
export function homepageFxSnapshot(value: unknown): RoomFxSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const state = value as Record<string, unknown>;
  if (state.baseCurrency !== "CNY" || typeof state.id !== "string" || typeof state.source !== "string" || !["complete", "partial", "missing"].includes(String(state.status))) return undefined;
  if (!state.rates || typeof state.rates !== "object" || Array.isArray(state.rates)) return undefined;
  const rates: Record<string, string> = {};
  for (const [key, rate] of Object.entries(state.rates)) if (typeof rate === "string") rates[key === "USD" || key === "HKD" ? `${key}/CNY` : key] = rate;
  const asOf = typeof state.publishedAt === "string" ? state.publishedAt : typeof state.fetchedAt === "string" ? state.fetchedAt : "";
  return { id: state.id, source: state.source, baseCurrency: "CNY", status: state.status as RoomFxSnapshot["status"], asOf, rates };
}
