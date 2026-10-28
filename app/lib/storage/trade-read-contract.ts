import type { materializeStoredTradeSnapshot, StoredTradeSelection } from "./stored-trade-snapshot";
import type { StorageBootstrap } from "./sqlite-contracts";

export type TradeSnapshot = ReturnType<typeof materializeStoredTradeSnapshot>;
export type TradeReadPage = {
  snapshot: TradeSnapshot;
  /** Same copy transaction; legacy desktop display projection, never a write candidate. */
  display: Pick<StorageBootstrap, "executions" | "instruments" | "importHistory">;
  payloadDigest: string;
};
export type TradeBookRead = TradeReadPage["display"] & {
  bookVersion: TradeSnapshot["bookVersion"];
  facts: TradeSnapshot["facts"];
  pages: TradeReadPage[];
};
export type { StoredTradeSelection };

export function encodeTradeRead(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(encodeTradeRead).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${encodeTradeRead(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function tradeReadDigest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encodeTradeRead(value)));
  return `sha256:${Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, "0")).join("")}`;
}

export async function parseTradeReadPage(value: unknown): Promise<TradeReadPage> {
  if (!value || typeof value !== "object") throw new Error("Invalid trade read");
  // Own the wire value before the first asynchronous digest check.
  const page = JSON.parse(JSON.stringify(value)) as TradeReadPage;
  const snapshot = page.snapshot;
  if (!snapshot || !validBookVersion(snapshot.bookVersion) || !Array.isArray(snapshot.facts) || !Array.isArray(snapshot.displayExecutionIds) || !Array.isArray(snapshot.dependencyExecutionIds) || !Array.isArray(snapshot.materialHistory) || !Array.isArray(snapshot.materials) || !Array.isArray(snapshot.withdrawnFacts) || !snapshot.receipt || snapshot.receipt.policy !== "stored-trade-snapshot-v1" || typeof snapshot.receipt.receiptId !== "string" || !snapshot.receipt.receiptId || typeof snapshot.receipt.knownAt !== "string" || !Number.isFinite(Date.parse(snapshot.receipt.knownAt)) || (snapshot.nextCursor !== null && (typeof snapshot.nextCursor !== "string" || !snapshot.nextCursor)) || !Array.isArray(page.display?.executions) || !Array.isArray(page.display?.instruments) || !Array.isArray(page.display?.importHistory)) throw new Error("Invalid trade read");
  const { receipt, ...payload } = snapshot;
  if (receipt.payloadDigest !== await tradeReadDigest(payload) || page.payloadDigest !== await tradeReadDigest({ snapshot, display: page.display })) throw new Error("Trade read digest mismatch");
  if (snapshot.facts.some(f => typeof f.id !== "string" || (f.accountId !== null && typeof f.accountId !== "string") || typeof f.quantity !== "string" || typeof f.price !== "string" || (f.fee !== null && typeof f.fee !== "string"))) throw new Error("Invalid trade fact");
  const ids = new Set(snapshot.facts.map(f => f.id));
  const displayIds = new Set(snapshot.displayExecutionIds), dependencyIds = new Set(snapshot.dependencyExecutionIds);
  const projectedIds = new Set(page.display.executions.map(e => e.id));
  if (ids.size !== snapshot.facts.length || displayIds.size !== snapshot.displayExecutionIds.length || dependencyIds.size !== snapshot.dependencyExecutionIds.length || [...displayIds].some(id => !ids.has(id) || dependencyIds.has(id)) || [...dependencyIds].some(id => !ids.has(id)) || displayIds.size + dependencyIds.size !== ids.size || projectedIds.size !== page.display.executions.length || projectedIds.size !== displayIds.size || [...displayIds].some(id => !projectedIds.has(id))) throw new Error("Invalid display projection");
  const instruments = new Set(page.display.instruments.map(i => i.id));
  const histories = new Set(page.display.importHistory.map(i => i.id));
  if (instruments.size !== page.display.instruments.length || histories.size !== page.display.importHistory.length || page.display.instruments.some(i => typeof i.id !== "string" || !i.id || typeof i.symbol !== "string" || typeof i.name !== "string" || typeof i.currency !== "string" || typeof i.market !== "string") || page.display.importHistory.some(i => typeof i.id !== "string" || !i.id)) throw new Error("Invalid trade metadata");
  const instrumentById = new Map(page.display.instruments.map(i => [i.id, i]));
  const sameInstrument = (a: TradeSnapshot["facts"][number]["instrument"], b: TradeSnapshot["facts"][number]["instrument"] | undefined) => !!a && !!b && ["id", "symbol", "name", "market", "currency"].every(key => a[key as keyof typeof a] === b[key as keyof typeof b]);
  if (snapshot.facts.some(f => f.instrument?.id !== f.instrumentId || !sameInstrument(f.instrument, instrumentById.get(f.instrumentId)))) throw new Error("Trade instrument differs from raw metadata");
  for (const e of page.display.executions) {
    const raw = snapshot.facts.find(f => f.id === e.id);
    if (!raw || !sameInstrument(e.instrument, raw.instrument) || e.accountId !== (raw.accountId ?? "") || e.quantity !== raw.quantity || e.price !== raw.price || e.executedAt !== raw.executedAt || e.side !== raw.side || e.fee !== (raw.fee ?? "") || (raw.fee === null && e.source?.feeStatus !== "unknown")) throw new Error("Trade projection differs from raw facts");
  }
  for (const count of [receipt.totalDisplayFacts, receipt.totalDependencyFacts, receipt.displayOffset]) if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid trade read counts");
  if (receipt.pageComplete !== (snapshot.nextCursor === null) || receipt.displayOffset + snapshot.displayExecutionIds.length > receipt.totalDisplayFacts) throw new Error("Incomplete trade read");
  return page;
}

