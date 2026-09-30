import Decimal from "decimal.js";
import { canonicalInstrumentId } from "../instruments/display-name";
import type { StatementEvent, StatementPosition } from "../import/monthly-statement";
import { isExecutionBackedIpoAllocation, replayExecutionAt, statementEventAt, statementPositionAt } from "../import/statement-evidence";
import { expectedTradingDates } from "../market/calendar";
import type { DailyCandleRecord, SupportedMarket } from "../market/contracts";
import { marketTimeZone, marketTradingDate } from "../market/trading-date";
import { replayPositionAtPrice, type PositionLedgerSnapshot } from "../replay/position-ledger";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import { executionSettlementCurrency, type TradeExecution, type Instrument, type TradeNature } from "../trades/types";
import { tradingViewEpisodeBusinessScope } from "../trades/tradingview-account-identity";
import { dashboardEpisodeNature, dashboardEpisodeSimulationRunId, type DashboardRow } from "./dashboard";
import { buildRoomMoneyView, filterRoomRows, roomMoneyValue, roomTodayKey, type RoomFxSnapshot, type RoomMoneyView, type RoomTargetCurrency } from "./trading-room-scope";
import { buildDailyPnlPercent } from "./trading-room-time";
import type { TradingRoomHoldingsOptions } from "./trading-room-holdings";

export type HoldingsHistoryOptions = Pick<TradingRoomHoldingsOptions, "scope" | "instrumentMetadata" | "asOf" | "candlesByInstrument"> & {
  fxSnapshot?: RoomFxSnapshot;
  targetCurrency?: RoomTargetCurrency;
};

export type HistoricalHolding = {
  key: string;
  instrumentId: string;
  instrumentName: string;
  accountId: string;
  currency: string;
  quantity: string | null;
  marketValue: string | null;
  cost: string | null;
  unrealizedPnl: string | null;
  unrealizedReturnPercent: string | null;
  quoteDate: string | null;
  quotePrice: string | null;
  quantityAvailable: boolean;
  marketValueAvailable: boolean;
  costAvailable: boolean;
  reasons: string[];
};

export type HoldingsHistoryPoint = {
  date: string;
  valuationDate: string;
  dailyPnl: RoomMoneyView;
  dailyPnlAvailable: boolean;
  dailyPnlReasons: string[];
  /** Independent KPI denominator: prior required-session value plus same-day buy spend including fees. */
  dailyPnlDenominator: RoomMoneyView;
  dailyPnlPercent: string | null;
  dailyPnlPercentAvailable: boolean;
  dailyPnlPercentReasons: string[];
  /** Consumer-facing aliases for the KPI card contract. */
  dailyCapital: RoomMoneyView;
  dailyReturnPercent: string | null;
  dailyReturnPercentAvailable: boolean;
  dailyReturnPercentReasons: string[];
  holdings: HistoricalHolding[];
  marketValue: RoomMoneyView;
  cost: RoomMoneyView;
  unrealizedPnl: RoomMoneyView;
  unrealizedReturnPercent: string | null;
  available: boolean;
  quantityAvailable: boolean;
  marketValueAvailable: boolean;
  costAvailable: boolean;
  unrealizedPnlAvailable: boolean;
  coverage: {
    total: number;
    quantity: number;
    marketValue: number;
    cost: number;
    unrealizedPnl: number;
  };
  reasons: string[];
};

export type HoldingsHistoryModel = {
  points: HoldingsHistoryPoint[];
  start: string;
  end: string;
  reasons: string[];
  scope: HoldingsHistoryOptions["scope"];
  fxSnapshotId: string | null;
};
type Ledger = {
  key: string;
  instrumentId: string;
  instrumentName: string;
  accountId: string;
  market: string;
  instrument: Instrument;
  nature: TradeNature;
  positions: Map<string, StatementPosition>;
  events: Map<string, StatementEvent>;
  executions: Map<string, TradeExecution>;
  candles: DailyCandleRecord[];
  sessions: string[];
  holdingsCache: Map<string, HistoricalHolding | null>;
  orderedExecutions: TradeExecution[];
  boundaryDates: string[];
  snapshots: Map<string, PositionLedgerSnapshot | null>;
  shortProof: Map<string, boolean>;
  visibleExecutions: Map<string, TradeExecution[]>;
  executionCurrencies: Map<string, string[]>;
  tradesByDate: Map<string, TradeExecution[]>;
  datedEvents: Array<{ date: string; event: StatementEvent }>;
  firstEvidenceDate: string | null;
  firstExecutionDate: string | null;
  firstCorporateActionDate: string | null;
  emptyBoundaries: Set<string>;
  sessionStart: string | null;
  sessionEnd: string | null;
};

type CachedEntryLedgers = {
  calendarStart: string;
  candles: readonly DailyCandleRecord[];
  end: string;
  fingerprint: string;
  items: readonly TradeLibraryEpisode[];
  ledgers: Ledger[];
};

/**
 * Keep at most two candle projections per live entry. The key is weak, while
 * the per-entry variants are bounded, so a long-lived homepage cannot retain
 * every completed market refresh. A new entry object (metadata/review/source
 * evidence change) naturally bypasses this cache.
 */
const HISTORY_ENTRY_LEDGER_CACHE = new WeakMap<TradeLibraryEntry, CachedEntryLedgers[]>();
const EMPTY_HISTORY_CANDLES: readonly DailyCandleRecord[] = [];
const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

