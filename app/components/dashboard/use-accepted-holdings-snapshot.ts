"use client";

import { useEffect, useRef, useState } from "react";

import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { HoldingsHistoryWorkerInput } from "../../lib/reviews/holdings-history-worker";
import type { HoldingsHistoryModel, HoldingsHistoryPoint } from "../../lib/reviews/trading-room-history";
import type { CurrentPortfolioModel } from "../../lib/reviews/trading-room-portfolio";
import type { RoomFxSnapshot, RoomMoneyView } from "../../lib/reviews/trading-room-scope";
import type { TradingRoomQuote } from "../../lib/reviews/trading-room-holdings";
import type { RoomMoneySubtotal } from "../../lib/reviews/holdings-money-subtotal";
import type { HoldingsValuationRefreshPhase } from "./use-holdings-valuation-refresh";
import {
  isPublishableHoldingsPublication,
  type HoldingsPublicationPermit,
} from "./holdings-publication-boundary";

export type AcceptedHoldingsSnapshot = {
  /** The complete effective scope identity for this bundle. */
  scopeKey: string;
  /** Explicit ledger/FX publication boundary that authorized replacement. */
  acceptanceRevision?: string;
  /** Ledger-only revision, used to distinguish imports from FX-only changes. */
  ledgerRevision?: string;
  portfolioModel: CurrentPortfolioModel;
  holdingsHistoryModel: HoldingsHistoryModel;
  currentDayPoint: HoldingsHistoryPoint | undefined;
  fxSnapshot: RoomFxSnapshot | undefined;
  /** Currency codes relevant to the accepted rows, for FX provenance copy. */
  currencies: readonly string[];
  /** Inputs used by the table's direct price and conversion presentation. */
  quotesByInstrument: Readonly<Record<string, TradingRoomQuote | undefined>> | undefined;
  candlesByInstrument: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>> | undefined;
  /** Exact worker input that produced the accepted history bundle. */
  historyInput?: HoldingsHistoryWorkerInput;
};

export type UseAcceptedHoldingsSnapshotInput = {
  scopeKey: string;
  /** Changes only for an explicit ledger/import or FX publication boundary. */
  acceptanceRevision?: string;
  /** Changes when the imported ledger changes; FX-only changes leave this stable. */
  ledgerRevision?: string;
  portfolioModel: CurrentPortfolioModel;
  holdingsHistoryModel: HoldingsHistoryModel;
  currentDayPoint: HoldingsHistoryPoint | undefined;
  fxSnapshot?: RoomFxSnapshot;
  quotesByInstrument?: Readonly<Record<string, TradingRoomQuote | undefined>>;
  candlesByInstrument?: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>>;
  refreshPhase: HoldingsValuationRefreshPhase;
  historyPending: boolean;
  historyError: string | null;
  historyCurrentInput?: HoldingsHistoryWorkerInput;
  historyAcceptedInput?: HoldingsHistoryWorkerInput | null;
  historyInputReady?: boolean;
  /** The workspace's persisted ledger/cache hydration boundary. */
  initialDataReady?: boolean;
  /** Whether the current ledger revision belongs to an owned producer permit. */
  ledgerPublicationRequired?: boolean;
  /**
   * Complete financial publication scope, including historical/closed members
   * that are not present in the current open holdings rows.
   */
  publicationScopeInstrumentIds?: ReadonlySet<string>;
  /** Producer-owned terminal/readback permit for an import publication. */
  publicationPermit?: HoldingsPublicationPermit | null;
};

export type UseAcceptedHoldingsSnapshotResult = {
  acceptedSnapshot: AcceptedHoldingsSnapshot | null;
  /** The bundle used by every holdings module for the current scope. */
  displaySnapshot: AcceptedHoldingsSnapshot;
  /** A cold owned publication is fenced; consumers must render a waiting placeholder. */
  publicationBlocked: boolean;
  /** A compatible accepted bundle is being held while this request settles. */
  retaining: boolean;
};

const TERMINAL_PHASES = new Set<HoldingsValuationRefreshPhase>(["complete", "partial"]);
const ACTIVE_REFRESH_PHASES = new Set<HoldingsValuationRefreshPhase>([
  "waiting",
  "downloading",
  "recomputing",
]);

