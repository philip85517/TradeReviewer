import type { StoredInstrument } from "../../lib/storage/sqlite-contracts";
import type { TradeLibraryEntry } from "../../lib/trades/library";
import { validateResolvedInstrument, type InstrumentLookup, type ResolvedInstrument } from "../../lib/instruments/metadata-contracts";
import { canonicalInstrumentSymbol } from "../../lib/instruments/display-name";
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
/** Navigation membership only: it never assigns a financial class to an unknown carrier. */
export function buildHomepageCatalog(entries: readonly TradeLibraryEntry[], stored: readonly StoredInstrument[]): HomepageCatalog {
  const sources = new Map<string, { records: StoredInstrument[]; hasExecutions: boolean }>();
  const add = (instrument: StoredInstrument, hasExecutions: boolean) => {
    const group = sources.get(instrument.id) ?? { records: [], hasExecutions: false };
    group.records.push(instrument);
    group.hasExecutions ||= hasExecutions;
    sources.set(instrument.id, group);
  };
  for (const instrument of stored) add(instrument, false);
  for (const entry of entries) {
    add(entry.instrument, false);
    for (const fill of entry.executions) add(fill.instrument, true);
    for (const { episode } of entry.episodes) {
      add(episode.instrument, false);
      for (const fill of episode.executions) add(fill.instrument, true);
    }
  }
  const byBase = new Map<string, HomepageCatalogItem[]>();
  const items: HomepageCatalogItem[] = [];
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
    const symbols = new Set(group.records.map(record => `${record.market}:${canonicalInstrumentSymbol(record.symbol, record.market)}:${record.currency}`));
    const exchanges = new Set(metadata.flatMap(record => record.exchange ? [record.exchange.code] : []));
    const classes = new Set(metadata.map(record => record.assetType));
    const conflict = symbols.size > 1 || exchanges.size > 1 || classes.size > 1;
    const symbol = canonicalInstrumentSymbol(instrument.symbol, instrument.market);
    const base = !invalid && !conflict ? homepageInstrumentIdentity({ ...instrument, symbol }, metadata.find(record => record.exchange)?.exchange) : null;
    const assetType = classes.size === 1 && !invalid && !conflict ? metadata[0].assetType : "unknown";
    const reason = invalid ? "已存证券元数据证据无效，身份待解析" : conflict ? "证券代码、币种、交易所或类别证据冲突，身份待解析" : !base ? "交易所证据尚未解析" : assetType === "unknown" ? "证券类别证据尚未解析" : null;
    const item: HomepageCatalogItem = {
      key: `instrument:${id}`, identity: null, instrumentIds: [id],
      name: metadata[0]?.localizedName?.name ?? metadata[0]?.name ?? instrument.name,
      symbol, market: instrument.market, currency: instrument.currency, exchange: base?.split(":")[0] ?? null,
      assetType, hasExecutions: group.hasExecutions, reason,
      searchText: [...group.records.flatMap(record => [record.name, record.symbol]), ...metadata.flatMap(record => [record.name, record.localizedName?.name ?? ""]), symbol, base ?? "", assetType === "stock" ? "股票" : assetType === "etf" ? "ETF" : "类别未知"].join(" ").toLocaleLowerCase(),
    };
    if (base) byBase.set(base, [...byBase.get(base) ?? [], item]);
    else items.push(item);
  }
  const identities: Record<string, readonly string[]> = {};
  const merge = (members: HomepageCatalogItem[], identity: string, assetType: HomepageCatalogItem["assetType"], reason: string | null) => {
    const instrumentIds = [...new Set(members.flatMap(item => item.instrumentIds))].sort();
    identities[identity] = instrumentIds;
    items.push({ ...members[0], key: identity, identity, instrumentIds, assetType, reason,
      hasExecutions: members.some(item => item.hasExecutions), searchText: members.map(item => item.searchText).join(" ") });
  };
  for (const [base, members] of byBase) {
    // A navigation alias must not erase a settlement-currency conflict.
    if (new Set(members.map(item => item.currency)).size > 1) {
      items.push(...members.map(item => ({ ...item, reason: "证券币种证据冲突，身份待解析" })));
      continue;
    }
    const classes = [...new Set(members.flatMap(item => item.assetType === "unknown" ? [] : [item.assetType]))];
    const unknown = members.filter(item => item.assetType === "unknown");
    if (classes.length > 1) {
      for (const assetType of classes) merge(members.filter(item => item.assetType === assetType), `${base}:${assetType}`, assetType, null);
      items.push(...unknown.map(item => ({ ...item, reason: "同代码证券类别证据冲突，未知类别无法确定交易集合" })));
    } else if (unknown.length) {
      merge(members, base, "unknown", "部分或全部原始证券类别尚未证明");
      // A typed legacy URL remains restricted to the carriers with that evidence.
      for (const assetType of classes) identities[`${base}:${assetType}`] = members.filter(item => item.assetType === assetType).flatMap(item => item.instrumentIds).sort();
    } else {
      const identity = `${base}:${classes[0]}`;
      merge(members, identity, classes[0], null);
      identities[base] = identities[identity];
    }
  }
  return { items: items.sort((left, right) => left.key.localeCompare(right.key)), identities };
}

/** The same catalog decides forward selection and a raw holding's destination. */
export function resolveHomepageCatalogInstrument(catalog: HomepageCatalog, instrumentId: string): HomepageCatalogItem | null {
  return catalog.items.find(item => item.instrumentIds.includes(instrumentId)) ?? null;
}
export function searchHomepageCatalog(catalog: HomepageCatalog, query: string): HomepageCatalogItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized ? catalog.items.filter(item => item.searchText.includes(normalized)) : [];
}