function historyCandlesForInstrument(
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>,
  instrumentId: string,
): readonly DailyCandleRecord[] {
  const candles = candlesByInstrument[instrumentId];
  return candles?.length ? candles : EMPTY_HISTORY_CANDLES;
}

function historyLedgerKey(row: DashboardRow): string {
  const episode = row.item.episode;
  return JSON.stringify([
    episode.accountId,
    episode.instrument.id,
    dashboardEpisodeNature(row),
    dashboardEpisodeSimulationRunId(row),
  ]);
}

function createHistoryLedger(row: DashboardRow): Ledger {
  const episode = row.item.episode;
  return {
    key: historyLedgerKey(row),
    accountId: episode.accountId,
    instrumentId: episode.instrument.id,
    instrumentName: episode.instrument.name,
    market: episode.instrument.market,
    instrument: episode.instrument,
    nature: dashboardEpisodeNature(row),
    positions: new Map(),
    events: new Map(),
    executions: new Map(),
    candles: [],
    sessions: [],
    holdingsCache: new Map(),
    orderedExecutions: [],
    boundaryDates: [],
    snapshots: new Map(),
    shortProof: new Map(),
    visibleExecutions: new Map(),
    executionCurrencies: new Map(),
    tradesByDate: new Map(),
    datedEvents: [],
    firstEvidenceDate: null,
    firstExecutionDate: null,
    firstCorporateActionDate: null,
    emptyBoundaries: new Set(),
    sessionStart: null,
    sessionEnd: null,
  };
}

function appendHistoryRow(ledger: Ledger, row: DashboardRow): void {
  const episode = row.item.episode;
  const matches = (item: {
    accountId: string;
    symbol?: string;
    market?: string;
  }) => item.accountId === episode.accountId && Boolean(
    item.symbol && item.market &&
    canonicalInstrumentId(item.symbol, item.market) ===
    canonicalInstrumentId(episode.instrument.symbol, episode.instrument.market)
  );
  const positions = [
    ...(episode.initialPosition ? [episode.initialPosition] : []),
    ...episode.executions.flatMap(e => [
      ...(e.source.statementPositions ?? []),
      ...(e.source.openingPosition ? [e.source.openingPosition] : []),
    ]),
  ];
  const events = [
    ...(episode.positionEvents ?? []),
    ...episode.executions.flatMap(e => e.source.positionEvents ?? []),
  ];
  if (ledger.nature !== "simulation") {
    for (const position of positions)
      if (matches(position))
        ledger.positions.set(JSON.stringify([
          position.accountId,
          position.market,
          position.symbol,
          position.phase,
          position.date,
          position.quantity,
        ]), position);
    for (const event of events)
      if (matches(event))
        ledger.events.set(`${event.accountId}:${event.id}`, event);
  }
  for (const original of episode.executions) {
    const at = dailyReplayExecution(original);
    ledger.executions.set(original.id, {
      ...original,
      executedAt: at,
      source: {
        ...original.source,
        tradingDate: at.slice(0, 10),
        marketCalendarDate: at.slice(0, 10),
        statementPositions: undefined,
        openingPosition: undefined,
        positionEvents: undefined,
      },
    });
  }
}

function clearHistoryDerivedCaches(ledger: Ledger): void {
  ledger.holdingsCache.clear();
  ledger.snapshots.clear();
  ledger.shortProof.clear();
  ledger.visibleExecutions.clear();
  ledger.executionCurrencies.clear();
  ledger.emptyBoundaries.clear();
}

function setHistoryLedgerSessions(
  ledger: Ledger,
  calendarStart: string,
  end: string,
  sessionsByMarket: Map<string, string[]>,
): void {
  if (ledger.sessionStart === calendarStart && ledger.sessionEnd === end)
    return;
  const sessionsKey = `${ledger.market}:${calendarStart}:${end}`;
  let sessions = sessionsByMarket.get(sessionsKey);
  if (!sessions) {
    try {
      sessions = expectedTradingDates(ledger.market as SupportedMarket, calendarStart, end);
    }
    catch {
      sessions = [];
    }
    sessionsByMarket.set(sessionsKey, sessions);
  }
  ledger.sessions = sessions;
  ledger.sessionStart = calendarStart;
  ledger.sessionEnd = end;
  clearHistoryDerivedCaches(ledger);
}

function prepareHistoryLedger(
  ledger: Ledger,
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>,
  calendarStart: string,
  end: string,
  sessionsByMarket: Map<string, string[]>,
): void {
  ledger.orderedExecutions = [...ledger.executions.values()].sort((a, b) => replayExecutionAt(a).localeCompare(replayExecutionAt(b)));
  ledger.firstExecutionDate = ledger.orderedExecutions[0]?.executedAt.slice(0, 10) ?? null;
  ledger.tradesByDate = new Map();
  for (const execution of ledger.orderedExecutions) {
    const day = execution.executedAt.slice(0, 10);
    const trades = ledger.tradesByDate.get(day) ?? [];
    trades.push(execution);
    ledger.tradesByDate.set(day, trades);
  }
  ledger.datedEvents = [...ledger.events.values()].map(event => ({ date: eventAt(event).slice(0, 10), event }));
  ledger.firstEvidenceDate = [
    ...[...ledger.positions.values()].map(p => p.date),
    ...ledger.datedEvents.map(item => item.date),
  ].sort()[0] ?? null;
  ledger.firstCorporateActionDate = ledger.datedEvents
    .filter(item => item.event.kind === "corporate-action")
    .map(item => item.date).sort()[0] ?? null;
  ledger.boundaryDates = [...new Set([
    ...ledger.orderedExecutions.map(e => replayExecutionAt(e).slice(0, 10)),
    ...[...ledger.positions.values()].map(p => statementPositionAt(p).slice(0, 10)),
    ...[...ledger.events.values()].map(e => eventAt(e).slice(0, 10)),
  ])].sort();
  ledger.candles = [...(candlesByInstrument[ledger.instrumentId] ?? [])]
    .filter(c => c.instrumentId === ledger.instrumentId && c.adjustmentMode === "raw")
    .sort((a, b) => a.tradingDate.localeCompare(b.tradingDate));
  setHistoryLedgerSessions(ledger, calendarStart, end, sessionsByMarket);
}