type ColdSnapshotState = {
  scopeKey: string;
  snapshot: AcceptedHoldingsSnapshot;
  hydrated: boolean;
};

function currentCurrencies(model: CurrentPortfolioModel): readonly string[] {
  return [...new Set(model.holdings.rows
    .map(row => row.settlementCurrency ?? row.quote?.currency ?? "")
    .map(value => value.trim().toUpperCase())
    .filter(Boolean))].sort();
}

function copyQuotes(
  values: Readonly<Record<string, TradingRoomQuote | undefined>> | undefined,
  acceptedInstrumentIds: ReadonlySet<string>,
): Readonly<Record<string, TradingRoomQuote | undefined>> | undefined {
  if (!values) return undefined;
  return Object.fromEntries(
    Object.entries(values)
      .filter(([id]) => acceptedInstrumentIds.has(id))
      .map(([id, quote]) => [id, quote ? { ...quote } : undefined]),
  );
}

function copyCandles(
  values: Readonly<Record<string, readonly DailyCandleRecord[] | undefined>> | undefined,
  acceptedInstrumentIds: ReadonlySet<string>,
): Readonly<Record<string, readonly DailyCandleRecord[] | undefined>> | undefined {
  if (!values) return undefined;
  return Object.fromEntries(
    Object.entries(values)
      .filter(([id]) => acceptedInstrumentIds.has(id))
      .map(([id, candles]) => [id, candles ? candles.map(candle => ({ ...candle })) : undefined]),
  );
}

function makeSnapshot(input: UseAcceptedHoldingsSnapshotInput): AcceptedHoldingsSnapshot {
  const acceptedInstrumentIds = new Set(input.portfolioModel.holdings.rows.map(row => row.instrumentId));
  return {
    scopeKey: input.scopeKey,
    acceptanceRevision: input.acceptanceRevision,
    ledgerRevision: input.ledgerRevision,
    portfolioModel: input.portfolioModel,
    holdingsHistoryModel: input.holdingsHistoryModel,
    currentDayPoint: input.currentDayPoint,
    fxSnapshot: input.fxSnapshot,
    currencies: currentCurrencies(input.portfolioModel),
    // The worker/cache maps can contain every instrument and all historical
    // rows in the selected database. A bundle only needs direct price inputs
    // for its accepted current holdings; copying the whole map would make
    // every publication proportional to the complete history cache.
    quotesByInstrument: copyQuotes(input.quotesByInstrument, acceptedInstrumentIds),
    candlesByInstrument: copyCandles(input.candlesByInstrument, acceptedInstrumentIds),
    historyInput: input.historyCurrentInput,
  };
}

function unavailableMoneyView(view: RoomMoneyView | undefined): RoomMoneyView {
  return {
    ...(view ?? {}),
    baseCurrency: "CNY",
    originalByCurrency: {},
    convertedCny: null,
    converted: null,
    convertedHkd: null,
    conversion: "missing",
    fxSnapshotId: null,
    note: "持仓估值正在等待发布",
  };
}

function unavailableSubtotal(subtotal: RoomMoneySubtotal | undefined): RoomMoneySubtotal {
  return {
    ...(subtotal ?? {}),
    value: null,
    currency: null,
    available: 0,
    total: 0,
    complete: false,
    memberKeys: [],
    reason: "持仓估值正在等待发布",
  };
}

/**
 * A cold scope with an owned, unpublishable ledger must fail closed. The
 * input models already contain the newly saved ledger, so returning them as a
 * cold candidate would expose quantity/cost/value before the producer receipt
 * crosses the publication boundary. Keep the shape renderable while removing
 * every financial row and money value until a terminal permit is publishable.
 */
