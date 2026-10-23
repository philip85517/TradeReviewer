import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import { validateResolvedInstrument, type InstrumentLookup, type ResolvedInstrument } from "../../lib/instruments/metadata-contracts";
import { homepageInstrumentIdentity } from "./holdings-model";

export type HomepageCatalogItem = {
  key: string;
  identity: string | null;
  instrumentIds: readonly string[];
  name: string;
  symbol: string;
  market: string;
  currency: string;
  exchange: string | null;
  assetType: "stock" | "etf" | "unknown";
  hasExecutions: boolean;
  reason: string | null;
  searchText: string;
};
export type HomepageCatalog = { items: HomepageCatalogItem[]; identities: Readonly<Record<string, readonly string[]>> };
function isMarket(market: string): market is InstrumentLookup["market"] {
  return market === "US" || market === "HK" || market === "CN-SH" || market === "CN-SZ";
}
/** A known catalog, not a claim of exchange-wide coverage or source nature. */
export function buildHomepageCatalog(entries: readonly TradeLibraryEntry[], stored: readonly StoredInstrument[]): HomepageCatalog {
  const sources = new Map<string, { records: StoredInstrument[]; hasExecutions: boolean }>();
  const add = (instrument: StoredInstrument, hasExecutions: boolean) => {
    const group = sources.get(instrument.id) ?? { records: [], hasExecutions: false };
    group.records.push(instrument); group.hasExecutions ||= hasExecutions; sources.set(instrument.id, group);
  };
  for (const instrument of stored) add(instrument, false);
  for (const entry of entries) add(entry.instrument, entry.executions.length > 0);
  const projected: Array<{ item: HomepageCatalogItem; base: string | null }> = [];
  for (const [id, group] of sources) {
    const instrument = group.records[0];
    const metadata: ResolvedInstrument[] = [];
    let invalid = false;
    for (const record of group.records) {
      if (!record.metadata) continue;
      try {
        if (!isMarket(record.market)) throw new Error("unsupported market");
        metadata.push(validateResolvedInstrument(record.metadata, { market: record.market, symbol: record.symbol }));
      } catch { invalid = true; }
    }
    metadata.sort((left, right) => Date.parse(right.resolvedAt) - Date.parse(left.resolvedAt));
    const conflictingInstrument = new Set(group.records.map(record => `${record.market}:${record.symbol}`)).size > 1;
    const exchanges = new Set(metadata.flatMap(record => record.exchange ? [record.exchange.code] : []));
    const classes = new Set(metadata.map(record => record.assetType));
    const conflict = conflictingInstrument || exchanges.size > 1 || classes.size > 1;
    const base = !invalid && !conflict ? homepageInstrumentIdentity(instrument, metadata.find(record => record.exchange)?.exchange) : null;
    const assetType = classes.size === 1 && !invalid && !conflict ? metadata[0].assetType : "unknown";
    const identity = base && assetType !== "unknown" ? `${base}:${assetType}` : null;
    const reason = invalid ? "已存证券元数据证据无效，身份待解析" : conflict ? "证券交易所或类别证据冲突，身份待解析" : !base ? "交易所证据尚未解析" : assetType === "unknown" ? "证券类别证据尚未解析" : null;
    const name = metadata[0]?.localizedName?.name ?? metadata[0]?.name ?? instrument.name;
    projected.push({ base, item: {
      key: identity ?? `instrument:${id}`, identity, instrumentIds: [id], name, symbol: instrument.symbol,
      market: instrument.market, currency: instrument.currency, exchange: base?.split(":")[0] ?? null,
      assetType, hasExecutions: group.hasExecutions, reason,
      searchText: [...group.records.map(record => record.name), ...metadata.flatMap(record => [record.name, record.localizedName?.name ?? ""]), instrument.symbol, base ?? "", assetType === "stock" ? "股票" : assetType === "etf" ? "ETF" : "类别未知"].join(" ").toLocaleLowerCase(),
    } });
  }
  const merged = new Map<string, { item: HomepageCatalogItem; base: string | null }>();
  for (const current of projected) {
    const previous = merged.get(current.item.key);
    if (!previous) { merged.set(current.item.key, current); continue; }
    previous.item = { ...previous.item, instrumentIds: [...new Set([...previous.item.instrumentIds, ...current.item.instrumentIds])].sort(), hasExecutions: previous.item.hasExecutions || current.item.hasExecutions, searchText: `${previous.item.searchText} ${current.item.searchText}` };
  }
  const groups = [...merged.values()].sort((left, right) => left.item.key.localeCompare(right.item.key));
  const identities: Record<string, readonly string[]> = {};
  const aliases = new Map<string, Array<readonly string[]>>();
  for (const { item, base } of groups) {
    if (item.identity) identities[item.identity] = item.instrumentIds;
    if (base) aliases.set(base, [...aliases.get(base) ?? [], item.instrumentIds]);
  }
  // Existing P1 URLs remain valid only when no class collision is hidden.
  for (const [base, candidates] of aliases) if (candidates.length === 1) identities[base] = candidates[0];
  return { items: groups.map(group => group.item), identities };
}
export function searchHomepageCatalog(catalog: HomepageCatalog, query: string): HomepageCatalogItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized ? catalog.items.filter(item => item.searchText.includes(normalized)) : [];
}