function buildFreshHistoryLedgers(
  rows: readonly DashboardRow[],
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>,
  calendarStart: string,
  end: string,
): Map<string, Ledger> {
  const ledgers = new Map<string, Ledger>();
  for (const row of rows) {
    const key = historyLedgerKey(row);
    let ledger = ledgers.get(key);
    if (!ledger) {
      ledger = createHistoryLedger(row);
      ledgers.set(key, ledger);
    }
    appendHistoryRow(ledger, row);
  }
  const sessionsByMarket = new Map<string, string[]>();
  for (const ledger of ledgers.values())
    prepareHistoryLedger(ledger, candlesByInstrument, calendarStart, end, sessionsByMarket);
  return ledgers;
}

function sameHistoryItems(left: readonly TradeLibraryEpisode[], right: readonly TradeLibraryEpisode[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function historyItemsFingerprint(items: readonly TradeLibraryEpisode[]): string | null {
  try {
    // The complete episode/source projection is intentional. History replay
    // consumes more than quote/fee fields (time precision, settlement, source
    // evidence, positions, events and simulation identity), so a narrow
    // fingerprint could reuse a stale ledger after an in-place fixture update.
    return JSON.stringify(items.map(item => ({
      episode: item.episode,
      reviewStatus: item.reviewStatus,
      review: item.review,
      recallReview: item.recallReview,
    })));
  }
  catch {
    // A cyclic source object is outside the persisted data contract. Do not
    // cache it rather than risk reusing a ledger with unknown inputs.
    return null;
  }
}

function cachedHistoryLedgersForEntry(
  entry: TradeLibraryEntry,
  rows: readonly DashboardRow[],
  candles: readonly DailyCandleRecord[],
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>,
  calendarStart: string,
  end: string,
): Ledger[] {
  const items = rows.map(row => row.item);
  const fingerprint = historyItemsFingerprint(items);
  if (fingerprint === null)
    return [...buildFreshHistoryLedgers(rows, candlesByInstrument, calendarStart, end).values()];
  const variants = HISTORY_ENTRY_LEDGER_CACHE.get(entry) ?? [];
  const hit = variants.find(variant =>
    variant.calendarStart === calendarStart &&
    variant.candles === candles &&
    variant.end === end &&
    variant.fingerprint === fingerprint &&
    sameHistoryItems(variant.items, items)
  );
  if (hit) {
    const sessionsByMarket = new Map<string, string[]>();
    for (const ledger of hit.ledgers)
      setHistoryLedgerSessions(ledger, calendarStart, end, sessionsByMarket);
    return hit.ledgers;
  }
  const ledgers = [...buildFreshHistoryLedgers(rows, candlesByInstrument, calendarStart, end).values()];
  const nextVariants = [
    { calendarStart, candles, end, fingerprint, items: [...items], ledgers },
    ...variants.filter(variant =>
      variant.calendarStart !== calendarStart ||
      variant.candles !== candles ||
      variant.end !== end ||
      variant.fingerprint !== fingerprint ||
      !sameHistoryItems(variant.items, items)
    ),
  ].slice(0, 2);
  HISTORY_ENTRY_LEDGER_CACHE.set(entry, nextVariants);
  return ledgers;
}

function buildHistoryLedgers(
  rows: readonly DashboardRow[],
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>,
  calendarStart: string,
  end: string,
): Map<string, Ledger> {
  const rowsByEntry = new Map<TradeLibraryEntry, DashboardRow[]>();
  for (const row of rows)
    rowsByEntry.set(row.entry, [...(rowsByEntry.get(row.entry) ?? []), row]);
  const cached = new Map<string, Ledger>();
  let canReuse = true;
  for (const [entry, entryRows] of rowsByEntry) {
    const candles = historyCandlesForInstrument(candlesByInstrument, entry.instrument.id);
    for (const ledger of cachedHistoryLedgersForEntry(entry, entryRows, candles, candlesByInstrument, calendarStart, end)) {
      if (cached.has(ledger.key)) {
        canReuse = false;
        break;
      }
      cached.set(ledger.key, ledger);
    }
    if (!canReuse) break;
  }
  return canReuse ? cached : buildFreshHistoryLedgers(rows, candlesByInstrument, calendarStart, end);
}

function decimal(value: string | null | undefined): Decimal | null {
  try {
    const number = new Decimal(value ?? "NaN");
    return number.isFinite() ? number : null;
  } catch {
    return null;
  }
}


function currency(value: string) {
  return ({
    RMB: "CNY",
    人民币: "CNY",
    港币: "HKD",
    美元: "USD"
  } as Record<string, string>)[value] ?? value.toUpperCase();
}

function upperBound(values: readonly string[], date: string): number {
  let low = 0, high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] <= date)
      low = middle + 1;
    else
      high = middle;
  }
  return low;
}