function makeUnavailableSnapshot(input: UseAcceptedHoldingsSnapshotInput): AcceptedHoldingsSnapshot {
  const source = input.portfolioModel;
  const emptyCoverage = { available: 0, total: 0, complete: false };
  const portfolioModel = {
    ...source,
    holdings: {
      ...source.holdings,
      rows: [],
      groups: [],
      availablePnlCount: 0,
      unavailablePnlCount: 0,
    },
    rows: [],
    marketValue: unavailableMoneyView(source.marketValue),
    cost: unavailableMoneyView(source.cost),
    unrealizedPnl: unavailableMoneyView(source.unrealizedPnl),
    subtotals: {
      marketValue: unavailableSubtotal(source.subtotals?.marketValue),
      cost: unavailableSubtotal(source.subtotals?.cost),
      unrealizedPnl: unavailableSubtotal(source.subtotals?.unrealizedPnl),
    },
    unrealizedReturnPercent: null,
    coverage: {
      marketValue: emptyCoverage,
      cost: emptyCoverage,
      unrealizedPnl: emptyCoverage,
    },
    count: 0,
    complete: false,
    empty: true,
  } as CurrentPortfolioModel;
  return {
    scopeKey: input.scopeKey,
    acceptanceRevision: input.acceptanceRevision,
    ledgerRevision: input.ledgerRevision,
    portfolioModel,
    holdingsHistoryModel: {
      ...input.holdingsHistoryModel,
      points: [],
      reasons: [...new Set([...(input.holdingsHistoryModel.reasons ?? []), "持仓估值正在等待发布"])],
    },
    currentDayPoint: undefined,
    fxSnapshot: undefined,
    currencies: [],
    quotesByInstrument: {},
    candlesByInstrument: {},
    historyInput: input.historyCurrentInput,
  };
}

function hasHoldingsCandidate(model: CurrentPortfolioModel): boolean {
  if (model.count > 0) return true;
  return (model.rows ?? []).some(row => {
    const candidate = row as unknown as {
      holding?: { quantity?: string | null };
      marketValue?: string | null;
      cost?: string | null;
      unrealizedPnl?: string | null;
    };
    return [candidate.holding?.quantity, candidate.marketValue, candidate.cost, candidate.unrealizedPnl]
      .some(value => value !== undefined && value !== null && value !== "" && value !== "0");
  });
}

function historyReady(input: UseAcceptedHoldingsSnapshotInput): boolean {
  if (input.historyPending || input.historyError) return false;
  const hasExactInput = input.historyCurrentInput !== undefined || input.historyAcceptedInput !== undefined;
  if (hasExactInput) {
    return Boolean(input.historyCurrentInput
      && input.historyAcceptedInput
      && input.historyAcceptedInput === input.historyCurrentInput);
  }
  return input.historyInputReady !== false;
}

/**
 * Holds one coherent portfolio/history/FX/input bundle for each scope. Live
 * market and worker projections may continue changing while a refresh is in
 * flight, but the dashboard receives them only after the refresh enters a
 * usable terminal phase. A completed same-scope result is retained through
 * failure and cancellation.
 */
