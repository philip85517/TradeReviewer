import { exclusionReasonLabel } from "./dashboard";
import { buildRoomMoneyView, type RoomFxSnapshot, type RoomMoneyAmount, type RoomMoneyView, type RoomTargetCurrency, type TradingRoomRow } from "./trading-room-scope";

export type RoomContributionDimension = "market" | "instrument" | "account";
export type RoomContributionGroup = { id: string; label: string; detail: string; count: number; episodeIds: string[]; money: RoomMoneyView };
export type RoomContributionModel = {
  dimensions: Record<RoomContributionDimension, RoomContributionGroup[]>;
  total: RoomMoneyView;
  includedCount: number;
  excluded: { episodeId: string; reason: string }[];
};

function market(value: string): { id: string; label: string } {
  const normalized = value.trim().toUpperCase();
  if (["CN", "CN-SH", "CN-SZ", "SH", "SZ", "SSE", "SZSE"].includes(normalized)) return { id: "CN", label: "A股" };
  if (normalized === "US") return { id: "US", label: "美股" };
  if (normalized === "HK") return { id: "HK", label: "港股" };
  return { id: normalized || "unknown", label: normalized || "未知市场" };
}

/** Pass the same scoped room rows and FX snapshot as the closed-performance summary. */
export function buildRoomContribution(rows: readonly TradingRoomRow[], fxSnapshot?: RoomFxSnapshot, targetCurrency?: RoomTargetCurrency): RoomContributionModel {
  const buckets: Record<RoomContributionDimension, Map<string, Omit<RoomContributionGroup, "money"> & { amounts: RoomMoneyAmount[] }>> = { market: new Map(), instrument: new Map(), account: new Map() };
  const amounts: RoomMoneyAmount[] = [];
  const excluded: RoomContributionModel["excluded"] = [];
  for (const scoped of rows) {
    const episode = scoped.row.item.episode;
    if (episode.status !== "closed") continue;
    if (scoped.assetCategory === "unknown" || scoped.trustedPnl === null) {
      excluded.push({ episodeId: episode.id, reason: scoped.assetCategory === "unknown" ? "未知资产类型，未纳入收益汇总" : exclusionReasonLabel(scoped.exclusionReason ?? "pnl-unavailable") });
      continue;
    }
    const amount = { currency: episode.instrument.currency, amount: scoped.trustedPnl };
    amounts.push(amount);
    const definitions = {
      market: { ...market(episode.instrument.market), detail: "按上市市场归属；ETF 不重复列入第二市场" },
      instrument: { id: episode.instrument.id, label: episode.instrument.name, detail: `${episode.instrument.symbol} · ${episode.instrument.market}` },
      account: { id: episode.accountId, label: episode.accountLabel || "未命名账户", detail: "独立账户" },
    };
    for (const dimension of ["market", "instrument", "account"] as const) {
      const definition = definitions[dimension];
      const group = buckets[dimension].get(definition.id) ?? { ...definition, count: 0, episodeIds: [], amounts: [] };
      group.count += 1;
      group.episodeIds.push(episode.id);
      group.amounts.push(amount);
      buckets[dimension].set(definition.id, group);
    }
  }
  const groups = (dimension: RoomContributionDimension) => {
    const ordered = [...buckets[dimension].values()].sort((a, b) => a.id.localeCompare(b.id));
    const seen = new Map<string, number>();
    return ordered.map(({ amounts: values, ...group }) => {
      const duplicate = ordered.filter(other => other.label === group.label).length > 1;
      const ordinal = (seen.get(group.label) ?? 0) + 1;
      seen.set(group.label, ordinal);
      return { ...group, label: duplicate ? `${group.label} · ${ordinal}` : group.label, money: buildRoomMoneyView(values, fxSnapshot, targetCurrency) };
    });
  };
  return { dimensions: { market: groups("market"), instrument: groups("instrument"), account: groups("account") }, total: buildRoomMoneyView(amounts, fxSnapshot, targetCurrency), includedCount: amounts.length, excluded };
}