function previousSession(ledger: Ledger, date: string): string | undefined {
  const index = upperBound(ledger.sessions, date);
  return ledger.sessions[index - (ledger.sessions[index - 1] === date ? 2 : 1)];
}

function markFor(ledger: Ledger, date: string): DailyCandleRecord | undefined {
  let low = 0, high = ledger.candles.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ledger.candles[middle].tradingDate <= date)
      low = middle + 1;
    else
      high = middle;
  }
  const requiredSession = ledger.sessions[upperBound(ledger.sessions, date) - 1];
  if (!requiredSession)
    return undefined;
  // Raw candle feeds can contain labels on exchange holidays or weekends.
  // Walk back to the latest candle that is itself on this market's calendar;
  // an off-calendar label must never satisfy the required-session boundary.
  for (let index = low - 1; index >= 0; index -= 1) {
    const candidate = ledger.candles[index];
    const candidateSession = ledger.sessions[upperBound(ledger.sessions, candidate.tradingDate) - 1];
    if (candidateSession !== candidate.tradingDate)
      continue;
    // Carry only across indexed exchange closures, never a missing session.
    return candidate.tradingDate >= requiredSession ? candidate : undefined;
  }
  return undefined;
}
// Ledger dates are exchange-calendar labels. Preserve the full local clock for
// exact fills so daily projection never erases same-day execution order.

function validDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

const MARKET_EXECUTION_TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function marketExecutionTimeFormatter(market: string) {
  const timeZone = marketTimeZone(market);
  let formatter = MARKET_EXECUTION_TIME_FORMATTERS.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    MARKET_EXECUTION_TIME_FORMATTERS.set(timeZone, formatter);
  }
  return formatter;
}

function dailyReplayExecution(execution: TradeExecution): string {
  const date = validDate(execution.source.tradingDate) ?? validDate(execution.source.marketCalendarDate) ?? marketTradingDate(execution.executedAt, execution.instrument.market);
  if (execution.executedAt.length === 10 || execution.source.timePrecision === "date-only")
    return date;
  const parts = Object.fromEntries(
    marketExecutionTimeFormatter(execution.instrument.market)
      .formatToParts(new Date(execution.executedAt))
      .map(p => [p.type, p.value]),
  );
  const milliseconds = new Date(execution.executedAt).getUTCMilliseconds().toString().padStart(3, "0");
  return `${date}T${parts.hour}:${parts.minute}:${parts.second}.${milliseconds}Z`;
}

function hasRelevantLegacySimulationRows(
  entries: readonly TradeLibraryEntry[],
  scope: HoldingsHistoryOptions["scope"],
): boolean {
  if (scope.nature !== "simulation" || scope.simulationRunId !== null)
    return false;
  return entries.some(entry => entry.episodes.some(item => {
    const row = { entry, item };
    if (dashboardEpisodeNature(row) !== "simulation") return false;
    if (scope.accountIds.length > 0 && !scope.accountIds.includes(item.episode.accountId)) return false;
    return !tradingViewEpisodeBusinessScope(item.episode);
  }));
}

// Same month-end knowledge rule as ledgerEventAt; a month label never
// becomes a session-open event on an invented first day.

function eventAt(event: StatementEvent): string {
  return statementEventAt(event.date.length === 7 ? { ...event, displayTimePolicy: undefined } : event);
}

function evidenceVisible(ledger: Ledger, date: string): boolean {
  return ledger.firstEvidenceDate !== null && ledger.firstEvidenceDate <= date;
}

function boundaryAt(ledger: Ledger, date: string): string | undefined {
  return ledger.boundaryDates[upperBound(ledger.boundaryDates, date) - 1];
}

function visibleExecutionsAt(ledger: Ledger, date: string): TradeExecution[] {
  const boundary = boundaryAt(ledger, date);
  if (!boundary) return [];
  if (!ledger.visibleExecutions.has(boundary)) {
    ledger.visibleExecutions.set(boundary, ledger.orderedExecutions.filter(e => e.executedAt.slice(0, 10) <= boundary));
  }
  return ledger.visibleExecutions.get(boundary)!;
}

function executionCurrenciesAt(ledger: Ledger, date: string): string[] {
  const boundary = boundaryAt(ledger, date);
  if (!boundary) return [];
  if (!ledger.executionCurrencies.has(boundary)) {
    ledger.executionCurrencies.set(boundary, [...new Set(visibleExecutionsAt(ledger, date).map(e => currency(executionSettlementCurrency(e))))]);
  }
  return ledger.executionCurrencies.get(boundary)!;
}