export function validBookVersion(value: unknown): value is TradeSnapshot["bookVersion"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as TradeSnapshot["bookVersion"];
  return typeof v.databaseId === "string" && !!v.databaseId.trim() && typeof v.epoch === "string" && !!v.epoch.trim() && Number.isSafeInteger(v.sequence) && v.sequence >= 0;
}
export async function assertTradeReadSelection(page: TradeReadPage, selection: StoredTradeSelection = {}) {
  const axis = (values: readonly string[] | undefined) => values === undefined ? null : [...new Set(values)].sort();
  const normalized = { accounts: axis(selection.accounts), markets: axis(selection.markets), instruments: axis(selection.instruments), period: selection.period ?? null, pageSize: selection.pageSize ?? 500 };
  if (page.snapshot.receipt.selectionDigest !== await tradeReadDigest(normalized) || encodeTradeRead(page.snapshot.scope.selection) !== encodeTradeRead(normalized)) throw new Error("Trade selection mismatch");
  if (selection.version) {
    const exact = "exact" in selection.version;
    const expected = "exact" in selection.version ? selection.version.exact : selection.version.atLeast;
    const actual = page.snapshot.bookVersion;
    if (!validBookVersion(expected) || actual.databaseId !== expected.databaseId || actual.epoch !== expected.epoch || (exact ? actual.sequence !== expected.sequence : actual.sequence < expected.sequence)) throw new Error("Trade version mismatch");
  }
}

/** Completeness and page continuity checks, shared by the client and homepage. */
export function assembleTradeReadPages(pages: readonly TradeReadPage[]): TradeBookRead {
  const first = pages[0];
  if (!first) throw new Error("Missing trade pages");
  const ids = new Set<string>(), dependencies = new Set<string>(), facts = new Map<string, TradeSnapshot["facts"][number]>(), cursors = new Set<string>(), materialHistory = new Map<string, TradeSnapshot["materialHistory"][number]>();
  for (const [index, page] of pages.entries()) {
    const s = page.snapshot, r = s.receipt;
    if (!validBookVersion(s.bookVersion) || encodeTradeRead(s.bookVersion) !== encodeTradeRead(first.snapshot.bookVersion) || r.selectionDigest !== first.snapshot.receipt.selectionDigest || r.totalDisplayFacts !== first.snapshot.receipt.totalDisplayFacts || r.totalDependencyFacts !== first.snapshot.receipt.totalDependencyFacts || r.displayOffset !== ids.size || encodeTradeRead(page.display.instruments) !== encodeTradeRead(first.display.instruments) || encodeTradeRead(page.display.importHistory) !== encodeTradeRead(first.display.importHistory)) throw new Error("Mixed trade pages");
    const projected = new Set(page.display.executions.map(e => e.id));
    if (projected.size !== page.display.executions.length || projected.size !== s.displayExecutionIds.length || s.displayExecutionIds.some(id => !projected.has(id))) throw new Error("Missing display facts");
    for (const id of s.displayExecutionIds) { if (ids.has(id)) throw new Error("Repeated trade page"); ids.add(id); }
    for (const id of s.dependencyExecutionIds) dependencies.add(id);
    for (const material of s.materialHistory) {
      if (materialHistory.has(material.id) && encodeTradeRead(materialHistory.get(material.id)) !== encodeTradeRead(material)) throw new Error("Mixed material history");
      materialHistory.set(material.id, material);
    }
    for (const f of s.facts) { if (facts.has(f.id) && encodeTradeRead(facts.get(f.id)) !== encodeTradeRead(f)) throw new Error("Mixed trade facts"); facts.set(f.id, f); }
    const last = index === pages.length - 1;
    if (r.pageComplete !== (s.nextCursor === null) || last !== r.pageComplete) throw new Error("Missing trade page");
    if (s.nextCursor !== null) {
      if (!s.displayExecutionIds.length || cursors.has(s.nextCursor)) throw new Error("Repeated trade cursor");
      cursors.add(s.nextCursor);
    }
  }
  if (ids.size !== first.snapshot.receipt.totalDisplayFacts || dependencies.size !== first.snapshot.receipt.totalDependencyFacts || [...dependencies].some(id => ids.has(id)) || ids.size + dependencies.size !== facts.size) throw new Error("Incomplete trade collection");
  return { bookVersion: first.snapshot.bookVersion, facts: [...facts.values()], executions: pages.flatMap(p => p.display.executions), instruments: first.display.instruments, importHistory: first.display.importHistory, pages: [...pages] };
}

/** Null remains authoritative; only the desktop display carrier uses empty text. */
export function tradeDisplayProjection(snapshot: TradeSnapshot, display: TradeReadPage["display"]): TradeReadPage["display"] {
  const visible = new Set(snapshot.displayExecutionIds);
  const raw = new Map(snapshot.facts.map(f => [f.id, f]));
  return { ...display, executions: display.executions.filter(e => visible.has(e.id)).map(e => raw.get(e.id)?.fee === null ? { ...e, source: { ...e.source, feeStatus: "unknown" as const } } : e) };
}