export function useAcceptedHoldingsSnapshot(
  input: UseAcceptedHoldingsSnapshotInput,
): UseAcceptedHoldingsSnapshotResult {
  // This hook is mounted for the dashboard lifetime, while users can move
  // through many scopes. Retaining every historical scope would keep each
  // portfolio and its copied price arrays alive indefinitely. The current
  // scope is the only one that may be retained; a return to an old scope
  // starts from its own cold candidate and can be accepted again at its exact
  // worker boundary.
  const activeScopeKey = useRef(input.scopeKey);
  const [acceptedSnapshotState, setAcceptedSnapshotState] = useState<AcceptedHoldingsSnapshot | null>(null);
  // A cold scope still needs a stable render bundle while its first worker
  // request is pending. State keeps the candidate stable without retaining a
  // map of every scope ever visited by this dashboard.
  const [coldSnapshotState, setColdSnapshotState] = useState<ColdSnapshotState | null>(() => ({
    scopeKey: input.scopeKey,
    snapshot: makeSnapshot(input),
    hydrated: input.initialDataReady !== false,
  }));
  const capturedTerminalPhase = useRef(new Map<string, HoldingsValuationRefreshPhase>());
  // Terminal model changes are publishable only after this scope has shown a
  // real valuation request phase. Idle/partial rerenders from a quote, clock,
  // or late worker input cannot create a second financial release.
  const terminalBoundaryArmed = useRef(new Map<string, boolean>());
  // A changed worker input is eligible for same-scope replacement only after
  // this render stream has shown the corresponding pending boundary. This
  // keeps a late exact-input object from being treated as a second publish.
  const sourceChangesInFlight = useRef(new Set<string>());
  // A producer generation is a one-shot publication boundary. Keeping the
  // consumed generation here prevents a later FX/as-of tick from replaying an
  // already accepted import permit.
  const capturedPublicationGenerations = useRef(new Map<string, number>());
  // Worker pending is the explicit start edge for an independent ledger/FX
  // publication. A changed FX snapshot observed while an existing market
  // request is already active is only a candidate for that request; it must
  // not arm a second source publication of its own.
  const previousPending = useRef<{ scopeKey: string; value: boolean } | null>(null);
  const ready = historyReady(input);
  const initialDataReady = input.initialDataReady !== false;
  const displayExisting = acceptedSnapshotState?.scopeKey === input.scopeKey
    ? acceptedSnapshotState
    : null;
  const displayScopeInstrumentIds = input.publicationScopeInstrumentIds
    ?? new Set(input.portfolioModel.holdings.rows.map(row => row.instrumentId));
  const displayPublicationTargetsScope = Boolean(input.publicationPermit
    && input.publicationPermit.affectedInstrumentIds.some(id => displayScopeInstrumentIds.has(id)));
  const displayLedgerChanged = Boolean(displayExisting
    && displayExisting.ledgerRevision !== input.ledgerRevision);
  const displayLedgerPublicationRequired = Boolean(
    input.ledgerPublicationRequired !== false
    && (displayLedgerChanged || (!displayExisting && (
      displayPublicationTargetsScope
      || (input.ledgerPublicationRequired === true && !input.publicationPermit)
    )))
    && (!input.publicationPermit || displayPublicationTargetsScope),
  );
  const displayPublicationReady = !displayLedgerPublicationRequired
    || isPublishableHoldingsPublication(input.publicationPermit, displayScopeInstrumentIds);
  // A cold render before persisted-cache hydration has no accepted baseline.
  // Even an independent producer flag cannot authorize the live candidate in
  // that first frame; the hydration boundary must establish the baseline.
  const coldHydrationBlocked = Boolean(
    !displayExisting
    && !initialDataReady
    && hasHoldingsCandidate(input.portfolioModel),
  );
  const coldPublicationBlocked = Boolean(
    !displayExisting
    && (coldHydrationBlocked
      || (displayLedgerPublicationRequired && (!displayPublicationReady || !ready))),
  );

  useEffect(() => {
    if (activeScopeKey.current !== input.scopeKey) {
      activeScopeKey.current = input.scopeKey;
      capturedTerminalPhase.current.clear();
      terminalBoundaryArmed.current.clear();
      sourceChangesInFlight.current.clear();
      capturedPublicationGenerations.current.clear();
      previousPending.current = null;
    }
    const existing = acceptedSnapshotState?.scopeKey === input.scopeKey
      ? acceptedSnapshotState
      : null;
    const pendingStarted = previousPending.current?.scopeKey !== input.scopeKey
      ? input.historyPending
      : input.historyPending && !previousPending.current.value;
    previousPending.current = { scopeKey: input.scopeKey, value: input.historyPending };
    const sourceChanged = Boolean(existing
      && input.acceptanceRevision !== undefined
      && existing.acceptanceRevision !== input.acceptanceRevision
      && input.historyCurrentInput
      && existing.historyInput
      && existing.historyInput !== input.historyCurrentInput);
    const ledgerChanged = Boolean(existing
      && existing.ledgerRevision !== input.ledgerRevision);
    const scopeInstrumentIds = input.publicationScopeInstrumentIds
      ?? new Set(input.portfolioModel.holdings.rows.map(row => row.instrumentId));
    const publicationTargetsScope = Boolean(input.publicationPermit
      && input.publicationPermit.affectedInstrumentIds.some(id => scopeInstrumentIds.has(id)));
    // A permit is required only for a source revision that this workspace has
    // explicitly associated with a producer generation. Other ledger edits
    // (for example a scoped trade repair) keep the pre-existing exact-worker
    // source-change path, while an unrelated permit cannot freeze this scope.
    const ledgerPublicationRequired = Boolean(
      input.ledgerPublicationRequired !== false
      // A cold scope has no accepted ledger to compare yet. An owned permit
      // targeting that scope is still a source publication boundary; a
      // missing permit is also unsafe evidence, so the initial cache capture
      // must fail closed until the owner supplies a terminal receipt.
      && (ledgerChanged || (!existing && (
        publicationTargetsScope
        || (input.ledgerPublicationRequired === true && !input.publicationPermit)
      )))
      // A missing permit is itself the unsafe import state. When a permit is
      // present, only a permit targeting this financial scope can fence it;
      // unrelated-scope imports must not hold the current bundle hostage.
      && (!input.publicationPermit || publicationTargetsScope),
    );
    // A ledger revision is an owned source publication. Readable rows (and
    // the old terminal phase) are not enough to release them: only the
    // producer's terminal/readback permit may cross this boundary. FX-only
    // revisions leave `ledgerChanged` false and keep their independent
    // publication path available.
    const publicationReady = !ledgerPublicationRequired
      || isPublishableHoldingsPublication(input.publicationPermit, scopeInstrumentIds);
    // A consumed import generation fences that ledger revision only. The
    // permit remains attached to the workspace after publication, so an
    // independent FX revision must not inherit its one-shot lock.
    const publicationConsumed = Boolean(ledgerPublicationRequired
      && publicationTargetsScope
      && input.publicationPermit
      && capturedPublicationGenerations.current.get(input.scopeKey) === input.publicationPermit.generation);
    const publicationPending = Boolean(input.publicationPermit
      && ledgerPublicationRequired
      && publicationTargetsScope
      && ledgerChanged
      && input.publicationPermit.status === "pending");
    // A same-scope import/delete or worker input replacement starts a new
    // acceptance boundary even when the valuation phase still contains the
    // previous terminal label. Do not let the old terminal marker suppress
    // the new exact worker result.
    if (sourceChanged
      && pendingStarted
      && (!ACTIVE_REFRESH_PHASES.has(input.refreshPhase) || publicationPending)) {
      sourceChangesInFlight.current.add(input.scopeKey);
      capturedTerminalPhase.current.delete(input.scopeKey);
    }
    if (input.refreshPhase === "waiting"
      || input.refreshPhase === "downloading"
      || input.refreshPhase === "recomputing") {
      terminalBoundaryArmed.current.set(input.scopeKey, true);
      capturedTerminalPhase.current.delete(input.scopeKey);
    }
    if (input.refreshPhase === "cancelled" || input.refreshPhase === "failed") {
      terminalBoundaryArmed.current.delete(input.scopeKey);
      // A worker result that arrives after cancellation/failure is stale even
      // when its source revision differs from the accepted bundle. A later
      // explicit request can arm a new terminal boundary from waiting.
      sourceChangesInFlight.current.delete(input.scopeKey);
    }
    if (publicationTargetsScope
      && (input.publicationPermit?.status === "cancelled" || input.publicationPermit?.status === "failed")) {
      terminalBoundaryArmed.current.delete(input.scopeKey);
      sourceChangesInFlight.current.delete(input.scopeKey);
    }
    if (!TERMINAL_PHASES.has(input.refreshPhase)) {
      capturedTerminalPhase.current.delete(input.scopeKey);
    }
    const canCaptureInitial = !existing
      && initialDataReady
      && input.refreshPhase !== "cancelled"
      && input.refreshPhase !== "failed"
      // A cold scope may receive its first exact worker result while the
      // market request is already downloading. Capture that one baseline,
      // then hold it through the remaining intermediate arrivals until the
      // terminal boundary publishes the next bundle.
      && ready
      && publicationReady;
    const canCaptureTerminal = TERMINAL_PHASES.has(input.refreshPhase)
      && initialDataReady
      && ready
      && terminalBoundaryArmed.current.get(input.scopeKey) === true
      && capturedTerminalPhase.current.get(input.scopeKey) !== input.refreshPhase
      && (!sourceChanged || (publicationReady && !publicationConsumed));
    const canCaptureSourceChange = Boolean(existing
      && sourceChanged
      && initialDataReady
      && ready
      && sourceChangesInFlight.current.has(input.scopeKey)
      && publicationReady
      && !publicationConsumed
      && (input.refreshPhase === "idle"
        || input.refreshPhase === "interrupted"
        || TERMINAL_PHASES.has(input.refreshPhase)));
    // An import/holdings retry can finish after the local refresh hook has
    // already returned to idle (the dashboard stays mounted while the import
    // producer runs in another view). Its terminal/readback receipt is still
    // the owning source boundary, so allow it to publish this exact worker
    // input without depending on a second local phase transition.
    const canCapturePublication = Boolean(existing
      && sourceChanged
      && initialDataReady
      && ready
      && publicationTargetsScope
      && publicationReady
      && !publicationConsumed);
    if (canCaptureInitial || canCaptureTerminal || canCaptureSourceChange || canCapturePublication) {
      if (canCaptureTerminal) {
        capturedTerminalPhase.current.set(input.scopeKey, input.refreshPhase);
        terminalBoundaryArmed.current.delete(input.scopeKey);
      }
      if (canCaptureSourceChange) sourceChangesInFlight.current.delete(input.scopeKey);
      if (input.publicationPermit && ledgerPublicationRequired && publicationTargetsScope && ledgerChanged) {
        capturedPublicationGenerations.current.set(input.scopeKey, input.publicationPermit.generation);
      }
      setAcceptedSnapshotState(makeSnapshot(input));
      setColdSnapshotState(null);
      return;
    }

    // A scope switch must not retain the previous scope's accepted bundle. A
    // new cold candidate is created below from the new scope's own input.
    if (acceptedSnapshotState && acceptedSnapshotState.scopeKey !== input.scopeKey) {
      // Defer the cleanup one microtask so React can commit the new scope
      // before releasing the old bundle. The render path already filters the
      // old scope out of displaySnapshot, and the guard prevents a queued
      // cleanup from clearing a bundle accepted for this scope meanwhile.
      const scopeAtEffect = input.scopeKey;
      queueMicrotask(() => {
        setAcceptedSnapshotState(previous => previous?.scopeKey === scopeAtEffect ? previous : null);
      });
    }
    if (!existing) {
      const shouldRefreshColdSnapshot = coldSnapshotState?.scopeKey !== input.scopeKey
        || (initialDataReady && coldSnapshotState?.hydrated !== true);
      if (shouldRefreshColdSnapshot) {
        const scopeAtEffect = input.scopeKey;
        const hydratedAtEffect = initialDataReady;
        const snapshotAtEffect = makeSnapshot(input);
        queueMicrotask(() => {
          setColdSnapshotState(previous => {
            if (activeScopeKey.current !== scopeAtEffect) return previous;
            if (previous?.scopeKey === scopeAtEffect
              && previous.hydrated
              && !hydratedAtEffect) return previous;
            return {
              scopeKey: scopeAtEffect,
              snapshot: snapshotAtEffect,
              hydrated: hydratedAtEffect,
            };
          });
        });
      }
    }
  }, [
    acceptedSnapshotState,
    input.candlesByInstrument,
    coldSnapshotState,
    input.currentDayPoint,
    input.fxSnapshot,
    input.historyAcceptedInput,
    input.historyCurrentInput,
    input.historyError,
    input.historyInputReady,
    input.historyPending,
    input.holdingsHistoryModel,
    initialDataReady,
    input.acceptanceRevision,
    input.ledgerRevision,
    input.portfolioModel,
    input.publicationScopeInstrumentIds,
    input.publicationPermit,
    input.quotesByInstrument,
    input.refreshPhase,
    input.scopeKey,
    ready,
  ]);

  const acceptedSnapshot = displayExisting;
  // Before the workspace has finished reading the persisted current-day
  // cache, the live models are only placeholders. The effect above replaces
  // that provisional candidate exactly once when the hydration boundary
  // arrives. During a scope switch, derive a new candidate directly from that
  // scope's input for this render; no old scope data can leak into it.
  const coldSnapshot = coldSnapshotState?.scopeKey === input.scopeKey
    ? coldSnapshotState.snapshot
    : makeSnapshot(input);
  // A scope switch must never paint the previous scope's financial result. In
  // the new scope, all modules use one stable cold candidate until its first
  // compatible worker/valuation boundary can be accepted.
  const displaySnapshot = acceptedSnapshot ?? (coldPublicationBlocked
    ? makeUnavailableSnapshot(input)
    : coldSnapshot);
  const retaining = Boolean(acceptedSnapshot && ACTIVE_REFRESH_PHASES.has(input.refreshPhase));
  return { acceptedSnapshot, displaySnapshot, publicationBlocked: coldPublicationBlocked, retaining };
}