function shortVerified(ledger: Ledger, executions: TradeExecution[], date: string) {
  type ProofEvent = {
    at: string;
    rank: number;
    position?: StatementPosition;
    inventory?: StatementEvent;
    execution?: TradeExecution;
  };
  const cursor = `${date}T23:59:59.999Z`;
  const visible = executions.filter(e => replayExecutionAt(e) <= cursor);
  const events: ProofEvent[] = visible.map(execution => ({
    at: replayExecutionAt(execution),
    rank: 3,
    execution
  }));
  for (const position of ledger.positions.values())
    if (statementPositionAt(position) <= cursor)
      events.push({
        at: statementPositionAt(position),
        rank: position.phase === "opening" ? 0 : 4,
        position
      });
  for (const inventory of ledger.events.values())
    if (eventAt(inventory) <= cursor && !isExecutionBackedIpoAllocation(inventory, visible))
      events.push({
        at: eventAt(inventory),
        rank: 2,
        inventory
      });
  let quantity = new Decimal(0), verified = false;
  for (const event of events.sort((a, b) => a.at.localeCompare(b.at) || a.rank - b.rank)) {
    if (event.position) {
      quantity = decimal(event.position.quantity) ?? new Decimal(0);
      verified = quantity.lt(0) && (event.position.phase === "opening" || verified);
      continue;
    }
    if (event.inventory) {
      const inventory = event.inventory;
      if (!["transfer-in", "transfer-out", "ipo", "corporate-action"].includes(inventory.kind))
        continue;
      if (inventory.kind === "ipo" && inventory.quantity === undefined)
        continue;
      // A supported inventory delta can close the short. Unknown transitions
      // cannot preserve previous short authorization either.
      const size = decimal(inventory.quantity);
      if (!size || inventory.kind === "corporate-action") {
        verified = false;
        continue;
      }
      quantity = quantity.plus(size.abs().mul(inventory.kind === "transfer-out" ? -1 : 1));
      if (quantity.gte(0))
        verified = false;
      continue;
    }
    const execution = event.execution!;
    const next = quantity.plus(new Decimal(execution.quantity).abs().mul(execution.side === "buy" ? 1 : -1));
    if (next.gte(0))
      verified = false;
    else if (quantity.gte(0))
      verified = execution.source.positionEffect === "open-short" && execution.source.positionEffectEvidence?.kind !== "inferred";
    quantity = next;
  }
  return verified;
}

function holdingAt(ledger: Ledger, date: string): HistoricalHolding | null {
  const boundary = boundaryAt(ledger, date);
  if (!boundary || ledger.emptyBoundaries.has(boundary)) return null;
  if (!ledger.holdingsCache.has(date))
    ledger.holdingsCache.set(date, computeHoldingAt(ledger, date));
  return ledger.holdingsCache.get(date) ?? null;
}

function computeHoldingAt(ledger: Ledger, date: string): HistoricalHolding | null {
  const executions = ledger.orderedExecutions;
  const visible = visibleExecutionsAt(ledger, date);
  if (!visible.length && !evidenceVisible(ledger, date))
    return null;
  const currencies = visible.length ? executionCurrenciesAt(ledger, date) : [currency(ledger.instrument.currency)];
  const settlementCurrency = currencies.length === 1 ? currencies[0] : "";
  const reasons: string[] = [];
  const boundary = boundaryAt(ledger, date);
  let position: PositionLedgerSnapshot | null = null;
  if (boundary) {
    if (!ledger.snapshots.has(boundary)) {
      try {
        ledger.snapshots.set(boundary, replayPositionAtPrice({
          executions,
          cursor: boundary,
          markPrice: "0",
          ...(ledger.nature !== "simulation" ? {
            inventoryIdentity: {
              accountId: ledger.accountId,
              symbol: ledger.instrument.symbol,
              market: ledger.market
            },
            evidence: [{ positions: [...ledger.positions.values()], events: [...ledger.events.values()] }],
          } : {}),
        }));
      }
      catch {
        ledger.snapshots.set(boundary, null);
      }
    }
    position = ledger.snapshots.get(boundary) ?? null;
  }
  if (!position)
    reasons.push("历史持仓回放失败，证据待核对");
  const q = decimal(position?.quantity);
  const unsupportedAction = ledger.firstCorporateActionDate !== null && ledger.firstCorporateActionDate <= date;
  if (unsupportedAction)
    reasons.push("存在尚未支持数量与成本调整的公司行动证据");
  if (boundary && q?.lt(0) && !ledger.shortProof.has(boundary))
    ledger.shortProof.set(boundary, shortVerified(ledger, executions, boundary));
  const verified = Boolean(!unsupportedAction && position && position.quantityKnown !== false && q && (!q.lt(0) || boundary && ledger.shortProof.get(boundary)));
  if (verified && q!.isZero()) {
    if (boundary) ledger.emptyBoundaries.add(boundary);
    return null;
  }
  const quote = markFor(ledger, date);
  if (!verified)
    reasons.push("持仓数量或负仓方向证据不足");
  const costKnown = verified && position?.costKnown !== false && !position?.accuracy && Boolean(settlementCurrency);
  if (!costKnown)
    reasons.push("可用成本待核对", ...(position?.accuracy?.reasons ?? []));
  const price = decimal(quote?.close);
  const lastTrade = visible.at(-1)?.executedAt.slice(0, 10);
  const validQuote = Boolean(quote && price?.gt(0) && settlementCurrency && currency(quote.currency) === settlementCurrency && (!lastTrade || quote.tradingDate >= lastTrade));
  if (!validQuote)
    reasons.push("缺少截至当日有效原始行情，或报价币种/成交日期不匹配");
  const value = verified && validQuote ? q!.mul(price!).toString() : null;
  const cost = costKnown ? q!.mul(position!.averageCost).toString() : null;
  const pnl = value !== null && cost !== null ? new Decimal(value).minus(cost).toString() : null;
  const ratio = pnl !== null && cost !== null && new Decimal(cost).gt(0) && q!.gt(0) ? new Decimal(pnl).div(cost).mul(100).toDecimalPlaces(8).toString() : null;
  if (verified && q!.lt(0))
    reasons.push("空头剩余成本收益率口径不支持");
  return {
    key: ledger.key,
    instrumentId: ledger.instrumentId,
    instrumentName: ledger.instrumentName,
    accountId: ledger.accountId,
    currency: settlementCurrency,
    quantity: verified ? q!.toString() : null,
    marketValue: value,
    cost,
    unrealizedPnl: pnl,
    unrealizedReturnPercent: ratio,
    quoteDate: quote?.tradingDate ?? null,
    quotePrice: validQuote ? quote!.close : null,
    quantityAvailable: verified,
    marketValueAvailable: value !== null,
    costAvailable: cost !== null,
    reasons
  };
}
type DailyContribution = {
  currency: string;
  amount: string | null;
  buySpend: string | null;
  previousMarketValue: string | null;
  previousMarketValueAvailable: boolean;
  shortPosition: boolean;
  reasons: string[];
};

function dailyContribution(ledger: Ledger, date: string): DailyContribution | null {
  const visible = visibleExecutionsAt(ledger, date);
  if (!visible.length && !evidenceVisible(ledger, date))
    return null;
  const trades = ledger.tradesByDate.get(date) ?? [];
  const currencies = visible.length ? executionCurrenciesAt(ledger, date) : [currency(ledger.instrument.currency)];
  const code = currencies.length === 1 ? currencies[0] : "";
  const reasons: string[] = [];
  if (!code)
    reasons.push("结算币种不明确");
  const priorDate = previousSession(ledger, date);
  if (!priorDate)
    reasons.push("缺少前一应有交易日历边界");
  if (priorDate && visible.some(e => e.executedAt.slice(0, 10) > priorDate && e.executedAt.slice(0, 10) < date))
    reasons.push("前一交易日至当日之间存在非当日成交，无法将跨日变化标为当日盈亏");
  const before = priorDate ? holdingAt(ledger, priorDate) : null;
  const after = holdingAt(ledger, date);
  const boundary = boundaryAt(ledger, date);
  if (code && priorDate && boundary && boundary === boundaryAt(ledger, priorDate) && ledger.emptyBoundaries.has(boundary)) {
    return {
      currency: code,
      amount: "0",
      buySpend: "0",
      previousMarketValue: "0",
      previousMarketValueAvailable: true,
      shortPosition: false,
      reasons: [],
    };
  }
  const events = ledger.datedEvents.filter(item => item.date <= date && (!priorDate || item.date > priorDate)).map(item => item.event);
  if (events.some(e => e.kind === "transfer-in" || e.kind === "transfer-out"))
    reasons.push("转仓现金流证据不足，无法计算当日盈亏");
  if (events.some(e => e.kind === "corporate-action" || e.kind === "ipo" && e.quantity !== undefined))
    reasons.push("公司行动或配股投入未完整计入当日现金流");
  if ([...ledger.positions.values()].some(p => p.date <= date && (!priorDate || p.date > priorDate)))
    reasons.push("当日持仓证据边界变动，现金流覆盖待核对");
  // A first known fill on this date establishes a known empty prior
  // inventory for the day's cash-flow-neutral calculation. Any later missing
  // valuation remains unknown and must not be replaced with zero.
  const beforeKnownEmpty = !before && Boolean(priorDate && ledger.firstExecutionDate === date);
  const beforeMarketValue = before?.marketValue ?? (beforeKnownEmpty ? "0" : null);
  const beforeMarketValueAvailable = before?.marketValueAvailable ?? beforeKnownEmpty;
  if (priorDate && !beforeMarketValueAvailable)
    reasons.push("前一应有交易日估值缺失或数量不可用");
  if (after && !after.marketValueAvailable)
    reasons.push("当日估值缺失或数量不可用");
  let inventory = decimal(before?.quantity ?? "0");
  let cash = new Decimal(0), fees = new Decimal(0), buySpend = new Decimal(0);
  let buySpendAvailable = true;
  for (const trade of trades) {
    const size = decimal(trade.quantity)?.abs();
    const gross = trade.source.settlement ? decimal(trade.source.settlement.grossAmount)?.abs() : size?.mul(decimal(trade.price) ?? "NaN");
    const fee = decimal(trade.fee);
    if (!size || !gross?.isFinite() || !fee || trade.source.feeStatus === "unknown" || trade.source.historyIncomplete?.length) {
      reasons.push("当日成交金额、费用或数量证据缺失");
      buySpendAvailable = false;
      continue;
    }
    const next = inventory?.plus(size.mul(trade.side === "buy" ? 1 : -1));
    if (!inventory || next?.lt(0) && inventory.gte(0) && !(trade.source.positionEffect === "open-short" && trade.source.positionEffectEvidence?.kind !== "inferred"))
      reasons.push("当日负仓方向证据不足");
    inventory = next ?? null;
    cash = cash.plus(gross.mul(trade.side === "sell" ? 1 : -1));
    fees = fees.plus(fee);
    if (trade.side === "buy") buySpend = buySpend.plus(gross).plus(fee);
  }
  // Empty positions contribute zero; actual same-day fills still contribute
  // cash and fees, including fully closed positions and round trips.
  const value = decimal(after?.marketValue ?? "0"), baseline = decimal(beforeMarketValue);
  const amount = reasons.length || !value || !baseline ? null : value.minus(baseline).plus(cash).minus(fees).toDecimalPlaces(8).toString();
  const shortPosition = [before?.quantity, after?.quantity]
    .some(quantity => decimal(quantity)?.lt(0))
    || trades.some(trade => trade.source.positionEffect === "open-short" && trade.source.positionEffectEvidence?.kind !== "inferred");
  return {
    currency: code,
    amount,
    buySpend: buySpendAvailable ? buySpend.toDecimalPlaces(8).toString() : null,
    previousMarketValue: beforeMarketValueAvailable && baseline ? baseline.toDecimalPlaces(8).toString() : null,
    previousMarketValueAvailable: beforeMarketValueAvailable && baseline !== null,
    shortPosition,
    reasons: [...new Set(reasons)]
  };
}
/** Daily marks replay each account/instrument/nature/run once, independently of episode-final metrics. */

export function buildHoldingsHistory(entries: readonly TradeLibraryEntry[], options: HoldingsHistoryOptions): HoldingsHistoryModel {
  const { scope } = options;
  const start = scope.period.startDate;
  const asOfDate = validDate(options.asOf) ?? roomTodayKey(new Date(options.asOf ?? new Date().toISOString()));
  const end = [scope.period.endDate, asOfDate].sort()[0];
  // The shared historical-performance date filter excludes older holdings; expand only its date range.
  const rows = filterRoomRows(entries, { ...scope, period: {
      preset: "all",
      startDate: "0001-01-01",
      endDate: "9999-12-31"
    } }, { instrumentMetadata: options.instrumentMetadata });
  const calendarStart = new Date(Date.parse(`${start}T00:00:00Z`) - 45 * 86400000).toISOString().slice(0, 10);
  const ledgers = buildHistoryLedgers(rows, options.candlesByInstrument ?? {}, calendarStart, end);
  const points: HoldingsHistoryPoint[] = [];
  for (let date = start; date <= end; date = nextDay(date)) {
    const holdings = [...ledgers.values()].map(ledger => holdingAt(ledger, date)).filter((h): h is HistoricalHolding => h !== null);
    const knownCurrencies = [...new Set([...ledgers.values()].flatMap(ledger => [
      ...executionCurrenciesAt(ledger, date),
      ...(evidenceVisible(ledger, date) ? [currency(ledger.instrument.currency)] : []),
    ]))];
    const hasHistory = knownCurrencies.length > 0 || holdings.length > 0;
    const money = (field: "marketValue" | "cost" | "unrealizedPnl") => buildRoomMoneyView(
      holdings.length
        ? holdings.map(h => ({ currency: h.currency, amount: h[field] }))
        : knownCurrencies.map(currency => ({ currency, amount: "0" })),
      options.fxSnapshot,
      options.targetCurrency,
    );
    const marketValue = money("marketValue"), cost = money("cost"), unrealizedPnl = money("unrealizedPnl");
    const quantityAvailable = hasHistory && holdings.every(h => h.quantityAvailable);
    const marketValueAvailable = hasHistory && holdings.every(h => h.marketValueAvailable);
    const costAvailable = hasHistory && holdings.every(h => h.costAvailable);
    const unrealizedPnlAvailable = hasHistory && holdings.every(h => h.unrealizedPnl !== null);
    const currencies = Object.keys(cost.originalByCurrency);
    const targetValue = (view: RoomMoneyView) => options.targetCurrency || options.fxSnapshot
      ? roomMoneyValue(view)
      : currencies.length === 1 ? view.originalByCurrency[currencies[0]] : null;
    const numerator = targetValue(unrealizedPnl);
    const denominator = targetValue(cost);
    const ratio = unrealizedPnlAvailable && costAvailable &&
      holdings.every(h => decimal(h.quantity)?.gte(0)) &&
      numerator != null && decimal(denominator)?.gt(0)
      ? new Decimal(numerator).div(denominator!).mul(100).toDecimalPlaces(8).toString()
      : null;
    const reasons = [...new Set(holdings.flatMap(h => h.reasons))];
    if (!hasHistory)
      reasons.push("截至当日无可用持仓流水或期初证据");
    if ((options.targetCurrency || options.fxSnapshot) && roomMoneyValue(marketValue) === null)
      reasons.push(marketValue.note);
    const daily = [...ledgers.values()].map(ledger => dailyContribution(ledger, date)).filter((value): value is DailyContribution => value !== null);
    const dailyPnl = buildRoomMoneyView(daily, options.fxSnapshot, options.targetCurrency);
    const dailyPnlAvailable = daily.length > 0 && daily.every(value => value.amount !== null) && (!(options.targetCurrency || options.fxSnapshot) || roomMoneyValue(dailyPnl) !== null);
    const dailyPnlReasons = [...new Set(daily.flatMap(value => value.reasons))];
    if (!daily.length)
      dailyPnlReasons.push("截至当日无可用交易或期初证据");
    if ((options.targetCurrency || options.fxSnapshot) && roomMoneyValue(dailyPnl) === null)
      dailyPnlReasons.push(dailyPnl.note);
    const previousMarketValue = buildRoomMoneyView(
      daily.map(value => ({ currency: value.currency, amount: value.previousMarketValue })),
      options.fxSnapshot,
      options.targetCurrency,
    );
    const buySpend = buildRoomMoneyView(
      daily.map(value => ({ currency: value.currency, amount: value.buySpend })),
      options.fxSnapshot,
      options.targetCurrency,
    );
    const dailyPnlDenominator = buildRoomMoneyView(
      daily.map(value => {
        const previous = decimal(value.previousMarketValue);
        const buys = decimal(value.buySpend);
        return {
          currency: value.currency,
          amount: previous !== null && buys !== null ? previous.plus(buys).toDecimalPlaces(8).toString() : null,
        };
      }),
      options.fxSnapshot,
      options.targetCurrency,
    );
    const dailyPnlPercentResult = buildDailyPnlPercent({
      dailyPnl,
      previousMarketValue,
      buySpend,
      dailyPnlAvailable,
      previousMarketValueAvailable: daily.length > 0 && daily.every(value => value.previousMarketValueAvailable),
      buySpendAvailable: daily.length > 0 && daily.every(value => value.buySpend !== null),
      hasShortPosition: daily.some(value => value.shortPosition),
      targetCurrency: options.targetCurrency,
    });
    const dailyPnlPercentReasons = [...new Set([
      ...dailyPnlReasons,
      ...(dailyPnlPercentResult.reason ? [dailyPnlPercentResult.reason] : []),
    ])];
    const activeKeys = new Set(holdings.map(holding => holding.key));
    const valuationLedgers = [...ledgers.values()].filter(ledger => activeKeys.has(ledger.key) || ledger.tradesByDate.has(date));
    // With no position or same-day trade there is no live market cutoff: an
    // explicitly known empty snapshot belongs to its own calendar date.
    const valuationDate = valuationLedgers.map(ledger => ledger.sessions[upperBound(ledger.sessions, date) - 1]).filter((day): day is string => Boolean(day)).sort().at(-1) ?? date;
    points.push({
      date,
      valuationDate,
      dailyPnl,
      dailyPnlAvailable,
      dailyPnlReasons,
      dailyPnlDenominator,
      dailyPnlPercent: dailyPnlPercentResult.value,
      dailyPnlPercentAvailable: dailyPnlPercentResult.available,
      dailyPnlPercentReasons,
      dailyCapital: dailyPnlDenominator,
      dailyReturnPercent: dailyPnlPercentResult.value,
      dailyReturnPercentAvailable: dailyPnlPercentResult.available,
      dailyReturnPercentReasons: dailyPnlPercentReasons,
      holdings,
      marketValue,
      cost,
      unrealizedPnl,
      unrealizedReturnPercent: ratio,
      available: marketValueAvailable && unrealizedPnlAvailable && (!(options.targetCurrency || options.fxSnapshot) || roomMoneyValue(marketValue) !== null),
      quantityAvailable,
      marketValueAvailable,
      costAvailable,
      unrealizedPnlAvailable,
      coverage: {
        total: holdings.length,
        quantity: holdings.filter(h => h.quantityAvailable).length,
        marketValue: holdings.filter(h => h.marketValueAvailable).length,
        cost: holdings.filter(h => h.costAvailable).length,
        unrealizedPnl: holdings.filter(h => h.unrealizedPnl !== null).length
      },
      reasons
    });
  }
  return {
    points,
    start,
    end,
    scope,
    fxSnapshotId: options.fxSnapshot?.id ?? null,
    reasons: hasRelevantLegacySimulationRows(entries, scope)
      ? ["请先选择单一模拟运行"]
      : []
  };
}

export type HoldingsHistoryGranularity = "day" | "week" | "month";

export type HoldingsHistorySample = {
  point: HoldingsHistoryPoint;
  actualDate: string;
  periodStart: string;
  periodEnd: string;
  partialPeriod: boolean;
};
/** End-of-period snapshots, never a sum/average of returns or daily PnL. */

export function sampleHoldingsHistory(model: HoldingsHistoryModel, granularity: HoldingsHistoryGranularity): HoldingsHistorySample[] {
  if (granularity === "day")
    return model.points.map(point => ({
      point,
      actualDate: point.date,
      periodStart: point.date,
      periodEnd: point.date,
      partialPeriod: false
    }));
  const groups = new Map<string, {
    naturalStart: string;
    naturalEnd: string;
    points: HoldingsHistoryPoint[];
  }>();
  for (const point of model.points) {
    const date = new Date(`${point.date}T00:00:00Z`);
    const naturalStart = granularity === "month" ? `${point.date.slice(0, 7)}-01` : new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
    const naturalEnd = granularity === "month"
      ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
      : new Date(Date.parse(`${naturalStart}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
    const group = groups.get(naturalStart) ?? {
      naturalStart,
      naturalEnd,
      points: []
    };
    group.points.push(point);
    groups.set(naturalStart, group);
  }
  return [...groups.values()].map(group => {
    const point = group.points.filter(p =>
      // A valuation date is established by a valid market value and the
      // exchange session label. Cost/PnL are separate fields; their absence
      // must remain visible on that date rather than moving the sample back.
      p.marketValueAvailable &&
      p.date === p.valuationDate &&
      ((p.marketValue.targetCurrency === undefined && p.marketValue.fxSnapshotId === null) || roomMoneyValue(p.marketValue) !== null)
    ).at(-1) ?? group.points.at(-1)!;
    return {
      point,
      actualDate: point.date,
      periodStart: group.points[0].date,
      periodEnd: group.points.at(-1)!.date,
      partialPeriod: group.points[0].date > group.naturalStart || group.points.at(-1)!.date < group.naturalEnd
    };
  });
}
