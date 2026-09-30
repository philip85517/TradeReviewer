"use client";

import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardPenLine,
  Download,
  FileImage,
  GripVertical,
  History,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Split,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type DragEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { applyRecallSizing } from "../../lib/recall/sizing";

import {
  applyDrawingCommand,
  canRedoDrawingAtCursor,
  canUndoDrawingAtCursor,
  createDrawingHistory,
  redoDrawingAtCursor,
  setAllDrawingsLockedAtCursor,
  undoDrawingAtCursor,
  type DrawingCommand,
  type DrawingHistory,
} from "../../lib/chart/drawing-commands";
import {
  visibleDrawingsAtCursor,
  type DrawingTool,
  type NormalizedDrawing,
} from "../../lib/chart/drawings";
import type { TimeframeAvailability } from "../../lib/market/availability";
import {
  candleKnowledgeAt,
  type Candle,
  type Timeframe,
} from "../../lib/market/types";
import { marketTimeZone } from "../../lib/market/trading-date";
import {
  completeRecallDocument,
  createRecallDocument,
  deleteRecallSnapshot,
  mergeRecallDecisions,
  missingDecisionIds,
  reconcileRecallDocument,
  retainRecallSnapshot,
  reorderRecallSnapshots,
  resolveRecallReconciliation,
  resolveRecallPhaseContext,
  splitRecallDecision,
  updateRecallSnapshot,
} from "../../lib/recall/document";
import {
  createRecallRepository,
  RecallRepositoryError,
} from "../../lib/recall/repository";
import type {
  RecallDocument,
  RecallPhase,
  RecallPlanInput,
  RecallPlanDraft,
  RecallSnapshot,
  RecallSplitGroup,
  RecallWorkingContext,
} from "../../lib/recall/types";
import {
  executionBoundaryForCursor,
  executionsThroughCursor,
  mapRecallExecutionToCandle,
  nextRecallDecisionState,
  orderedRecallExecutions,
  previousRecallDecisionState,
  recallExecutionKnowledgeAt,
  recallMarketCursorForExecution,
  recallExecutionCandleIndex,
  revealRecallBar,
  revealRecallDecision,
  revealRecallHistory,
  revealableCandlesThroughCursor,
  NO_REVEALED_EXECUTIONS,
  rewindRecallBar,
  visibleRecallExecutions,
  type RecallReplayCursor,
} from "../../lib/replay/recall-replay";
import { replayPositionAtPrice } from "../../lib/replay/position-ledger";
import type { ChartSettings } from "../../lib/storage/chart-settings";
import {
  executionFeeCurrency,
  tradeNatureOf,
  type Instrument,
  type TradeEpisode,
  type TradeExecution,
} from "../../lib/trades/types";
import { ChartToolbar } from "../chart/chart-toolbar";
import type { SearchableInstrument } from "../chart/instrument-search-popover";
import { DrawingLayersPanel } from "../chart/drawing-layers-panel";
import { DrawingToolbar } from "../chart/drawing-toolbar";
import { ReplayChart } from "../chart/replay-chart";
import { RecallExportDialog } from "../recall-export";
import type { RecallExportOrder, RecallExportSource } from "../../lib/recall-export";

import { RecallStoryboard } from "./recall-storyboard";
import { RecallPlanSidebar, compactRecallDerivedNumber, emptyRecallPlanInput } from "./recall-plan-sidebar";
import { RecallPlanRevisionSection } from "./recall-plan-revisions";
import { RecallExitEvaluations } from "./recall-exit-evaluations";
import { RecallActualMetricsPanel } from "./recall-actual-metrics";
import { RecallManualEvaluations } from "./recall-manual-evaluations";
import { calculateRecallActualMetrics } from "../../lib/recall/actual-metrics";
import { calculateRecallPlan, upsertRecallPlanDraft } from "../../lib/recall/plans";
import { captureRecallExecutionEvidence, freezeRecallSnapshotBundle, getRecallBundlePlans } from "../../lib/recall/retained-bundles";
import "./recall.css";

type ChartViewport = {
  version: 1;
  logicalRange: { from: number; to: number } | null;
  barSpacing: number;
  rightOffset: number;
  width: number;
  height: number;
};

export type RecallChartHandle = {
  capture: () => Promise<{ imageDataUrl: string; viewport: ChartViewport; warnings?: string[] }>;
  flush: () => Promise<void>;
  getViewport: () => ChartViewport;
  restoreViewport: (viewport: ChartViewport) => void;
  fitAll: () => void;
};

export type RecallRepository = ReturnType<typeof createRecallRepository>;

/**
 * Apply a save response without allowing an older network request to replace
 * a newer local draft. The server revision is safe to carry forward; the rest
 * of the response is authoritative only when no local edit happened while the
 * request was in flight.
 */
export function reconcileRecallSaveResponse(
  current: RecallDocument,
  saved: RecallDocument,
  requestGeneration: number,
  currentGeneration: number,
) {
  if (current.episodeId !== saved.episodeId) return { document: current, dirty: true };
  const newerDraftExists = requestGeneration !== currentGeneration;
  const immutableUnion = <T extends { id: string },>(local: T[] = [], accepted: T[] = []): T[] => [
    ...accepted,
    ...local.filter(item => !accepted.some(previous => previous.id === item.id)),
  ];
  return {
    document: newerDraftExists
      ? {
          ...current,
          revision: saved.revision,
          ...(current.retainedBundles || saved.retainedBundles ? {
            retainedBundles: [
              // A newer capture can prune an unaccepted local bundle while
              // its earlier save is in flight. Once accepted it is history.
              ...(saved.retainedBundles ?? []).filter(bundle => bundle.documentRevision > 0
                && !current.retainedBundles?.some(candidate => candidate.id === bundle.id)),
              ...(current.retainedBundles ?? []).map(bundle => {
                const accepted = saved.retainedBundles?.find(candidate => candidate.id === bundle.id);
                return accepted ? { ...bundle, documentRevision: accepted.documentRevision, executionEvidence: accepted.executionEvidence, ...(accepted.actualMetrics ? { actualMetrics: accepted.actualMetrics } : {}) } : bundle;
              }),
            ],
          } : {}),
          ...(current.plans || saved.plans ? {
            plans: {
              drafts: current.plans?.drafts ?? [],
              versions: immutableUnion(current.plans?.versions, saved.plans?.versions),
              riskBaselines: immutableUnion(current.plans?.riskBaselines, saved.plans?.riskBaselines),
            },
            planAssociations: [
              ...(current.planAssociations ?? []),
              ...(saved.planAssociations ?? []).filter(association => !current.planAssociations?.some(local => local.planId === association.planId)),
            ],
          } : {}),
          ...(current.exitEvaluations || saved.exitEvaluations ? {
            exitEvaluations: {
              ...current.exitEvaluations,
              drafts: current.exitEvaluations?.drafts ?? [],
              versions: immutableUnion(current.exitEvaluations?.versions, saved.exitEvaluations?.versions),
              associations: [
                ...(current.exitEvaluations?.associations ?? []),
                ...(saved.exitEvaluations?.associations ?? []).filter(association => !current.exitEvaluations?.associations.some(local => local.evaluationId === association.evaluationId)),
              ],
            },
          } : {}),
          ...(saved.lastCompleted ? { lastCompleted: saved.lastCompleted } : {}),
        }
      : saved,
    dirty: newerDraftExists,
  };
}

export type RecallWorkspaceProps = {
  episode: TradeEpisode;
  episodes: TradeEpisode[];
  instrument: Instrument;
  instruments: SearchableInstrument[];
  timeframeAvailability: TimeframeAvailability;
  /** Candles for the current parent timeframe; retained for compatibility. */
  importedTimelineCandles: Candle[];
  /** Full per-timeframe candles keep Recall independent of the old review view. */
  candlesByTimeframe?: Partial<Record<Timeframe, Candle[]>>;
  settings: ChartSettings;
  initialDrawings?: NormalizedDrawing[];
  dataDetails?: ComponentProps<typeof ChartToolbar>["dataDetails"];
  repository?: RecallRepository;
  onEpisodeChange: (episodeId: string) => void;
  onInstrumentChange: (instrumentId: string) => void;
  onTimeframeChange?: (timeframe: Timeframe) => void;
  onSettingsChange: (settings: ChartSettings) => void;
  onRefreshMarketData?: () => void;
  /** Parent navigation may await this guard before unmounting Recall. */
  onLeaveGuardChange?: (guard: (() => Promise<boolean>) | null) => void;
  /** Notify the parent after any server-accepted draft or formal save. */
  onSaved?: (document: RecallDocument) => void;
  /** Notify the parent only after the server accepts a formal completion. */
  onFormalCompletion?: (document: RecallDocument) => void;
  /** Optional parent-owned focus layout state. */
  focused?: boolean;
  onFocusedChange?: (focused: boolean) => void;
  /** Export is intentionally an adapter. The export worker owns its dialog and format. */
  onExport?: (document: RecallDocument) => void;
  /** Parent-owned navigation and data actions rendered in the single Recall header. */
  headerActions?: ReactNode;
};

type SnapshotEditBackup = {
  drawings: NormalizedDrawing[];
  replay: RecallReplayCursor;
  selectedDecisionId: string | "global" | null;
  timeframe: Timeframe;
  viewport?: ChartViewport;
};

type WorkingGraph = {
  drawings: NormalizedDrawing[];
  replay: RecallReplayCursor;
  timeframe: Timeframe;
  viewport?: ChartViewport;
};

type DecisionSelectionOptions = {
  /** A chart marker selected an explicit fill boundary; never resume a later draft cursor. */
  boundaryExecutionId?: string;
};

type PhaseViewportRestoreRequest = {
  generation: number;
  phase: RecallPhase;
  timeframe: Timeframe;
  cursor: string;
  viewport: ChartViewport;
};

export type RecallPanelState = {
  episodeId: string;
  planOpen: boolean;
  moreOpen: boolean;
  /** The plan state to restore when More closes on a narrow workspace. */
  rememberedPlanOpen: boolean | null;
};

export type RecallPanelAction =
  | { type: "toggle-more"; contentWidth: number }
  | { type: "toggle-plan"; contentWidth: number }
  | { type: "open-plan"; closeMore?: boolean }
  | { type: "close-plan" }
  | { type: "sync-more-width"; contentWidth: number }
  | { type: "episode-change"; episodeId: string };

const RECALL_PLAN_YIELD_WIDTH = 1105;

/**
 * Keep the More disclosure and plan panel as one explicit layout state.
 * Narrow More mode yields the plan panel while preserving the user's prior
 * open/closed choice for the next explicit More close.
 */
export function transitionRecallPanelState(
  state: RecallPanelState,
  action: RecallPanelAction,
): RecallPanelState {
  if (action.type === "episode-change") {
    if (action.episodeId === state.episodeId) return state;
    return {
      episodeId: action.episodeId,
      planOpen: true,
      moreOpen: false,
      rememberedPlanOpen: null,
    };
  }

  if (action.type === "toggle-more") {
    if (state.moreOpen) {
      return {
        ...state,
        moreOpen: false,
        planOpen: state.rememberedPlanOpen ?? state.planOpen,
        rememberedPlanOpen: null,
      };
    }
    if (action.contentWidth <= RECALL_PLAN_YIELD_WIDTH) {
      return {
        ...state,
        moreOpen: true,
        planOpen: false,
        rememberedPlanOpen: state.planOpen,
      };
    }
    return { ...state, moreOpen: true, rememberedPlanOpen: null };
  }

  if (action.type === "toggle-plan") {
    if (state.planOpen) return { ...state, planOpen: false, rememberedPlanOpen: null };
    if (state.moreOpen && action.contentWidth <= RECALL_PLAN_YIELD_WIDTH) {
      return {
        ...state,
        planOpen: true,
        moreOpen: false,
        rememberedPlanOpen: null,
      };
    }
    return { ...state, planOpen: true, rememberedPlanOpen: null };
  }

  if (action.type === "open-plan") {
    const closeMore = action.closeMore !== false;
    return {
      ...state,
      planOpen: true,
      moreOpen: closeMore ? false : state.moreOpen,
      rememberedPlanOpen: null,
    };
  }

  if (action.type === "close-plan") {
    return { ...state, planOpen: false, rememberedPlanOpen: null };
  }

  if (state.moreOpen && action.contentWidth > RECALL_PLAN_YIELD_WIDTH && state.rememberedPlanOpen !== null) {
    return {
      ...state,
      planOpen: state.rememberedPlanOpen,
      rememberedPlanOpen: null,
    };
  }

  if (state.moreOpen && action.contentWidth <= RECALL_PLAN_YIELD_WIDTH && state.rememberedPlanOpen === null) {
    return {
      ...state,
      planOpen: false,
      rememberedPlanOpen: state.planOpen,
    };
  }
  return state;
}

function persistedEditingContext(
  mode: RecallWorkingContext["mode"],
  decisionId: RecallWorkingContext["decisionId"],
  graph: WorkingGraph,
): RecallWorkingContext {
  return {
    mode,
    decisionId: mode === "global" ? "global" : decisionId,
    drawings: cloneDrawings(graph.drawings),
    timeframe: graph.timeframe,
    cursor: graph.replay.cursor,
    executionCursor: graph.replay.executionCursor,
    revealedCandleCursor: replayMarketCursor(graph.replay) ?? null,
    ...(graph.viewport ? { viewport: graph.viewport } : {}),
  };
}

function upsertDecisionDraft(
  drafts: RecallWorkingContext[] | undefined,
  context: RecallWorkingContext,
): RecallWorkingContext[] {
  return [
    ...(drafts ?? []).filter((draft) => draft.decisionId !== context.decisionId),
    context,
  ];
}

function decisionDraftFor(
  drafts: RecallWorkingContext[] | undefined,
  decisionId: string,
): RecallWorkingContext | undefined {
  return drafts?.find((draft) => draft.mode === "decision" && draft.decisionId === decisionId);
}

type SplitDraft = {
  id: string;
  executionIds: string;
  snapshotIds: string[];
};

const timeframes: Timeframe[] = ["15m", "1h", "4h", "1D", "1W"];
const defaultRecallRepository = createRecallRepository();
const EMPTY_DRAWINGS: NormalizedDrawing[] = [];
const EMPTY_CANDLES_BY_TIMEFRAME: Partial<Record<Timeframe, Candle[]>> = {};
const EMPTY_DATA_DETAILS: ComponentProps<typeof ChartToolbar>["dataDetails"] = [];

function cloneDrawings(drawings: NormalizedDrawing[]) {
  return drawings.map((drawing) => ({
    ...drawing,
    anchors: drawing.anchors.map((anchor) => ({ ...anchor })),
    style: { ...drawing.style },
    visibleOn: drawing.visibleOn === "all"
      ? ("all" as const)
      : ([...drawing.visibleOn] as Timeframe[]),
  })) satisfies NormalizedDrawing[];
}

function drawingsAtDecisionBoundary(document: RecallDocument, decisionId: string | "global"): NormalizedDrawing[] {
  const retained = document.snapshots.filter((snapshot) => snapshot.decisionId === decisionId);
  const latest = retained.at(-1);
  if (latest) return cloneDrawings(latest.drawings);
  const targetIndex = document.decisions.findIndex((decision) => decision.id === decisionId);
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const priorId = document.decisions[index]?.id;
    const prior = priorId
      ? document.snapshots.filter((snapshot) => snapshot.decisionId === priorId).at(-1)
      : undefined;
    if (prior) return cloneDrawings(prior.drawings);
  }
  return cloneDrawings(document.working.drawings.filter((drawing) => drawing.recallOwnerId === decisionId));
}

function nowIso() {
  return new Date().toISOString();
}

function touchRecallDraft<T extends RecallDocument>(document: T): T {
  // Ordinary review edits (including Text content, cursor/timeframe changes,
  // and snapshot replacement) remain an editable draft of the last formal
  // version. Structural aggregate changes use the domain commands, which
  // explicitly mark a completed document as `needs-confirmation`.
  return document;
}

function markRecallNeedsConfirmation<T extends RecallDocument>(document: T): T {
  if (document.status !== "completed") return document;
  const next = { ...document, status: "needs-confirmation" as const, updatedAt: nowIso() } as T;
  delete next.completedAt;
  return next;
}

function formalContentKey(document: RecallDocument): string {
  // Revisions, timestamps, reconciliation bookkeeping, and the nested formal
  // copy are persistence metadata. The remaining aggregate is what the user
  // is changing in the draft and what completion should compare.
  const { version, episodeId, decisions, snapshots, working, status } = document;
  return JSON.stringify({
    version,
    episodeId,
    decisions,
    plans: document.plans,
    retainedBundles: document.retainedBundles,
    planAssociations: document.planAssociations,
    storyboard: document.storyboard,
    snapshots,
    working: {
      drawings: working.drawings,
      timeframe: working.timeframe,
      cursor: working.cursor,
      executionCursor: working.executionCursor,
      editingContext: working.editingContext,
      decisionDrafts: working.decisionDrafts,
      phase: working.phase,
      phaseContexts: working.phaseContexts,
      hasSeenFuture: working.hasSeenFuture,
    },
    status,
  });
}

function snapshotTitle(snapshot: RecallSnapshot, index: number) {
  return `${snapshot.phase === "pre-entry" ? "买入前判断 · " : snapshot.phase === "holding" ? "持仓过程 · " : snapshot.phase === "post-review" ? "事后复盘 · " : ""}${snapshot.timeframe} · 第 ${index + 1} 次留存${snapshot.hasSeenFuture ? " · 已看后续补记" : ""}`;
}

function executionLabel(execution: TradeExecution) {
  return `${execution.side === "buy" ? "买" : "卖"} ${execution.quantity} @ ${execution.price}`;
}

function money(value: string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(amount);
}

function fee(value: string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function stableTextHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function recallExportTextKey(drawing: NormalizedDrawing) {
  const revision = drawing.textRevision === undefined
    ? `legacy-${stableTextHash(drawing.text ?? "")}`
    : String(drawing.textRevision);
  return `${drawing.id}\u0000${revision}\u0000${drawing.recallOwnerId ?? "global"}`;
}

function reorderSnapshotTextDrawings(snapshot: RecallSnapshot, requestedKeys: readonly string[] | undefined) {
  if (!requestedKeys) return snapshot;
  const textDrawings = snapshot.drawings.filter((drawing) => drawing.tool === "text");
  if (requestedKeys.length !== textDrawings.length) return snapshot;
  const byKey = new Map(textDrawings.map((drawing) => [recallExportTextKey(drawing), drawing]));
  const ordered = requestedKeys.map((key) => byKey.get(key));
  if (ordered.some((drawing): drawing is undefined => drawing === undefined)) return snapshot;
  let textIndex = 0;
  return {
    ...snapshot,
    // Keep each drawing's zIndex stable; export ordering is presentation
    // metadata and must not alter chart stacking semantics.
    drawings: snapshot.drawings.map((drawing) => drawing.tool === "text" ? ordered[textIndex++]! : drawing),
  };
}

function formatMarketCursor(timestamp: string, market: string) {
  const timeZone = marketTimeZone(market);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} · ${timeZone}`;
}

function formatMarketCursorShort(timestamp: string, market: string) {
  const timeZone = marketTimeZone(market);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function RecallPlanSecondaryDetails({ summary, children, initialOpen = false }: { summary: string; children: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <details open={open} className="recall-plan-secondary-group" onToggle={event => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
    <summary>{summary}</summary>
    {children}
  </details>;
}

function firstEnabledTimeframe(
  availability: TimeframeAvailability,
  candlesByTimeframe: Partial<Record<Timeframe, Candle[]>>,
): Timeframe {
  if (availability["1D"].enabled && (candlesByTimeframe["1D"]?.length ?? 0) > 0) return "1D";
  return timeframes.find((timeframe) => availability[timeframe].enabled && (candlesByTimeframe[timeframe]?.length ?? 0) > 0)
    ?? timeframes.find((timeframe) => availability[timeframe].enabled)
    ?? "1D";
}

function timeframeCandles(
  timeframe: Timeframe,
  props: Pick<RecallWorkspaceProps, "importedTimelineCandles" | "candlesByTimeframe">,
) {
  return props.candlesByTimeframe?.[timeframe] ?? props.importedTimelineCandles;
}

function executionIdsForDecision(document: RecallDocument, decisionId: string | "global" | null) {
  if (!decisionId || decisionId === "global") return [];
  return document.decisions.find((decision) => decision.id === decisionId)?.executionIds ?? [];
}

function decisionForExecution(document: RecallDocument, executionId: string) {
  return document.decisions.find((decision) => decision.executionIds.includes(executionId))?.id;
}

function currentDecisionExecution(
  document: RecallDocument,
  executions: TradeExecution[],
  selectedDecisionId: string | "global" | null,
) {
  const ids = new Set(executionIdsForDecision(document, selectedDecisionId));
  return executions.find((execution) => ids.has(execution.id));
}

function replayStateIsLater(
  next: RecallReplayCursor,
  current: RecallReplayCursor,
  executions: TradeExecution[],
) {
  const currentExecutionBoundary = executionBoundaryForCursor(executions, current.executionCursor);
  const nextExecutionBoundary = executionBoundaryForCursor(executions, next.executionCursor);
  if (nextExecutionBoundary !== currentExecutionBoundary) {
    return nextExecutionBoundary > currentExecutionBoundary;
  }
  const currentTime = Date.parse(current.cursor);
  const nextTime = Date.parse(next.cursor);
  return Number.isFinite(nextTime) && (!Number.isFinite(currentTime) || nextTime > currentTime);
}

function firstDecisionInExecutionOrder(
  document: RecallDocument,
  executions: TradeExecution[],
) {
  const order = new Map(orderedRecallExecutions(executions).map((execution, index) => [execution.id, index]));
  return document.decisions
    .map((decision, decisionIndex) => ({
      decision,
      decisionIndex,
      firstIndex: Math.min(...decision.executionIds.map((id) => order.get(id) ?? Number.POSITIVE_INFINITY)),
    }))
    .filter((item) => Number.isFinite(item.firstIndex))
    .sort((left, right) => left.firstIndex - right.firstIndex || left.decisionIndex - right.decisionIndex)
    .at(0)?.decision;
}

/** The market cutoff is the last completed candle; execution knowledge stays separate. */
function replayMarketCursor(replay: RecallReplayCursor): string | undefined {
  // New replay states carry this independently from the execution knowledge
  // cursor. An explicit null means that no market candle is known; only old
  // states without the field may infer it from their revealed candle list.
  if (replay.revealedCandleCursor !== undefined) return replay.revealedCandleCursor ?? undefined;
  const lastRevealed = replay.revealedCandles.at(-1);
  return lastRevealed ? candleKnowledgeAt(lastRevealed) : undefined;
}

function marketRevealCursor(replay: RecallReplayCursor): string | undefined {
  return replay.mode === "history"
    ? replay.cursor
    : replayMarketCursor(replay) ?? replay.cursor;
}

function marketCursorForPersistedContext(
  context: RecallWorkingContext,
  executions: TradeExecution[],
  candles: Candle[],
) {
  if (context.revealedCandleCursor !== undefined) return context.revealedCandleCursor ?? undefined;
  if (context.executionCursor === NO_REVEALED_EXECUTIONS) return context.cursor;
  const boundaryExecution = executionsThroughCursor(executions, context.executionCursor).at(-1);
  if (!boundaryExecution) return context.cursor;
  return recallMarketCursorForExecution(
    boundaryExecution,
    mapRecallExecutionToCandle(boundaryExecution, candles),
  ) ?? context.cursor;
}

function mapCursorToTimeframe(
  replay: RecallReplayCursor,
  executions: TradeExecution[],
  candles: Candle[],
) {
  const sorted = [...candles].sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
  if (replay.mode === "history") {
    return {
      ...replay,
      revealedCandleCursor: sorted.at(-1) ? candleKnowledgeAt(sorted.at(-1)!) : null,
      revealedCandles: sorted,
      revealedExecutions: orderedRecallExecutions(executions),
      currentCandle: sorted.at(-1),
    };
  }
  // Keep the legacy fallback local to this projection: Astra's persisted
  // extraction exercises this mapper without the surrounding workspace.
  const marketCursor = replay.revealedCandleCursor !== undefined
    ? replay.revealedCandleCursor ?? undefined
    : replay.revealedCandles.at(-1)
      ? candleKnowledgeAt(replay.revealedCandles.at(-1)!)
      : undefined;
  const revealedCandles = marketCursor ? revealableCandlesThroughCursor(sorted, marketCursor) : [];
  const revealedExecutions = visibleRecallExecutions(executions, replay.executionCursor, replay.cursor);
  const lastExecution = revealedExecutions.at(-1);
  const mapped = lastExecution ? mapRecallExecutionToCandle(lastExecution, sorted) : undefined;
  const current = mapped && revealedCandles.some((candle) => candle.time === mapped.time)
    ? mapped
    : lastExecution
      ? undefined
      : revealedCandles.at(-1);
  return {
    ...replay,
    // Timeframe changes remap market data only. Keep both replay cursors at
    // their persisted boundary; an incomplete target bar must not promote
    // the knowledge cursor to its future provider cutoff.
    cursor: replay.cursor,
    revealedCandleCursor: marketCursor ?? null,
    revealedCandles,
    revealedExecutions,
    currentCandle: current,
  };
}

function revealRecallExecutionBoundary(
  execution: TradeExecution,
  executions: TradeExecution[],
  candles: Candle[],
): RecallReplayCursor {
  const currentCandle = mapRecallExecutionToCandle(execution, candles);
  const knowledgeCursor = [
    recallExecutionKnowledgeAt(execution),
    currentCandle ? candleKnowledgeAt(currentCandle) : undefined,
  ].filter((value): value is string => Boolean(value)).sort((left, right) => Date.parse(left) - Date.parse(right)).at(-1)!;
  const marketCursor = recallMarketCursorForExecution(execution, currentCandle);
  return {
    cursor: knowledgeCursor,
    executionCursor: execution.id,
    mode: "replay",
    revealedCandleCursor: marketCursor ?? null,
    revealedCandles: marketCursor ? revealableCandlesThroughCursor(candles, marketCursor) : [],
    revealedExecutions: visibleRecallExecutions(executions, execution.id, knowledgeCursor),
    currentCandle: currentCandle && marketCursor && Date.parse(candleKnowledgeAt(currentCandle)) <= Date.parse(marketCursor)
      ? currentCandle
      : undefined,
  };
}

function restorePersistedWorkingGraph(
  context: RecallWorkingContext,
  decisions: RecallDocument["decisions"],
  executions: TradeExecution[],
  candles: Candle[],
): WorkingGraph {
  const liveDecision = decisions.find(decision =>
    (context.decisionId === "global" || decision.id === context.decisionId)
    && decision.executionIds.some(id => executions.some(execution => execution.id === id)));
  const marketCursor = marketCursorForPersistedContext(context, executions, candles);
  const knownCandles = marketCursor ? revealableCandlesThroughCursor(candles, marketCursor) : [];
  // Removed decisions retain their drawings and owner until explicitly
  // reassigned. They must not reveal an unrelated decision's executions.
  const base: RecallReplayCursor = liveDecision ? revealRecallDecision({
    candles,
    executions,
    decisions,
    decisionId: liveDecision.id,
  }) : {
    cursor: context.cursor, executionCursor: NO_REVEALED_EXECUTIONS, mode: "replay",
    revealedCandleCursor: marketCursor ?? null,
    revealedCandles: knownCandles, revealedExecutions: [], currentCandle: knownCandles.at(-1),
  };
  const boundary = executionBoundaryForCursor(executions, context.executionCursor);
  const beforeFirst = context.executionCursor === NO_REVEALED_EXECUTIONS;
  const replay: RecallReplayCursor = {
    ...base,
    cursor: context.cursor || base.cursor,
    executionCursor: boundary >= 0 || beforeFirst ? context.executionCursor : base.executionCursor,
    revealedCandleCursor: marketCursor ?? null,
    revealedExecutions: boundary >= 0
      ? visibleRecallExecutions(executions, context.executionCursor, context.cursor)
      : beforeFirst
        ? []
        : base.revealedExecutions,
    revealedCandles: knownCandles,
  };
  return {
    drawings: cloneDrawings(context.drawings),
    replay: mapCursorToTimeframe(replay, executions, candles),
    timeframe: context.timeframe,
    viewport: context.viewport,
  };
}

function textContentChanged(previous: NormalizedDrawing, next: NormalizedDrawing) {
  return previous.text !== next.text;
}

function stampRecallDrawingCommand(
  command: DrawingCommand,
  drawings: NormalizedDrawing[],
  ownerId: string | "global" | null,
  phase: RecallPhase,
  hasSeenFuture: boolean,
): DrawingCommand {
  const owner = ownerId ?? "global";
  if (command.type === "add" && command.drawing.tool === "text") {
    return {
      ...command,
      drawing: {
        ...command.drawing,
        recallOwnerId: owner,
        textRevision: command.drawing.textRevision ?? 1,
        stage: phase === "pre-entry" ? "pre-trade" : phase === "holding" ? "during-replay" : "post-review",
        recallHasSeenFuture: hasSeenFuture,
      },
    };
  }
  if (command.type !== "replace" || command.drawing.tool !== "text") return command;
  const previous = drawings.find((drawing) => drawing.id === command.drawing.id);
  if (!previous || !textContentChanged(previous, command.drawing)) {
    return command;
  }
  return {
    ...command,
    drawing: {
      ...command.drawing,
      recallOwnerId: owner,
      textRevision: (previous.textRevision ?? 0) + 1,
      stage: phase === "pre-entry" ? "pre-trade" : phase === "holding" ? "during-replay" : "post-review",
      recallHasSeenFuture: hasSeenFuture,
    },
  };
}

function createSnapshot(
  existing: RecallSnapshot | undefined,
  ownerId: string | "global" | null,
  timeframe: Timeframe,
  replay: RecallReplayCursor,
  drawings: NormalizedDrawing[],
  candles: Candle[],
  capture: { imageDataUrl: string; viewport: ChartViewport },
): RecallSnapshot {
  const id = existing?.id ?? `recall-snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = nowIso();
  return {
    id,
    // The current market pipeline accepts raw prices only. Historical images
    // keep their original (possibly unknown) basis when edited.
    ...(existing ? (existing.priceBasis ? { priceBasis: existing.priceBasis } : {}) : { priceBasis: "raw" as const }),
    ...(existing?.phase ? { phase: existing.phase } : {}),
    ...(existing?.hasSeenFuture !== undefined ? { hasSeenFuture: existing.hasSeenFuture } : {}),
    decisionId: ownerId ?? "global",
    timeframe,
    cursor: replay.cursor,
    executionCursor: replay.executionCursor,
    candles: candles.map((candle) => ({ ...candle, tradingDates: candle.tradingDates ? [...candle.tradingDates] : undefined })),
    drawings: cloneDrawings(drawings),
    viewport: { ...capture.viewport, logicalRange: capture.viewport.logicalRange ? { ...capture.viewport.logicalRange } : null },
    imageDataUrl: capture.imageDataUrl,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function isConflict(error: unknown) {
  return error instanceof RecallRepositoryError && error.status === 409;
}

/**
 * Recall's actual imported-trade workspace. It owns only review state; the
 * parent continues to own ingestion, market-data loading and episode facts.
 */
export function RecallWorkspace({
  episode,
  episodes,
  instrument,
  instruments,
  timeframeAvailability,
  importedTimelineCandles,
  candlesByTimeframe = EMPTY_CANDLES_BY_TIMEFRAME,
  settings,
  initialDrawings = EMPTY_DRAWINGS,
  dataDetails = EMPTY_DATA_DETAILS,
  repository = defaultRecallRepository,
  onEpisodeChange,
  onInstrumentChange,
  onTimeframeChange,
  onSettingsChange,
  onRefreshMarketData,
  onLeaveGuardChange,
  onSaved,
  onFormalCompletion,
  focused,
  onFocusedChange,
  onExport,
  headerActions,
}: RecallWorkspaceProps) {
  const fallbackTimeframe = firstEnabledTimeframe(timeframeAvailability, candlesByTimeframe);
  // The parent keeps a legacy timeline projection in sync with its own
  // timeframe state. That projection changes identity when Recall switches
  // timeframe, but it is not an episode-load boundary. Keep the latest
  // fallback available to explicit restores without making the load callback
  // churn and re-reading the old draft after a user change.
  const importedTimelineCandlesRef = useRef(importedTimelineCandles);
  importedTimelineCandlesRef.current = importedTimelineCandles;
  const chartHandleRef = useRef<RecallChartHandle | null>(null);
  const previousEpisodeIdRef = useRef<string | null>(null);
  const saveDocumentRef = useRef<((document?: RecallDocument, force?: boolean, generation?: number) => Promise<void>) | null>(null);
  const saveQueueRef = useRef(Promise.resolve());
  // Only responses accepted from this queue may advance a queued candidate's
  // CAS baseline. Never rebase onto a fetched external revision.
  const acceptedQueuedSavesRef = useRef(new Map<string, { document: RecallDocument; generation: number }>());
  const draftGenerationRef = useRef(0);
  const episodeRef = useRef(episode);
  const draftRef = useRef<RecallDocument | null>(null);
  const latestSavedDocumentRef = useRef<RecallDocument | null>(null);
  const latestSavedGenerationRef = useRef(-1);
  const dirtyRef = useRef(false);
  const initialPlanFreezeEpisodeRef = useRef<string | null>(null);
  const [initialPlanFreezeEpisode, setInitialPlanFreezeEpisode] = useState<string | null>(null);
  const snapshotEditBackupRef = useRef<SnapshotEditBackup | null>(null);
  const historyReplayBackupRef = useRef<RecallReplayCursor | null>(null);
  const revealRequestIdRef = useRef(0);
  const pendingViewportRestoreRef = useRef<ChartViewport | null>(null);
  const queuedViewportRestoreRef = useRef<ChartViewport | null>(null);
  const phaseViewportRestoreRef = useRef<PhaseViewportRestoreRequest | null>(null);
  const phaseViewportRestoreGenerationRef = useRef(0);
  const phaseViewportContextTransitionRef = useRef<Pick<PhaseViewportRestoreRequest, "phase" | "timeframe" | "cursor"> | null>(null);
  const deletedSnapshotRef = useRef<RecallSnapshot | null>(null);
  const globalWorkingContextRef = useRef<WorkingGraph | null>(null);
  const stageWorkingContextsRef = useRef(new Map<string, WorkingGraph>());
  const activeContextModeRef = useRef<RecallWorkingContext["mode"]>("global");
  const [document, setDocument] = useState<RecallDocument | null>(null);
  const [formalBaseline, setFormalBaseline] = useState<RecallDocument | null>(null);
  const [replay, setReplay] = useState<RecallReplayCursor | null>(null);
  const [revealRequest, setRevealRequest] = useState<{ id: number; time: string } | undefined>();
  const [phaseViewportRestoreToken, setPhaseViewportRestoreToken] = useState(0);
  const [drawingHistory, setDrawingHistory] = useState<DrawingHistory>(() => createDrawingHistory());
  const drawingHistoryRef = useRef<DrawingHistory>(drawingHistory);
  const [timeframe, setTimeframe] = useState<Timeframe>(fallbackTimeframe);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | "global" | null>(null);
  const [selectedDecisionIds, setSelectedDecisionIds] = useState<string[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [leftNavOpen, setLeftNavOpen] = useState(focused === undefined);
  const [mobileRecordsOpen, setMobileRecordsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [panelState, setPanelState] = useState<RecallPanelState>(() => ({
    episodeId: episode.id,
    planOpen: true,
    moreOpen: false,
    rememberedPlanOpen: null,
  }));
  const { moreOpen, planOpen } = panelState;
  const [phase, setPhase] = useState<RecallPhase>("holding");
  const [playing, setPlaying] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [snapshotEditDirty, setSnapshotEditDirty] = useState(false);
  const [snapshotCandles, setSnapshotCandles] = useState<Candle[] | null>(null);
  const [splitDrafts, setSplitDrafts] = useState<SplitDraft[] | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [phaseResolutionNotice, setPhaseResolutionNotice] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const navOpen = !focused && leftNavOpen;
  const focusMode = !navOpen;

  const markDirty = useCallback(() => {
    draftGenerationRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  const cancelPhaseViewportRestore = useCallback(() => {
    const hadPendingRestore = phaseViewportRestoreRef.current !== null;
    phaseViewportRestoreRef.current = null;
    phaseViewportContextTransitionRef.current = null;
    const generation = ++phaseViewportRestoreGenerationRef.current;
    if (hadPendingRestore) setPhaseViewportRestoreToken(generation);
  }, []);

  const requestReveal = useCallback((time: string | undefined) => {
    if (!time) return;
    // A queued restore belongs to the document that requested the reveal. A
    // later user reveal supersedes it before the chart is ready.
    queuedViewportRestoreRef.current = null;
    cancelPhaseViewportRestore();
    const id = revealRequestIdRef.current + 1;
    revealRequestIdRef.current = id;
    setRevealRequest({ id, time });
  }, [cancelPhaseViewportRestore]);

  const restoreQueuedViewport = useCallback(() => {
    const queuedViewport = queuedViewportRestoreRef.current;
    const handle = chartHandleRef.current;
    if (!queuedViewport || !handle) return;
    // ReplayChart creates its lightweight-charts handle after an async SDK
    // import. Wait one paint after onReady so the chart's initial data/reveal
    // effects have committed before applying the persisted window.
    window.requestAnimationFrame(() => {
      if (queuedViewportRestoreRef.current !== queuedViewport || chartHandleRef.current !== handle) return;
      queuedViewportRestoreRef.current = null;
      handle.restoreViewport(queuedViewport);
    });
  }, []);

  useEffect(() => {
    draftRef.current = document;
    dirtyRef.current = dirty;
    drawingHistoryRef.current = drawingHistory;
  }, [document, dirty, drawingHistory]);

  useEffect(() => {
    episodeRef.current = episode;
  }, [episode]);

  const [pendingPlanField, setPendingPlanField] = useState<string | null>(null);
  const [selectedRevisionPlanId, setSelectedRevisionPlanId] = useState<string | undefined>();
  const [revisionInputError, setRevisionInputError] = useState<string | null>(null);
  const [evaluationInputError, setEvaluationInputError] = useState<string | null>(null);
  const [manualEvaluationInputError, setManualEvaluationInputError] = useState<string | null>(null);
  const [manualEvaluationValid, setManualEvaluationValid] = useState(true);
  const [revisionDragError, setRevisionDragError] = useState<string | null>(null);
  const [planEdits, setPlanEdits] = useState<Record<string, { input: RecallPlanInput; error: string | null }>>({});
  const planToggleRef = useRef<HTMLButtonElement>(null);
  const workspaceElementRef = useRef<HTMLElement>(null);
  const recallPanelContentWidth = useCallback(() => {
    const chartAndPlan = workspaceElementRef.current?.querySelector<HTMLElement>(".recall-chart-and-plan");
    return chartAndPlan?.getBoundingClientRect().width ?? Number.POSITIVE_INFINITY;
  }, []);
  const updateRecallPanelState = useCallback((action: RecallPanelAction) => {
    setPanelState(current => transitionRecallPanelState(current, action));
  }, []);
  const openPlanAndCloseMore = useCallback(() => {
    updateRecallPanelState({ type: "open-plan", closeMore: true });
  }, [updateRecallPanelState]);
  useEffect(() => {
    setSelectedRevisionPlanId(undefined);
    setPlanEdits({});
    setRevisionDragError(null);
    updateRecallPanelState({ type: "episode-change", episodeId: episode.id });
  }, [episode.id, updateRecallPanelState]);
  useEffect(() => {
    if (phase !== "post-review" && !editingSnapshotId) {
      setManualEvaluationInputError(null);
      setManualEvaluationValid(true);
    }
  }, [editingSnapshotId, phase]);
  useEffect(() => {
    if (!planOpen || !pendingPlanField) return;
    const field = workspaceElementRef.current?.querySelector<HTMLInputElement>(`input[aria-label="${pendingPlanField}"]`);
    field?.focus();
    setPendingPlanField(null);
  }, [planOpen, pendingPlanField]);
  useEffect(() => {
    const workspace = workspaceElementRef.current;
    if (!workspace) return;
    const measure = () => {
      const viewport = window.visualViewport;
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      // Document coordinates remain stable when native focus scrolls an
      // ancestor. Viewport-relative origins caused the height to grow as
      // the page scrolled, which in turn invited another focus scroll.
      const top = workspace.getBoundingClientRect().top + window.scrollY;
      workspace.style.setProperty("--recall-available-height", `${Math.max(240, bottom - Math.max(0, top))}px`);
      const chart = workspace.querySelector(".recall-chart-and-plan");
      if (chart) {
        const main = workspace.querySelector(".recall-main");
        const chartTop = chart.getBoundingClientRect().top + window.scrollY + (main?.scrollTop ?? 0);
        const formHeight = Math.max(88, bottom - chartTop - 234 - 12);
        workspace.style.setProperty("--recall-plan-form-height", `${formHeight}px`);
      }
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(workspace);
    if (workspace.parentElement) observer?.observe(workspace.parentElement);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [loading, document?.episodeId, planOpen]);
  useEffect(() => {
    const workspace = workspaceElementRef.current;
    const chartAndPlan = workspace?.querySelector<HTMLElement>(".recall-chart-and-plan");
    if (!chartAndPlan) return;
    const syncMoreWidth = () => {
      setPanelState(current => transitionRecallPanelState(current, {
        type: "sync-more-width",
        contentWidth: chartAndPlan.getBoundingClientRect().width,
      }));
    };
    syncMoreWidth();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncMoreWidth);
    observer?.observe(chartAndPlan);
    window.addEventListener("resize", syncMoreWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncMoreWidth);
    };
  }, [document?.episodeId, episode.id, loading]);
  const openingSide = episode.direction === "short" ? "sell" : "buy";
  const openingDecisions = document?.decisions.filter(decision =>
    decision.executionIds.some(id =>
      episode.executions.some(fill => fill.id === id && fill.side === openingSide),
    ),
  ) ?? [];
  const planDecisionId = openingDecisions.find(decision => decision.id === selectedDecisionId)?.id ?? openingDecisions[0]?.id;
  const viewedSnapshot = document?.snapshots.find(snapshot => snapshot.id === editingSnapshotId);
  const viewedBundle = document?.retainedBundles?.find(bundle => bundle.id === viewedSnapshot?.retainedBundleId);
  const associatedPlanIds = document?.planAssociations?.filter(link => link.status === "linked" && link.decisionId === planDecisionId).map(link => link.planId);
  const ownsPlan = (plan: RecallPlanDraft) => associatedPlanIds?.includes(plan.planId)
    || (!document?.planAssociations?.some(link => link.planId === plan.planId)
      && plan.decisionId === planDecisionId);
  const planDraft = document?.plans?.drafts.find(ownsPlan);
  const frozenPlan = document?.plans?.versions.find(plan => ownsPlan(plan) && plan.kind === "initial");
  const planEdit = planDecisionId ? planEdits[planDecisionId] : undefined;
  const snapshotVersions = document && viewedBundle ? getRecallBundlePlans(document, viewedBundle) : [];
  // A bundle can contain several entry lineages. Resolve the captured owner,
  // never today's mutable plan associations or document array order.
  const capturedOwner = viewedBundle?.decisions.find(decision => decision.id === viewedSnapshot?.decisionId);
  const ownedSnapshotVersions = capturedOwner
    ? snapshotVersions.filter(version => version.decisionId === capturedOwner.id)
    : [];
  const snapshotPlan = ownedSnapshotVersions.length === 1
    ? ownedSnapshotVersions[0]
    : snapshotVersions.length === 1 ? snapshotVersions[0] : undefined;
  const snapshotPlanAmbiguous = Boolean(editingSnapshotId && !snapshotPlan && snapshotVersions.length > 1);
  const planInput = editingSnapshotId
    ? snapshotPlan?.input ?? null
    : frozenPlan?.input ?? planEdit?.input ?? planDraft?.input
      ?? (phase === "pre-entry" && planDecisionId ? emptyRecallPlanInput(instrument.currency) : null);
  const planReadOnly = phase !== "pre-entry" || Boolean(frozenPlan) || Boolean(editingSnapshotId) || initialPlanFreezeEpisode === episode.id;
  const revisionPlanId = selectedRevisionPlanId ?? planDraft?.planId ?? frozenPlan?.planId;
  const revisionDraft = document?.plans?.drafts.find(draft => draft.planId === revisionPlanId && draft.kind !== "initial");
  const holdingPlan = phase === "holding" && !editingSnapshotId ? revisionDraft : undefined;
  const chartPlanInput = holdingPlan?.input ?? planInput;
  const chartPlanEditable = Boolean(holdingPlan) || !planReadOnly;
  const planPriceLines = useMemo(() => {
    if (!chartPlanInput || chartPlanInput.priceBasis !== "raw") return [];
    return [
      { id: "entry", price: chartPlanInput.entry, title: "计划入场" },
      { id: "stop", price: chartPlanInput.initialStop, title: "初始止损" },
      { id: "target", price: chartPlanInput.targets[0]?.price, title: "止盈目标" },
    ]
      .filter(line => line.price && /^\d+(\.\d+)?$/.test(line.price) && Number(line.price) > 0)
      .map(line => ({ ...line, price: Number(line.price) }));
  }, [chartPlanInput]);
  const editPlan = (input: RecallPlanInput) => {
    if (!document || !replay || !planDecisionId || planReadOnly || initialPlanFreezeEpisodeRef.current === episode.id) return;
    try {
      const issues = calculateRecallPlan(input).issues;
      if (issues.length) throw new Error(issues.map(issue => issue.message).join("；"));
      const draft: RecallPlanDraft = {
        ...(planDraft ?? {
          id: `plan-draft-${crypto.randomUUID()}`,
          planId: `plan-${crypto.randomUUID()}`,
          decisionId: planDecisionId,
          kind: "initial" as const,
        }),
        input,
        recordedPhase: phase,
        source: "retrospective",
        recordedAt: nowIso(),
        knowledgeCutoff: { cursor: replay.cursor, executionCursor: replay.executionCursor },
        hasSeenFuture: document.working.hasSeenFuture === true,
      };
      const next = upsertRecallPlanDraft(document, draft);
      setDocument(touchRecallDraft(next));
      setPlanEdits(current => ({ ...current, [planDecisionId]: { input, error: null } }));
      markDirty();
    } catch (error) {
      setPlanEdits(current => ({ ...current, [planDecisionId]: { input, error: error instanceof Error ? error.message : "计划输入无效" } }));
    }
  };
  const closePlan = () => { updateRecallPanelState({ type: "close-plan" }); planToggleRef.current?.focus(); };
  const selectPlanPrice = (id: string) => {
    setPlaying(false);
    openPlanAndCloseMore();
    const label = { entry: "计划入场", stop: "初始止损", target: "止盈目标" }[id];
    if (label && chartPlanEditable) setPendingPlanField(label);
  };
  const changePlanPrice = (id: string, price: string) => {
    setPlaying(false);
    if (!chartPlanInput || !chartPlanEditable) return;
    const next = id === "entry" ? { ...chartPlanInput, entry: price }
      : id === "stop" ? { ...chartPlanInput, initialStop: price }
        : id === "target" ? { ...chartPlanInput, targets: chartPlanInput.targets.map((target, index) => index === 0 ? { ...target, price } : target) }
          : null;
    if (!next) return;
    if (!holdingPlan || !document || !replay) { editPlan(applyRecallSizing(next)); return; }
    try {
      const updated = upsertRecallPlanDraft(document, {
        ...holdingPlan, input: applyRecallSizing(next), recordedAt: nowIso(), recordedPhase: phase,
        knowledgeCutoff: { cursor: replay.cursor, executionCursor: replay.executionCursor },
        hasSeenFuture: document.working.hasSeenFuture === true,
      });
      setDocument(touchRecallDraft(updated));
      markDirty();
      setRevisionDragError(null);
    } catch (error) {
      setRevisionDragError(error instanceof Error ? error.message : "计划线调整无效");
    }
  };

  const allCandles = timeframeCandles(timeframe, { importedTimelineCandles, candlesByTimeframe });
  const currentExecutions = episode.executions;
  const currentDecision = document?.decisions.find((decision) => decision.id === selectedDecisionId);
  const snapshotEdit = document?.snapshots.find((snapshot) => snapshot.id === editingSnapshotId);
  const chartCandles = snapshotCandles ?? replay?.revealedCandles ?? allCandles;
  const chartExecutions = useMemo(
    () => snapshotEdit
      ? visibleRecallExecutions(currentExecutions, snapshotEdit.executionCursor, snapshotEdit.cursor)
      : replay?.mode === "history"
        ? orderedRecallExecutions(currentExecutions)
        : replay?.revealedExecutions ?? [],
    [currentExecutions, replay?.mode, replay?.revealedExecutions, snapshotEdit],
  );
  const latestCandle = chartCandles.at(-1);
  const actualMetrics = useMemo(() => {
    if (editingSnapshotId) return viewedBundle?.actualMetrics ?? null;
    if (!document || !replay) return null;
    const linked = new Set(document.planAssociations?.filter(link => link.status === "linked").map(link => link.planId));
    const versions = (document.plans?.versions ?? []).filter(version => linked.has(version.planId)
      && Date.parse(version.knowledgeCutoff.cursor) <= Date.parse(replay.cursor)
      && executionBoundaryForCursor(episode.executions, version.knowledgeCutoff.executionCursor)
        <= executionBoundaryForCursor(episode.executions, replay.executionCursor));
    return calculateRecallActualMetrics({
      episode, decisions: document.decisions, planVersions: versions,
      riskBaselines: (document.plans?.riskBaselines ?? []).filter(baseline => versions.some(version => version.id === baseline.planVersionId)),
      context: { phase, cursor: replay.cursor, executionCursor: replay.executionCursor },
      ...(latestCandle ? { mark: { price: String(latestCandle.close), time: candleKnowledgeAt(latestCandle), priceBasis: "raw" as const } } : {}),
      source: { documentRevision: document.revision, evidenceDigest: captureRecallExecutionEvidence(episode).digest, computedAt: nowIso() },
    });
  }, [document, editingSnapshotId, episode, latestCandle, phase, replay, viewedBundle]);
  const position = useMemo(
    () => replayPositionAtPrice({
      executions: chartExecutions,
      markPrice: String(latestCandle?.close ?? chartExecutions.at(-1)?.price ?? 0),
    }),
    [chartExecutions, latestCandle?.close],
  );
  const tradeNature = episode.tradeNature ?? (currentExecutions[0] ? tradeNatureOf(currentExecutions[0]) : "unknown");
  const simulationRunId = episode.simulationRunId ?? currentExecutions.find((execution) => tradeNatureOf(execution) === "simulation")?.source.simulationRunId;
  const pnlPositive = Number(position.netPnl) >= 0;
  const pnlAvailable = !position.accuracy;
  const quantityAvailable = position.quantityKnown !== false && !position.accuracy?.reasons.some((reason) => ["ambiguous-opening", "ambiguous-event-order", "history-incomplete"].includes(reason));
  const feeCurrencies = new Set(chartExecutions.map(executionFeeCurrency));
  const feeCurrency = feeCurrencies.size === 1
    ? [...feeCurrencies][0]
    : chartExecutions.length === 0
      ? instrument.currency
      : undefined;
  const settlementCurrencyMismatch = position.accuracy?.reasons.includes("settlement-currency-mismatch");
  const visibleSourceReport = [...chartExecutions]
    .reverse()
    .find((execution) => execution.source.sourceReport)?.source.sourceReport;
  const missing = useMemo(() => document ? missingDecisionIds(document) : [], [document]);
  const hasFormalDraft = useMemo(() => {
    if (!document || document.status !== "completed") return false;
    const baseline = document.lastCompleted ?? formalBaseline;
    return baseline ? formalContentKey(document) !== formalContentKey(baseline) : false;
  }, [document, formalBaseline]);
  const reconciliationOrphans = useMemo(
    () => document?.decisions.filter((decision) => decision.executionIds.length === 0) ?? [],
    [document],
  );
  const executionCandleIndex = useMemo(
    () => recallExecutionCandleIndex(allCandles, currentExecutions),
    [allCandles, currentExecutions],
  );
  const unmatchedDecisionIds = useMemo(() => {
    if (!document) return new Set<string>();
    return new Set(
      document.decisions
        .filter((decision) => decision.executionIds.some((id) => executionCandleIndex.get(id) === -1))
        .map((decision) => decision.id),
    );
  }, [document, executionCandleIndex]);
  const visibleDrawings = useMemo(
    () => visibleDrawingsAtCursor(drawingHistory.present, replay?.cursor ?? episode.startedAt, timeframe),
    [drawingHistory.present, episode.startedAt, replay?.cursor, timeframe],
  );
  const canUndo = replay ? canUndoDrawingAtCursor(drawingHistory, replay.cursor, timeframe) : false;
  const canRedo = replay ? canRedoDrawingAtCursor(drawingHistory, replay.cursor, timeframe) : false;
  const allLocked = visibleDrawings.length > 0 && visibleDrawings.every((drawing) => drawing.locked);

  const commitDrawingHistory = useCallback((nextHistory: DrawingHistory) => {
    if (nextHistory === drawingHistory) return;
    // Chart capture can commit a focused text editor immediately before it
    // resolves. Keep this ref ahead of React's effect phase so retention and
    // finalization never clone the previous drawing list.
    drawingHistoryRef.current = nextHistory;
    setDrawingHistory(nextHistory);
    if (!editingSnapshotId && !historyMode) {
      const stageDecisionId = activeContextModeRef.current === "decision" && selectedDecisionId && selectedDecisionId !== "global"
        ? selectedDecisionId
        : null;
      if (stageDecisionId && replay) {
        const graph: WorkingGraph = {
          drawings: cloneDrawings(nextHistory.present),
          replay,
          timeframe,
        };
        stageWorkingContextsRef.current.set(stageDecisionId, graph);
        const context = persistedEditingContext("decision", stageDecisionId, graph);
        setDocument((current) => current ? touchRecallDraft({
          ...current,
          updatedAt: nowIso(),
          working: {
            ...current.working,
            selectedDecisionId: stageDecisionId,
            editingContext: context,
            decisionDrafts: upsertDecisionDraft(current.working.decisionDrafts, context),
          },
        }) : current);
      } else {
        const currentGlobal = globalWorkingContextRef.current;
        if (currentGlobal && replay) {
          globalWorkingContextRef.current = {
            ...currentGlobal,
            drawings: cloneDrawings(nextHistory.present),
            replay,
            timeframe,
          };
        }
        setDocument((current) => current ? touchRecallDraft({
          ...current,
          updatedAt: nowIso(),
          working: { ...current.working, drawings: cloneDrawings(nextHistory.present) },
        }) : current);
      }
      markDirty();
    } else if (editingSnapshotId) {
      setSnapshotEditDirty(true);
    }
  }, [drawingHistory, editingSnapshotId, historyMode, markDirty, replay, selectedDecisionId, timeframe]);

  const setWorking = useCallback((nextReplay: RecallReplayCursor, nextSelectedDecisionId = selectedDecisionId, nextDrawings = drawingHistory.present) => {
    requestReveal(marketRevealCursor(nextReplay));
    setReplay(nextReplay);
    if (editingSnapshotId) {
      setSnapshotEditDirty(true);
      return;
    }
    if (historyMode) return;
    const stageDecisionId = activeContextModeRef.current === "decision" && nextSelectedDecisionId && nextSelectedDecisionId !== "global"
      ? nextSelectedDecisionId
      : null;
    const graph: WorkingGraph = {
      drawings: cloneDrawings(nextDrawings),
      replay: nextReplay,
      timeframe,
      viewport: globalWorkingContextRef.current?.viewport ?? chartHandleRef.current?.getViewport(),
    };
    if (stageDecisionId) {
      stageWorkingContextsRef.current.set(stageDecisionId, graph);
      const context = persistedEditingContext("decision", stageDecisionId, graph);
      setDocument((current) => current ? touchRecallDraft({
        ...current,
        updatedAt: nowIso(),
        working: {
          ...current.working,
          selectedDecisionId: stageDecisionId,
          editingContext: context,
          decisionDrafts: upsertDecisionDraft(current.working.decisionDrafts, context),
        },
      }) : current);
    } else {
      globalWorkingContextRef.current = graph;
      setDocument((current) => current ? touchRecallDraft({
        ...current,
        updatedAt: nowIso(),
        working: {
          ...current.working,
          cursor: nextReplay.cursor,
          executionCursor: nextReplay.executionCursor,
          selectedDecisionId: nextSelectedDecisionId,
          timeframe,
          drawings: cloneDrawings(nextDrawings),
          editingContext: undefined,
        },
      }) : current);
    }
    markDirty();
  }, [drawingHistory.present, editingSnapshotId, historyMode, markDirty, requestReveal, selectedDecisionId, timeframe]);

  const restoreWorkingFromDocument = useCallback((nextDocument: RecallDocument, preferredTimeframe?: Timeframe, emitRevealRequest = true) => {
    queuedViewportRestoreRef.current = null;
    const currentImportedTimelineCandles = importedTimelineCandlesRef.current;
    const nextTimeframe = preferredTimeframe && timeframeAvailability[preferredTimeframe].enabled
      ? preferredTimeframe
      : nextDocument.working.timeframe && timeframeAvailability[nextDocument.working.timeframe].enabled
        ? nextDocument.working.timeframe
        : fallbackTimeframe;
    const globalCandles = timeframeCandles(nextTimeframe, { importedTimelineCandles: currentImportedTimelineCandles, candlesByTimeframe });
    const globalReplayBase = revealRecallDecision({
      candles: globalCandles,
      executions: currentExecutions,
      decisions: nextDocument.decisions,
      decisionId: nextDocument.decisions.find(decision => decision.executionIds.some(id => currentExecutions.some(execution => execution.id === id)))?.id ?? "",
    });
    const storedExecutionCursor = nextDocument.working.executionCursor;
    const storedBoundary = executionBoundaryForCursor(currentExecutions, storedExecutionCursor);
    const storedBeforeFirst = storedExecutionCursor === NO_REVEALED_EXECUTIONS;
    // Legacy global drafts store market progress in working.cursor. Keep this
    // market cutoff independent from the stable execution-prefix cursor.
    const storedMarketCursor = nextDocument.working.cursor || globalReplayBase.cursor;
    const globalReplay: RecallReplayCursor = {
      ...globalReplayBase,
      cursor: nextDocument.working.cursor || globalReplayBase.cursor,
      executionCursor: storedBoundary >= 0 || storedBeforeFirst ? storedExecutionCursor : globalReplayBase.executionCursor,
      revealedExecutions: storedBoundary >= 0
        ? visibleRecallExecutions(currentExecutions, storedExecutionCursor, nextDocument.working.cursor)
        : storedBeforeFirst
          ? []
          : globalReplayBase.revealedExecutions,
      revealedCandleCursor: storedMarketCursor ?? null,
      revealedCandles: storedMarketCursor ? revealableCandlesThroughCursor(globalCandles, storedMarketCursor) : [],
    };
    const globalGraph: WorkingGraph = {
      drawings: cloneDrawings(nextDocument.working.drawings),
      replay: mapCursorToTimeframe(globalReplay, currentExecutions, globalCandles),
      timeframe: nextTimeframe,
    };
    globalWorkingContextRef.current = globalGraph;
    stageWorkingContextsRef.current.clear();
    for (const persistedDraft of nextDocument.working.decisionDrafts ?? []) {
      if (!nextDocument.decisions.some((decision) => decision.id === persistedDraft.decisionId)) continue;
      const draftTimeframe = timeframeAvailability[persistedDraft.timeframe].enabled
        ? persistedDraft.timeframe
        : nextTimeframe;
      const draftCandles = timeframeCandles(draftTimeframe, { importedTimelineCandles: currentImportedTimelineCandles, candlesByTimeframe });
      stageWorkingContextsRef.current.set(
        persistedDraft.decisionId,
        restorePersistedWorkingGraph(
          { ...persistedDraft, timeframe: draftTimeframe },
          nextDocument.decisions,
          currentExecutions,
          draftCandles,
        ),
      );
    }

    let activeGraph = globalGraph;
    let activeDecisionId = nextDocument.working.selectedDecisionId;
    const persistedContext = nextDocument.working.editingContext;
    if (persistedContext?.mode === "decision" && nextDocument.decisions.some((decision) => decision.id === persistedContext.decisionId)) {
      const stageTimeframe = timeframeAvailability[persistedContext.timeframe].enabled
        ? persistedContext.timeframe
        : nextTimeframe;
      const stageCandles = timeframeCandles(stageTimeframe, { importedTimelineCandles: currentImportedTimelineCandles, candlesByTimeframe });
      activeGraph = restorePersistedWorkingGraph(
        { ...persistedContext, timeframe: stageTimeframe },
        nextDocument.decisions,
        currentExecutions,
        stageCandles,
      );
      stageWorkingContextsRef.current.set(persistedContext.decisionId, activeGraph);
      activeContextModeRef.current = "decision";
      activeDecisionId = persistedContext.decisionId;
    } else {
      activeContextModeRef.current = "global";
      if (persistedContext?.mode === "global") activeDecisionId = "global";
    }

    const restoredPhase = nextDocument.working.phase ?? "holding";
    setPhase(restoredPhase);
    // Early drafts did not persist the active phase at the top level, while
    // timeframe edits still recorded its graph under phaseContexts. Treat the
    // default holding phase as the persisted owner so its market boundary is
    // restored on reopen instead of rebuilding from the execution cursor.
    const phaseContext = nextDocument.working.phaseContexts?.[restoredPhase];
    if (phaseContext) {
      activeGraph = restorePersistedWorkingGraph(phaseContext, nextDocument.decisions, currentExecutions, timeframeCandles(phaseContext.timeframe, { importedTimelineCandles: currentImportedTimelineCandles, candlesByTimeframe }));
      activeContextModeRef.current = phaseContext.mode;
      activeDecisionId = phaseContext.decisionId;
      if (restoredPhase === "post-review") activeGraph.replay = revealRecallHistory(timeframeCandles(activeGraph.timeframe, { importedTimelineCandles: currentImportedTimelineCandles, candlesByTimeframe }), currentExecutions);
    }
    setTimeframe(activeGraph.timeframe);
    setSelectedDecisionId(activeDecisionId);
    const nextHistory = createDrawingHistory(activeGraph.drawings);
    drawingHistoryRef.current = nextHistory;
    setDrawingHistory(nextHistory);
    setReplay(activeGraph.replay);
    if (emitRevealRequest) requestReveal(marketRevealCursor(activeGraph.replay));
    if (activeGraph.viewport) {
      queuedViewportRestoreRef.current = activeGraph.viewport;
      restoreQueuedViewport();
    }
  }, [candlesByTimeframe, currentExecutions, fallbackTimeframe, requestReveal, restoreQueuedViewport, timeframeAvailability]);

  const loadEpisode = useCallback(async (episodeToLoad: TradeEpisode, cancelled: () => boolean, refreshCurrentEpisode = false) => {
    const currentDraft = refreshCurrentEpisode && draftRef.current?.episodeId === episodeToLoad.id
      ? draftRef.current
      : null;
    if (currentDraft) {
      // Market hydration changes the restoration inputs without changing the
      // selected episode. Keep its mounted controls and newest local edits;
      // a storage reread here can replace a draft whose save is still queued.
      const reconciliation = reconcileRecallDocument(currentDraft, episodeToLoad);
      setLoading(false);
      draftRef.current = reconciliation.document;
      setDocument(reconciliation.document);
      if (reconciliation.addedExecutionIds.length || reconciliation.removedExecutionIds.length) markDirty();
      setHistoryMode(false);
      historyReplayBackupRef.current = null;
      setEditingSnapshotId(null);
      setSnapshotCandles(null);
      setSelectedDecisionIds([]);
      restoreWorkingFromDocument(reconciliation.document, undefined, false);
      return;
    }
    setLoading(true);
    setSaving(false);
    setPhaseResolutionNotice(null);
    setError(null);
    try {
      const loaded = await repository.load(episodeToLoad.id);
      if (cancelled()) return;
      let nextDocument = loaded ?? createRecallDocument(episodeToLoad);
      if (!loaded) {
        const cursor = new Date(Date.parse(episodeToLoad.executions[0]?.executedAt ?? episodeToLoad.startedAt) - 1).toISOString();
        nextDocument = { ...nextDocument, working: { ...nextDocument.working, phase: "pre-entry", hasSeenFuture: false,
          cursor, executionCursor: NO_REVEALED_EXECUTIONS,
        } };
      }
      let reconciledDraft = false;
      if (loaded) {
        const reconciliation = reconcileRecallDocument(nextDocument, episodeToLoad);
        nextDocument = reconciliation.document;
        reconciledDraft = reconciliation.addedExecutionIds.length > 0 || reconciliation.removedExecutionIds.length > 0;
      } else if (initialDrawings.length > 0) {
        nextDocument = {
          ...nextDocument,
          working: {
            ...nextDocument.working,
            drawings: cloneDrawings(initialDrawings),
          },
        };
      }
      if (cancelled()) return;
      // A repository reload is an explicit discard boundary for field-level
      // overlays. Market-data hydration takes the currentDraft branch above
      // and intentionally keeps those overlays/local inputs intact.
      setPlanEdits({});
      acceptedQueuedSavesRef.current.delete(nextDocument.episodeId);
      setDocument(nextDocument);
      setFormalBaseline(nextDocument.status === "completed"
        ? (nextDocument.lastCompleted ?? nextDocument)
        : null);
      latestSavedDocumentRef.current = nextDocument;
      latestSavedGenerationRef.current = -1;
      const migratedDraft = (!loaded && initialDrawings.length > 0) || reconciledDraft;
      dirtyRef.current = migratedDraft;
      setDirty(migratedDraft);
      if (migratedDraft) draftGenerationRef.current += 1;
      setConflict(false);
      setHistoryMode(false);
      historyReplayBackupRef.current = null;
      setEditingSnapshotId(null);
      setSnapshotCandles(null);
      setSelectedDecisionIds([]);
      restoreWorkingFromDocument(nextDocument);
    } catch (loadError) {
      if (cancelled()) return;
      setError(loadError instanceof Error ? loadError.message : "无法读取复盘草稿");
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, [initialDrawings, markDirty, repository, restoreWorkingFromDocument]);

  const saveNow = useCallback(async (
    documentToSave?: RecallDocument,
    force = false,
    generation = draftGenerationRef.current,
  ) => {
    const candidate = documentToSave ?? draftRef.current;
    if (!candidate || (!dirtyRef.current && !force)) return;
    const requestGeneration = generation;
    const saveTask = saveQueueRef.current.then(async () => {
      // A debounce callback may outlive the render that scheduled it. If a
      // newer draft is already available, let its own callback carry the
      // matching document/revision pair instead of sending this stale CAS.
      const isCurrentEpisode = () => episodeRef.current.id === candidate.episodeId;
      if (!force && isCurrentEpisode() && requestGeneration !== draftGenerationRef.current) return;
      const accepted = acceptedQueuedSavesRef.current.get(candidate.episodeId);
      if (!force && accepted?.generation === requestGeneration && accepted.document.revision >= candidate.revision) return;
      const queuedCandidate = accepted && accepted.document.revision > candidate.revision
        ? reconcileRecallSaveResponse(candidate, accepted.document, 0, 1).document
        : candidate;
      if (isCurrentEpisode()) setSaving(true);
      try {
        const saved = await repository.save(queuedCandidate, { expectedRevision: queuedCandidate.revision });
        acceptedQueuedSavesRef.current.set(saved.episodeId, { document: saved, generation: requestGeneration });
        onSaved?.(saved);
        if (!isCurrentEpisode()) return;
        latestSavedDocumentRef.current = saved;
        latestSavedGenerationRef.current = requestGeneration;
        // Leave guards and the next queued task run before React necessarily
        // flushes the state updater, so acknowledge this generation now.
        dirtyRef.current = requestGeneration !== draftGenerationRef.current;
        setDocument((current) => {
          if (!current || current.episodeId !== saved.episodeId) return current;
          const reconciled = reconcileRecallSaveResponse(
            current,
            saved,
            requestGeneration,
            draftGenerationRef.current,
          );
          dirtyRef.current = reconciled.dirty;
          setDirty(reconciled.dirty);
          draftRef.current = reconciled.document;
          return reconciled.document;
        });
        setConflict(false);
        setError(null);
      } catch (saveError) {
        if (!isCurrentEpisode()) return;
        if (isConflict(saveError)) {
          setConflict(true);
          setError("云端草稿已有新版本；当前编辑仍保留，请重新载入或手动合并。");
        } else {
          setError(saveError instanceof Error ? saveError.message : "复盘草稿保存失败");
        }
      } finally {
        if (isCurrentEpisode()) setSaving(false);
      }
    });
    saveQueueRef.current = saveTask.then(() => undefined, () => undefined);
    await saveTask;
  }, [onSaved, repository]);

  useEffect(() => {
    saveDocumentRef.current = saveNow;
  }, [saveNow]);

  const leaveGuard = useCallback(async () => {
    if (!dirtyRef.current) return true;
    await saveNow();
    return !dirtyRef.current;
  }, [saveNow]);

  useEffect(() => {
    onLeaveGuardChange?.(leaveGuard);
    return () => onLeaveGuardChange?.(null);
  }, [leaveGuard, onLeaveGuardChange]);

  useEffect(() => {
    let cancelled = false;
    const previousEpisodeId = previousEpisodeIdRef.current;
    if (previousEpisodeId && previousEpisodeId !== episode.id) {
      void saveDocumentRef.current?.();
    }
    previousEpisodeIdRef.current = episode.id;
    // Loading a selected episode is an external synchronization boundary.
    void loadEpisode(episodeRef.current, () => cancelled, previousEpisodeId === episode.id);
    return () => {
      cancelled = true;
      if (dirtyRef.current) void saveDocumentRef.current?.();
    };
  }, [episode.id, loadEpisode, repository]);

  useEffect(() => {
    if (!document || !dirty) return;
    const documentAtSchedule = document;
    const generationAtSchedule = draftGenerationRef.current;
    const timer = window.setTimeout(() => {
      void saveNow(documentAtSchedule, false, generationAtSchedule);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [document, dirty, saveNow]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) void saveDocumentRef.current?.();
    };
  }, []);

  useEffect(() => {
    const guardExternalLeave = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
      void saveDocumentRef.current?.();
    };
    window.addEventListener("beforeunload", guardExternalLeave);
    return () => window.removeEventListener("beforeunload", guardExternalLeave);
  }, []);

  const applyCommand = useCallback((command: DrawingCommand) => {
    const stamped = stampRecallDrawingCommand(
      command,
      drawingHistory.present,
      snapshotEdit?.decisionId ?? selectedDecisionId,
      snapshotEdit?.phase ?? phase,
      document?.working.hasSeenFuture === true,
    );
    const nextHistory = applyDrawingCommand(drawingHistory, stamped);
    commitDrawingHistory(nextHistory);
  }, [commitDrawingHistory, document?.working.hasSeenFuture, drawingHistory, phase, selectedDecisionId, snapshotEdit?.decisionId, snapshotEdit?.phase]);

  const selectDecision = useCallback((decisionId: string | "global", options: DecisionSelectionOptions = {}) => {
    if (!document) return;
    const currentReplay = replay;
    setPlaying(false);
    if (options.boundaryExecutionId && historyMode) {
      setHistoryMode(false);
      historyReplayBackupRef.current = null;
    }
    if (document.working.phase && phase !== "holding" && replay) {
      const leaving = persistedEditingContext(selectedDecisionId && selectedDecisionId !== "global" ? "decision" : "global", selectedDecisionId ?? "global", { drawings: drawingHistoryRef.current.present, replay, timeframe, viewport: chartHandleRef.current?.getViewport() });
      setPhase("holding");
      setDocument(current => current ? { ...current, working: { ...current.working, phase: "holding", phaseContexts: { ...current.working.phaseContexts, [phase]: leaving } } } : current);
    }
    let leavingStageContext: RecallWorkingContext | undefined;
    if (activeContextModeRef.current === "global" && replay) {
      globalWorkingContextRef.current = {
        drawings: cloneDrawings(drawingHistoryRef.current.present),
        replay,
        timeframe,
        viewport: chartHandleRef.current?.getViewport() ?? globalWorkingContextRef.current?.viewport,
      };
    } else if (activeContextModeRef.current === "decision" && selectedDecisionId && selectedDecisionId !== "global" && replay) {
      const graph: WorkingGraph = {
        drawings: cloneDrawings(drawingHistoryRef.current.present),
        replay,
        timeframe,
      };
      stageWorkingContextsRef.current.set(selectedDecisionId, graph);
      leavingStageContext = persistedEditingContext("decision", selectedDecisionId, graph);
    }
    setSelectedDecisionId(decisionId);
    setSelectedDecisionIds((ids) => ids.includes(decisionId) ? ids : [...ids, decisionId]);
    if (decisionId === "global") {
      activeContextModeRef.current = "global";
      const global = globalWorkingContextRef.current;
      if (!global) return;
      const globalHistory = createDrawingHistory(global.drawings);
      drawingHistoryRef.current = globalHistory;
      setDrawingHistory(globalHistory);
      setTimeframe(global.timeframe);
      setReplay(global.replay);
      requestReveal(marketRevealCursor(global.replay));
      if (global.viewport) {
        window.requestAnimationFrame(() => chartHandleRef.current?.restoreViewport(global.viewport!));
      }
      setDocument((current) => current ? touchRecallDraft({
        ...current,
        updatedAt: nowIso(),
        working: {
          ...current.working,
          drawings: cloneDrawings(global.drawings),
          timeframe: global.timeframe,
          cursor: global.replay.cursor,
          executionCursor: global.replay.executionCursor,
          selectedDecisionId: "global",
          editingContext: undefined,
          hasSeenFuture: current.working.hasSeenFuture === true
            || Boolean(currentReplay && replayStateIsLater(global.replay, currentReplay, currentExecutions)),
          ...(leavingStageContext
            ? { decisionDrafts: upsertDecisionDraft(current.working.decisionDrafts, leavingStageContext) }
            : {}),
        },
      }) : current);
      markDirty();
      return;
    }
    const decision = document.decisions.find((item) => item.id === decisionId);
    if (!decision) return;
    activeContextModeRef.current = "decision";
    const persistedStage = decisionDraftFor(document.working.decisionDrafts, decisionId);
    const boundarySnapshot = document.snapshots.filter((snapshot) => snapshot.decisionId === decisionId).at(-1);
    const nextTimeframe = stageWorkingContextsRef.current.get(decisionId)?.timeframe
      ?? (persistedStage && timeframeAvailability[persistedStage.timeframe].enabled ? persistedStage.timeframe : undefined)
      ?? (boundarySnapshot && timeframeAvailability[boundarySnapshot.timeframe].enabled ? boundarySnapshot.timeframe : timeframe);
    const nextCandles = timeframeCandles(nextTimeframe, { importedTimelineCandles, candlesByTimeframe });
    const persistedStageGraph = persistedStage
      ? restorePersistedWorkingGraph({ ...persistedStage, timeframe: nextTimeframe }, document.decisions, currentExecutions, nextCandles)
      : undefined;
    const savedStage = stageWorkingContextsRef.current.get(decisionId) ?? persistedStageGraph;
    const boundaryExecution = options.boundaryExecutionId
      ? currentExecutions.find((execution) => execution.id === options.boundaryExecutionId && decision.executionIds.includes(execution.id))
      : undefined;
    const next = boundaryExecution
      ? revealRecallExecutionBoundary(boundaryExecution, currentExecutions, nextCandles)
      : savedStage?.replay ?? revealRecallDecision({
        candles: nextCandles,
        executions: currentExecutions,
        decisions: document.decisions,
        decisionId,
      });
    const boundaryDrawings = savedStage?.drawings ?? drawingsAtDecisionBoundary(document, decisionId);
    const stageGraph: WorkingGraph = {
      drawings: cloneDrawings(boundaryDrawings),
      replay: boundaryExecution ? next : savedStage?.replay ?? mapCursorToTimeframe(next, currentExecutions, nextCandles),
      timeframe: nextTimeframe,
    };
    stageWorkingContextsRef.current.set(decisionId, stageGraph);
    const stageHistory = createDrawingHistory(stageGraph.drawings);
    drawingHistoryRef.current = stageHistory;
    setDrawingHistory(stageHistory);
    setTimeframe(nextTimeframe);
    setReplay(stageGraph.replay);
    requestReveal(marketRevealCursor(stageGraph.replay));
    const context = persistedEditingContext("decision", decisionId, stageGraph);
    setDocument((current) => current ? touchRecallDraft({
      ...current,
      updatedAt: nowIso(),
      working: {
        ...current.working,
        selectedDecisionId: decisionId,
        editingContext: context,
        decisionDrafts: upsertDecisionDraft(current.working.decisionDrafts, context),
        hasSeenFuture: current.working.hasSeenFuture === true
          || Boolean(currentReplay && replayStateIsLater(stageGraph.replay, currentReplay, currentExecutions)),
      },
    }) : current);
    markDirty();
  }, [candlesByTimeframe, currentExecutions, document, historyMode, importedTimelineCandles, markDirty, phase, replay, requestReveal, selectedDecisionId, timeframe, timeframeAvailability]);

  const handleExecutionSelect = useCallback((executionId: string) => {
    if (editingSnapshotId) return;
    if (!document || !chartExecutions.some((execution) => execution.id === executionId)) return;
    const decisionId = decisionForExecution(document, executionId);
    if (!decisionId) return;
    setPlaying(false);
    selectDecision(decisionId, { boundaryExecutionId: executionId });
  }, [chartExecutions, document, editingSnapshotId, selectDecision]);

  const switchPhase = useCallback(async (nextPhase: RecallPhase) => {
    if (!document || !replay || editingSnapshotId || nextPhase === phase) return;
    setPlaying(false);
    await chartHandleRef.current?.flush();
    const context = persistedEditingContext(selectedDecisionId && selectedDecisionId !== "global" ? "decision" : "global", selectedDecisionId ?? "global", {
      drawings: drawingHistoryRef.current.present, replay, timeframe, viewport: chartHandleRef.current?.getViewport(),
    });
    const saved = document.working.phaseContexts?.[nextPhase];
    const nextTimeframe = saved?.timeframe ?? timeframe;
    const candles = timeframeCandles(nextTimeframe, { importedTimelineCandles, candlesByTimeframe });
    let graph = saved ? restorePersistedWorkingGraph(saved, document.decisions, currentExecutions, candles) : {
      drawings: cloneDrawings(drawingHistoryRef.current.present), replay, timeframe: nextTimeframe,
    };
    if (nextPhase === "post-review") graph = { ...graph, replay: revealRecallHistory(candles, currentExecutions) };
    else if (!saved && nextPhase === "pre-entry") {
      const cursor = new Date(Date.parse(currentExecutions[0]?.executedAt ?? episode.startedAt) - 1).toISOString();
      const known = revealableCandlesThroughCursor(candles, cursor);
      graph = { ...graph, replay: { cursor, executionCursor: NO_REVEALED_EXECUTIONS, mode: "replay", revealedCandleCursor: known.at(-1) ? candleKnowledgeAt(known.at(-1)!) : null, revealedCandles: known, revealedExecutions: [], currentCandle: known.at(-1) } };
    } else if (!saved && nextPhase === "holding") {
      graph = { ...graph, replay: revealRecallDecision({ candles, executions: currentExecutions, decisions: document.decisions, decisionId: document.decisions[0]?.id ?? "" }) };
    }
    const nextOwner = saved?.decisionId ?? selectedDecisionId ?? document.decisions[0]?.id ?? "global";
    activeContextModeRef.current = nextOwner === "global" ? "global" : "decision";
    const history = createDrawingHistory(graph.drawings);
    drawingHistoryRef.current = history;
    setDrawingHistory(history);
    setTimeframe(graph.timeframe);
    setReplay(graph.replay);
    requestReveal(marketRevealCursor(graph.replay));
    setSelectedDecisionId(nextOwner);
    setPhase(nextPhase);
    setHistoryMode(false);
    phaseViewportContextTransitionRef.current = {
      phase: nextPhase,
      timeframe: graph.timeframe,
      cursor: graph.replay.cursor,
    };
    setDocument(current => current ? { ...current, working: { ...current.working, phase: nextPhase,
      hasSeenFuture: current.working.hasSeenFuture === true
        || nextPhase === "post-review"
        // Entering holding/post-review reveals the target graph. Returning to
        // pre-entry preserves that later exposure even when the current graph
        // is exactly at the first decision boundary.
        || (nextPhase === "pre-entry"
          ? replayStateIsLater(replay, graph.replay, currentExecutions)
          : replayStateIsLater(graph.replay, replay, currentExecutions)),
      phaseContexts: { ...current.working.phaseContexts, [phase]: context, [nextPhase]: persistedEditingContext(activeContextModeRef.current, nextOwner, graph) },
    } } : current);
    if (saved?.viewport && graph.viewport) {
      // Wait for the chart's new revealed-candle set and reveal request to
      // commit before restoring the phase-owned window. A direct rAF here can
      // race the chart's setData path and leave the early phase at a two-bar
      // nearest-time mapping.
      const generation = ++phaseViewportRestoreGenerationRef.current;
      phaseViewportRestoreRef.current = {
        generation,
        phase: nextPhase,
        timeframe: graph.timeframe,
        cursor: graph.replay.cursor,
        viewport: graph.viewport,
      };
      setPhaseViewportRestoreToken(generation);
    }
    markDirty();
  }, [candlesByTimeframe, currentExecutions, document, editingSnapshotId, episode.startedAt, importedTimelineCandles, markDirty, phase, replay, requestReveal, selectedDecisionId, timeframe]);

  // Keep the active phase's resumable graph alongside the existing global and
  // decision drafts. Snapshots remain independent immutable captures.
  useEffect(() => {
    if (!replay || loading || editingSnapshotId || historyMode) return;
    const transition = phaseViewportContextTransitionRef.current;
    const isPhaseTransition = transition?.phase === phase
      && transition.timeframe === timeframe
      && transition.cursor === replay.cursor;
    const phaseViewport = phaseViewportRestoreRef.current?.phase === phase
      && phaseViewportRestoreRef.current.timeframe === timeframe
      && phaseViewportRestoreRef.current.cursor === replay.cursor
      ? phaseViewportRestoreRef.current.viewport
      : undefined;
    // Keep a persisted restore in the phase draft until the async chart has
    // applied it. Reading the chart here can otherwise capture its temporary
    // full-history fit and overwrite the saved window during reload.
    const viewport = phaseViewport ?? (isPhaseTransition
      ? undefined
      : queuedViewportRestoreRef.current ?? chartHandleRef.current?.getViewport());
    const context = persistedEditingContext(selectedDecisionId && selectedDecisionId !== "global" ? "decision" : "global", selectedDecisionId ?? "global", {
      drawings: drawingHistory.present,
      replay,
      timeframe,
      ...(viewport ? { viewport } : {}),
    });
    if (isPhaseTransition) phaseViewportContextTransitionRef.current = null;
    setDocument(current => !current || !current.working.phase ? current : { ...current, working: { ...current.working,
      phaseContexts: { ...current.working.phaseContexts, [phase]: context },
    } });
  }, [drawingHistory.present, editingSnapshotId, historyMode, loading, phase, replay, selectedDecisionId, timeframe]);

  useEffect(() => {
    const request = phaseViewportRestoreRef.current;
    if (!request || editingSnapshotId) return;
    const frame = window.requestAnimationFrame(() => {
      const current = phaseViewportRestoreRef.current;
      if (!current
        || current.generation !== request.generation
        || current.generation !== phaseViewportRestoreGenerationRef.current
        || current.phase !== phase
        || current.timeframe !== timeframe
        || current.cursor !== replay?.cursor) {
        if (current?.generation === request.generation) phaseViewportRestoreRef.current = null;
        return;
      }
      const handle = chartHandleRef.current;
      if (!handle) return;
      phaseViewportRestoreRef.current = null;
      handle.restoreViewport(current.viewport);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingSnapshotId, phase, phaseViewportRestoreToken, replay?.cursor, timeframe]);

  const nextDecision = useCallback(() => {
    if (!document || !replay || editingSnapshotId || historyMode || phase === "post-review") return;
    if (phase === "pre-entry") {
      const firstDecision = firstDecisionInExecutionOrder(document, currentExecutions);
      if (!firstDecision) {
        setPhaseResolutionNotice("当前回合没有可定位的成交决策；请先补齐行情或从已有阶段入口回看。");
        return;
      }
      const preEntryContext = persistedEditingContext(
        selectedDecisionId && selectedDecisionId !== "global" ? "decision" : "global",
        selectedDecisionId ?? "global",
        { drawings: drawingHistoryRef.current.present, replay, timeframe, viewport: chartHandleRef.current?.getViewport() },
      );
      const next = revealRecallDecision({
        candles: allCandles,
        executions: currentExecutions,
        decisions: document.decisions,
        decisionId: firstDecision.id,
      });
      activeContextModeRef.current = "decision";
      setPhase("holding");
      setSelectedDecisionId(firstDecision.id);
      setDocument(current => current ? touchRecallDraft({
        ...current,
        working: {
          ...current.working,
          phase: "holding",
          hasSeenFuture: true,
          phaseContexts: { ...current.working.phaseContexts, "pre-entry": preEntryContext },
        },
      }) : current);
      setWorking(next, firstDecision.id);
      return;
    }
    const next = nextRecallDecisionState({
      candles: allCandles,
      executions: currentExecutions,
      decisions: document.decisions,
      current: replay,
    });
    const nextDecisionId = decisionForExecution(document, next.executionCursor) ?? selectedDecisionId;
    // “下一笔” changes the record object as well as the replay boundary. Keep
    // the global graph in its own ref, while the inherited graph is persisted
    // as the newly selected decision's working context for reload/navigation.
    if (!editingSnapshotId && nextDecisionId && nextDecisionId !== "global") activeContextModeRef.current = "decision";
    setSelectedDecisionId(nextDecisionId ?? null);
    setWorking(next, nextDecisionId ?? null);
  }, [allCandles, currentExecutions, document, editingSnapshotId, historyMode, phase, replay, selectedDecisionId, setWorking, timeframe]);

  const nextBar = useCallback(() => {
    if (!replay || editingSnapshotId || historyMode || phase === "post-review" || replay.revealedCandles.length >= allCandles.length) return;
    const next = revealRecallBar({ candles: allCandles, executions: currentExecutions, current: replay });
    if (phase === "pre-entry" && next.revealedExecutions.length > 0) {
      const context = persistedEditingContext(selectedDecisionId && selectedDecisionId !== "global" ? "decision" : "global", selectedDecisionId ?? "global", {
        drawings: drawingHistoryRef.current.present, replay, timeframe, viewport: chartHandleRef.current?.getViewport(),
      });
      setPhase("holding");
      setDocument(current => current ? { ...current, working: { ...current.working, phase: "holding", hasSeenFuture: true, phaseContexts: { ...current.working.phaseContexts, "pre-entry": context } } } : current);
    }
    setWorking(next);
    if (next.revealedCandles.length >= allCandles.length) setPlaying(false);
  }, [allCandles, currentExecutions, editingSnapshotId, historyMode, phase, replay, selectedDecisionId, setWorking, timeframe]);

  useEffect(() => {
    if (!playing || historyMode || editingSnapshotId || phase === "post-review" || !replay) return;
    const timer = window.setInterval(() => {
      if (replay.revealedCandles.length >= allCandles.length) {
        setPlaying(false);
        return;
      }
      nextBar();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [allCandles.length, editingSnapshotId, historyMode, nextBar, phase, playing, replay]);

  const handleWorkspaceKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (event.nativeEvent.isComposing || event.keyCode === 229 || target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
    if (historyMode || editingSnapshotId || !replay) return;
    if (phase === "post-review" && event.key.toLowerCase() !== "t") return;
    if (event.key === " " && replay.revealedCandles.length >= allCandles.length) return;
    if (event.key.toLowerCase() === "t") {
      event.preventDefault();
      setPlaying(false);
      setActiveTool("text");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      nextBar();
    } else if (event.key.toLowerCase() === "j") {
      event.preventDefault();
      const previous = previousRecallDecisionState({ candles: allCandles, executions: currentExecutions, decisions: document?.decisions ?? [], current: replay });
      setSelectedDecisionId(decisionForExecution(document!, previous.executionCursor) ?? selectedDecisionId);
      setWorking(previous, decisionForExecution(document!, previous.executionCursor) ?? selectedDecisionId);
    } else if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      nextDecision();
    } else if (event.key === " ") {
      event.preventDefault();
      setPlaying((current) => !current);
    }
  }, [allCandles, currentExecutions, document, editingSnapshotId, historyMode, nextBar, nextDecision, phase, replay, selectedDecisionId, setWorking]);

  const toggleHistory = useCallback(() => {
    if (!replay || editingSnapshotId) return;
    setPlaying(false);
    if (historyMode) {
      const selected = historyReplayBackupRef.current ?? replay;
      setHistoryMode(false);
      setReplay(selected);
      requestReveal(marketRevealCursor(selected));
      historyReplayBackupRef.current = null;
      return;
    }
    setDocument(current => current ? { ...current, working: { ...current.working, hasSeenFuture: true } } : current);
    markDirty();
    historyReplayBackupRef.current = replay;
    setHistoryMode(true);
    const history = revealRecallHistory(allCandles, currentExecutions);
    setReplay(history);
    requestReveal(marketRevealCursor(history));
  }, [allCandles, currentExecutions, editingSnapshotId, historyMode, markDirty, replay, requestReveal]);

  const changeTimeframe = useCallback((nextTimeframe: Timeframe) => {
    if (!timeframeAvailability[nextTimeframe].enabled || !document || !replay) return;
    const nextCandles = timeframeCandles(nextTimeframe, { importedTimelineCandles, candlesByTimeframe });
    const mapped = mapCursorToTimeframe(replay, currentExecutions, nextCandles);
    setTimeframe(nextTimeframe);
    setReplay(mapped);
    requestReveal(marketRevealCursor(mapped));
    onTimeframeChange?.(nextTimeframe);
    if (!historyMode && !editingSnapshotId) {
      const stageDecisionId = activeContextModeRef.current === "decision" && selectedDecisionId && selectedDecisionId !== "global"
        ? selectedDecisionId
        : null;
      const graph: WorkingGraph = {
        drawings: cloneDrawings(drawingHistoryRef.current.present),
        replay: mapped,
        timeframe: nextTimeframe,
        viewport: activeContextModeRef.current === "global"
          ? chartHandleRef.current?.getViewport() ?? globalWorkingContextRef.current?.viewport
          : undefined,
      };
      if (stageDecisionId) {
        stageWorkingContextsRef.current.set(stageDecisionId, graph);
        const context = persistedEditingContext("decision", stageDecisionId, graph);
        setDocument((current) => current ? touchRecallDraft({
          ...current,
          updatedAt: nowIso(),
          working: {
            ...current.working,
            selectedDecisionId: stageDecisionId,
            editingContext: context,
            decisionDrafts: upsertDecisionDraft(current.working.decisionDrafts, context),
            phaseContexts: { ...current.working.phaseContexts, [phase]: context },
          },
        }) : current);
      } else {
        globalWorkingContextRef.current = graph;
        setDocument((current) => current ? touchRecallDraft({
          ...current,
          updatedAt: nowIso(),
          working: {
            ...current.working,
            timeframe: nextTimeframe,
            cursor: mapped.cursor,
            executionCursor: mapped.executionCursor,
            drawings: cloneDrawings(drawingHistoryRef.current.present),
            editingContext: undefined,
            phaseContexts: { ...current.working.phaseContexts, [phase]: persistedEditingContext("global", "global", graph) },
          },
        }) : current);
      }
      markDirty();
    } else if (editingSnapshotId) {
      setSnapshotEditDirty(true);
    }
  }, [candlesByTimeframe, currentExecutions, document, editingSnapshotId, historyMode, importedTimelineCandles, markDirty, onTimeframeChange, phase, replay, requestReveal, selectedDecisionId, timeframeAvailability]);

  const capture = useCallback(async () => {
    if (Object.values(planEdits).some(edit => edit.error)) throw new Error("请先修正计划输入；当前输入已保留，尚未留存。");
    if (revisionInputError || evaluationInputError || manualEvaluationInputError || !manualEvaluationValid) {
      throw new Error(`请先修正结构化记录：${revisionInputError ?? evaluationInputError ?? manualEvaluationInputError ?? "人工标签尚未通过校验"}；输入已保留，尚未留存。`);
    }
    const chartHandle = chartHandleRef.current;
    if (!chartHandle) throw new Error("图表尚未完成渲染，无法留存截图");
    // The chart synchronously commits focused Text before returning its
    // promise. Record the revision after that barrier, then refuse to bind
    // its frozen PNG to any edits made while rendering/fonts are pending.
    const pendingCapture = chartHandle.capture();
    const capturedGeneration = draftGenerationRef.current;
    const capturedDrawings = drawingHistoryRef.current.present;
    const capturedEpisodeId = episodeRef.current.id;
    const captureResult = await pendingCapture;
    if (capturedGeneration !== draftGenerationRef.current || capturedDrawings !== drawingHistoryRef.current.present || capturedEpisodeId !== episodeRef.current.id) {
      throw new Error("截图期间内容已修改，未留存或完成，请重试。");
    }
    if (!captureResult.imageDataUrl.startsWith("data:image/")) throw new Error("图表截图无效，未创建快照");
    return captureResult;
  }, [evaluationInputError, manualEvaluationInputError, manualEvaluationValid, planEdits, revisionInputError]);

  const confirmCaptureWarnings = useCallback((warnings?: string[]) => {
    if (!warnings || warnings.length === 0) return true;
    const message = `${warnings.join("；")}。仍按当前视野留存吗？`;
    return typeof window !== "undefined" && window.confirm(message);
  }, []);

  const retain = useCallback(async () => {
    if (!document || !replay || !selectedDecisionId) return;
    if (selectedDecisionId !== "global" && unmatchedDecisionIds.has(selectedDecisionId)) {
      setError("当前决策没有对应行情，补齐行情后才能留存对应快照。");
      return;
    }
    try {
      const captureResult = await capture();
      if (!confirmCaptureWarnings(captureResult.warnings)) {
        setError("截图文字可能被裁切；已取消留存，请调整视野后重试。");
        return;
      }
      const nextSnapshot = { ...createSnapshot(undefined, selectedDecisionId, timeframe, replay, drawingHistoryRef.current.present, chartCandles, captureResult), phase, hasSeenFuture: document.working.hasSeenFuture === true };
      setDocument((current) => current ? touchRecallDraft(freezeRecallSnapshotBundle(retainRecallSnapshot(current, nextSnapshot), nextSnapshot.id, { bundleId: `bundle-${crypto.randomUUID()}`, retainedAt: nowIso(), episode })) : current);
      markDirty();
      setError(null);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "图表截图失败，未创建快照");
    }
  }, [capture, chartCandles, confirmCaptureWarnings, document, episode, markDirty, phase, replay, selectedDecisionId, timeframe, unmatchedDecisionIds]);

  const editSnapshot = useCallback((snapshot: RecallSnapshot) => {
    if (!replay || !document) return;
    snapshotEditBackupRef.current = {
      drawings: cloneDrawings(drawingHistory.present),
      replay,
      selectedDecisionId,
      timeframe,
      viewport: chartHandleRef.current?.getViewport(),
    };
    // A snapshot may have been captured from explicit retrospective mode. Its
    // stored candles are still useful for the image, but reopening it as an
    // editable step replay must respect the live knowledge boundary.
    const snapshotUsesOwnBoundary = Boolean(snapshot.phase || replay.mode === "history");
    const snapshotKnowledgeCursor = snapshotUsesOwnBoundary ? snapshot.cursor : replay.cursor;
    const liveMarketCursor = marketRevealCursor(replay);
    const snapshotCandles = snapshot.phase || replay.mode === "history"
      ? snapshot.candles
      : liveMarketCursor ? revealableCandlesThroughCursor(snapshot.candles, liveMarketCursor) : [];
    const snapshotExecutionCursor = snapshotUsesOwnBoundary
      ? snapshot.executionCursor
      : replay.executionCursor;
    setPlaying(false);
    const currentKnowledge = replay.revealedCandles.at(-1);
    const exposesLaterCandles = snapshotCandles.some((candle) => !currentKnowledge || Date.parse(candleKnowledgeAt(candle)) > Date.parse(candleKnowledgeAt(currentKnowledge)));
    const exposesLaterExecutions = executionBoundaryForCursor(currentExecutions, snapshotExecutionCursor) > executionBoundaryForCursor(currentExecutions, replay.executionCursor);
    if (snapshot.hasSeenFuture || snapshot.phase === "post-review" || exposesLaterCandles || exposesLaterExecutions) {
      setDocument(current => current ? { ...current, working: { ...current.working, hasSeenFuture: true } } : current);
      markDirty();
    }
    setEditingSnapshotId(snapshot.id);
    setSnapshotEditDirty(false);
    setSnapshotCandles(snapshotCandles.map((candle) => ({ ...candle, tradingDates: candle.tradingDates ? [...candle.tradingDates] : undefined })));
    setTimeframe(snapshot.timeframe);
    setSelectedDecisionId(snapshot.decisionId === "global" ? "global" : snapshot.decisionId);
    const snapshotHistory = createDrawingHistory(snapshot.drawings);
    drawingHistoryRef.current = snapshotHistory;
    setDrawingHistory(snapshotHistory);
    const snapshotReplay: RecallReplayCursor = {
      cursor: snapshotKnowledgeCursor,
      executionCursor: snapshotExecutionCursor,
      mode: "replay",
      revealedCandleCursor: snapshotCandles.at(-1) ? candleKnowledgeAt(snapshotCandles.at(-1)!) : null,
      revealedCandles: snapshotCandles,
      revealedExecutions: visibleRecallExecutions(currentExecutions, snapshotExecutionCursor, snapshotKnowledgeCursor),
      currentCandle: snapshotCandles.at(-1),
    };
    setReplay(snapshotReplay);
    requestReveal(marketRevealCursor(snapshotReplay));
    setError(null);
  }, [currentExecutions, document, drawingHistory.present, markDirty, replay, requestReveal, selectedDecisionId, timeframe]);

  useEffect(() => {
    const viewport = snapshotEdit?.viewport;
    if (!editingSnapshotId || !viewport) return;
    const restore = () => chartHandleRef.current?.restoreViewport(viewport as unknown as ChartViewport);
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [editingSnapshotId, snapshotEdit?.viewport]);

  const leaveSnapshotEditNow = useCallback(() => {
    const backup = snapshotEditBackupRef.current;
    if (backup) {
      pendingViewportRestoreRef.current = backup.viewport ?? null;
      const workingHistory = createDrawingHistory(backup.drawings);
      drawingHistoryRef.current = workingHistory;
      setDrawingHistory(workingHistory);
      setReplay(backup.replay);
      requestReveal(marketRevealCursor(backup.replay));
      setSelectedDecisionId(backup.selectedDecisionId);
      setTimeframe(backup.timeframe);
    }
    snapshotEditBackupRef.current = null;
    setEditingSnapshotId(null);
    setSnapshotEditDirty(false);
    setSnapshotCandles(null);
  }, [requestReveal]);

  useEffect(() => {
    if (editingSnapshotId || !pendingViewportRestoreRef.current) return;
    const viewport = pendingViewportRestoreRef.current;
    const frame = window.requestAnimationFrame(() => {
      const handle = chartHandleRef.current;
      if (!handle) return;
      pendingViewportRestoreRef.current = null;
      handle.restoreViewport(viewport);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingSnapshotId]);

  const updateSnapshot = useCallback(async () => {
    if (!document || !snapshotEdit || !replay) return;
    try {
      const captureResult = await capture();
      if (!confirmCaptureWarnings(captureResult.warnings)) {
        setError("截图文字可能被裁切；已取消更新，请调整视野后重试。");
        return;
      }
      const nextSnapshot = { ...createSnapshot(snapshotEdit, snapshotEdit.decisionId, timeframe, replay, drawingHistoryRef.current.present, chartCandles, captureResult), phase: snapshotEdit.phase, hasSeenFuture: snapshotEdit.hasSeenFuture === true || document.working.hasSeenFuture === true };
      setDocument((current) => current ? touchRecallDraft(freezeRecallSnapshotBundle(updateRecallSnapshot(current, nextSnapshot), nextSnapshot.id, { bundleId: `bundle-${crypto.randomUUID()}`, retainedAt: nowIso(), episode, sourceBundleId: snapshotEdit.retainedBundleId ?? null })) : current);
      markDirty();
      leaveSnapshotEditNow();
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "图表截图失败，未更新快照");
    }
  }, [capture, chartCandles, confirmCaptureWarnings, document, episode, leaveSnapshotEditNow, markDirty, replay, snapshotEdit, timeframe]);

  const leaveSnapshotEdit = useCallback(() => {
    if (snapshotEditDirty) {
      const update = typeof window !== "undefined" && window.confirm("当前快照有未提交编辑。确定更新快照吗？取消将保留旧快照并返回工作图。");
      if (update) {
        void updateSnapshot();
        return;
      }
    }
    leaveSnapshotEditNow();
  }, [leaveSnapshotEditNow, snapshotEditDirty, updateSnapshot]);

  const removeSnapshot = useCallback((snapshot: RecallSnapshot) => {
    if (!document) return;
    deletedSnapshotRef.current = snapshot;
    const remainingOwnerSnapshots = document.snapshots.filter(
      (candidate) => candidate.id !== snapshot.id && candidate.decisionId === snapshot.decisionId,
    );
    const deletedLastFormalSnapshot = document.status === "completed" && remainingOwnerSnapshots.length === 0;
    const next = deleteRecallSnapshot(document, snapshot.id);
    setDocument(deletedLastFormalSnapshot ? markRecallNeedsConfirmation(next) : touchRecallDraft(next));
    markDirty();
    setDeletedNotice(true);
    if (editingSnapshotId === snapshot.id) leaveSnapshotEditNow();
  }, [document, editingSnapshotId, leaveSnapshotEditNow, markDirty]);

  const undoDeleteSnapshot = useCallback(() => {
    if (!document || !deletedSnapshotRef.current) return;
    setDocument(touchRecallDraft(retainRecallSnapshot(document, deletedSnapshotRef.current)));
    markDirty();
    deletedSnapshotRef.current = null;
    setDeletedNotice(false);
  }, [document, markDirty]);

  const reorder = useCallback((orderedIds: string[]) => {
    if (!document) return;
    setDocument(touchRecallDraft(reorderRecallSnapshots(document, orderedIds)));
    markDirty();
  }, [document, markDirty]);

  const persistExportOrder = useCallback((order: RecallExportOrder, source: RecallExportSource) => {
    // The formal version is immutable history. The dialog supplies its source
    // so a preview reorder never writes completed snapshot ids into the draft.
    if (source !== "draft" || !document) return;
    const snapshotIds = document.snapshots.map((snapshot) => snapshot.id);
    if (order.snapshotIds.length !== snapshotIds.length || order.snapshotIds.some((id) => !snapshotIds.includes(id))) return;
    const reordered = reorderRecallSnapshots(document, order.snapshotIds);
    const snapshots = reordered.snapshots.map((snapshot) =>
      reorderSnapshotTextDrawings(snapshot, order.textIdsBySnapshot?.[snapshot.id]),
    );
    setDocument(touchRecallDraft({ ...reordered, snapshots, updatedAt: nowIso() }));
    markDirty();
  }, [document, markDirty]);

  const onSnapshotDrop = useCallback((event: DragEvent<HTMLLIElement>, targetId: string) => {
    const sourceId = event.dataTransfer.getData("text/recall-snapshot");
    if (!sourceId || !document || sourceId === targetId) return;
    const ids = document.snapshots.map((snapshot) => snapshot.id);
    const sourceIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, sourceId);
    reorder(ids);
  }, [document, reorder]);

  const merge = useCallback(() => {
    if (!document || selectedDecisionIds.length < 2) return;
    try {
      setDocument(touchRecallDraft(mergeRecallDecisions(document, selectedDecisionIds)));
      setSelectedDecisionIds([]);
      markDirty();
      setError(null);
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : "合并决策失败");
    }
  }, [document, markDirty, selectedDecisionIds]);

  const openSplit = useCallback(() => {
    if (!document || !currentDecision || currentDecision.executionIds.length < 2) return;
    setSplitDrafts([
      {
        id: currentDecision.id,
        executionIds: currentDecision.executionIds.join(", "),
        snapshotIds: document.snapshots.filter((snapshot) => snapshot.decisionId === currentDecision.id).map((snapshot) => snapshot.id),
      },
      { id: "", executionIds: "", snapshotIds: [] },
    ]);
  }, [currentDecision, document]);

  const applySplit = useCallback(() => {
    if (!document || !currentDecision || !splitDrafts) return;
    try {
      const groups: RecallSplitGroup[] = splitDrafts.map((draft, index) => ({
        id: index === 0 ? currentDecision.id : draft.id.trim(),
        executionIds: draft.executionIds.split(",").map((id) => id.trim()).filter(Boolean),
        snapshotIds: draft.snapshotIds,
      }));
      setDocument(touchRecallDraft(splitRecallDecision(document, currentDecision.id, groups)));
      markDirty();
      setSplitDrafts(null);
      setError(null);
    } catch (splitError) {
      setError(splitError instanceof Error ? splitError.message : "拆分决策失败");
    }
  }, [currentDecision, document, markDirty, splitDrafts]);

  const reassignReconciliationSnapshot = useCallback((snapshot: RecallSnapshot, decisionId: string) => {
    if (!document || !decisionId || !document.decisions.some((decision) => decision.id === decisionId && decision.executionIds.length > 0)) return;
    try {
      setDocument(touchRecallDraft(updateRecallSnapshot(document, { ...snapshot, decisionId })));
      markDirty();
      setError(null);
    } catch (reassignError) {
      setError(reassignError instanceof Error ? reassignError.message : "快照归属更新失败");
    }
  }, [document, markDirty]);

  const reassignPhaseContext = useCallback((phaseToResolve: RecallPhase, decisionId: string) => {
    if (!document || !decisionId) return;
    try {
      const next = resolveRecallPhaseContext(document, phaseToResolve, decisionId);
      setPhaseResolutionNotice(`阶段图文已保留到${decisionId === "global" ? "全局总结" : `决策 ${document.decisions.findIndex(decision => decision.id === decisionId) + 1}`}，原图文内容与观察边界保持不变。`);
      setDocument(next);
      // If the reassigned graph is active, update its live identity too so
      // the next ordinary edit cannot write the orphan reference back.
      if (phaseToResolve === phase && document.working.phase === phase) restoreWorkingFromDocument(next);
      markDirty();
      setError(null);
    } catch (reassignError) {
      setError(reassignError instanceof Error ? reassignError.message : "阶段草稿归属更新失败");
    }
  }, [document, markDirty, phase, restoreWorkingFromDocument]);

  const resolveReconciliation = useCallback(() => {
    if (!document?.reconciliation?.stale) return;
    try {
      const resolved = resolveRecallReconciliation(document, {
        addedExecutionIds: document.reconciliation.addedExecutionIds,
        removedExecutionIds: document.reconciliation.removedExecutionIds,
        decisionIdsToRemove: reconciliationOrphans.map((decision) => decision.id),
      });
      const nextDocument = touchRecallDraft(resolved);
      setDocument(nextDocument);
      restoreWorkingFromDocument(nextDocument);
      markDirty();
      setError(null);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "行情变更尚未处理完成");
    }
  }, [document, markDirty, reconciliationOrphans, restoreWorkingFromDocument]);

  const complete = useCallback(async () => {
    if (!document || !replay) return;
    if (historyMode) {
      setError("请先返回逐步回放，再保存并完成回合复盘；完整历史仅用于事后查看。");
      return;
    }
    if (editingSnapshotId) {
      setError("请先返回工作图，再捕获全局总结。");
      return;
    }
    if (episode.status !== "closed") {
      setError("交易回合尚未清仓，暂不能保存并完成。");
      return;
    }
    if (document.reconciliation?.stale || (document.reconciliation?.removedExecutionIds.length ?? 0) > 0) {
      setError("请先处理上方行情变更，再完成回合复盘。");
      return;
    }
    if (missing.length > 0) {
      setError(`仍缺少决策快照：${missing.join("、")}`);
      return;
    }
    if (document.snapshots.some((snapshot) => snapshot.decisionId === "unassigned")) {
      setError("拆分后的快照仍有未归属项，请先选择所属决策。");
      return;
    }
    const isCurrentEpisode = () => episodeRef.current.id === episode.id;
    try {
      // Reserve the queue before capture: a debounce can fire while the chart
      // flushes its editor or renders, and must not race finalization's CAS.
      const completionTask = saveQueueRef.current.then(async () => {
        if (!isCurrentEpisode()) return;
        const generationAtStart = draftGenerationRef.current;
        const baseDocument = latestSavedDocumentRef.current?.episodeId === episode.id && latestSavedGenerationRef.current === draftGenerationRef.current
          ? latestSavedDocumentRef.current
          : draftRef.current?.episodeId === episode.id
            ? draftRef.current
            : document;
        // A focused Text editor can still belong to the selected decision
        // overlay. Commit it once in that context, then switch the chart to the
        // preserved global graph before taking the actual global image. The
        // first image is deliberately discarded and can never be mislabeled as
        // the global snapshot.
        const completionDecisionId = activeContextModeRef.current === "decision"
          && selectedDecisionId
          && selectedDecisionId !== "global"
          ? selectedDecisionId
          : null;
        let completionDocument = baseDocument;
        // The global graph is the owner of the final summary. It is normally
        // initialized during restore, but keep completion safe if a load or
        // context switch has not populated the ref yet: derive a global graph
        // from the current draft and rebuild its replay boundary below.
        let globalGraph = globalWorkingContextRef.current ?? {
          drawings: cloneDrawings(baseDocument.working.drawings),
          replay,
          timeframe: baseDocument.working.timeframe,
        };
        // A decision capture may commit its focused Text synchronously. The
        // generation after that capture is the completion barrier; edits made
        // while switching to the global chart must reject the formal save so
        // the image and structured evidence cannot come from different drafts.
        let completionGeneration = draftGenerationRef.current;
        if (completionDecisionId) {
          await capture();
          if (!isCurrentEpisode()) return;
          completionGeneration = draftGenerationRef.current;
          const stageGraph: WorkingGraph = {
            drawings: cloneDrawings(drawingHistoryRef.current.present),
            replay,
            timeframe,
          };
          const stageContext = persistedEditingContext("decision", completionDecisionId, stageGraph);
          completionDocument = {
            ...baseDocument,
            working: {
              ...baseDocument.working,
              selectedDecisionId: completionDecisionId,
              editingContext: stageContext,
              decisionDrafts: upsertDecisionDraft(baseDocument.working.decisionDrafts, stageContext),
            },
          };
          stageWorkingContextsRef.current.set(completionDecisionId, stageGraph);
        }
        if (globalGraph) {
          // The final global summary is a post-review artifact regardless of
          // which working graph the user was editing. Rebuild its replay
          // boundary from the global timeframe so an older global graph can
          // never hide later executions or candles.
          const globalCandles = timeframeCandles(globalGraph.timeframe, { importedTimelineCandles, candlesByTimeframe });
          const currentViewport = timeframe === globalGraph.timeframe
            ? chartHandleRef.current?.getViewport()
            : undefined;
          const globalLastCandleIndex = globalCandles.length - 1;
          const logicalRange = currentViewport?.logicalRange;
          const keepsLatestCandleVisible = Boolean(
            logicalRange == null
              || (logicalRange.from <= globalLastCandleIndex && logicalRange.to >= globalLastCandleIndex),
          );
          globalGraph = {
            ...globalGraph,
            replay: revealRecallHistory(globalCandles, currentExecutions),
            viewport: keepsLatestCandleVisible ? currentViewport : undefined,
          };
          globalWorkingContextRef.current = globalGraph;
          activeContextModeRef.current = "global";
          const globalHistory = createDrawingHistory(globalGraph.drawings);
          drawingHistoryRef.current = globalHistory;
          const globalDocument: RecallDocument = {
            ...completionDocument,
            working: {
              ...completionDocument.working,
              phase: "post-review",
              phaseContexts: {
                ...completionDocument.working.phaseContexts,
                "post-review": persistedEditingContext("global", "global", globalGraph),
              },
              drawings: cloneDrawings(globalGraph.drawings),
              timeframe: globalGraph.timeframe,
              cursor: globalGraph.replay.cursor,
              executionCursor: globalGraph.replay.executionCursor,
              selectedDecisionId: "global",
              editingContext: undefined,
              hasSeenFuture: true,
            },
          };
          completionDocument = globalDocument;
          // Switching the chart's context must not discard sidebar edits made
          // while its first capture was pending. The formal candidate remains
          // the original base; only the live working graph changes here.
          const currentDraft = draftRef.current;
          const liveGlobalDocument: RecallDocument = generationAtStart !== draftGenerationRef.current && currentDraft?.episodeId === episode.id
            ? {
                ...currentDraft,
                working: {
                  ...currentDraft.working,
                  phase: "post-review",
                  phaseContexts: {
                    ...currentDraft.working.phaseContexts,
                    "post-review": persistedEditingContext("global", "global", globalGraph),
                  },
                  drawings: globalDocument.working.drawings,
                  timeframe: globalDocument.working.timeframe,
                  cursor: globalDocument.working.cursor,
                  executionCursor: globalDocument.working.executionCursor,
                  selectedDecisionId: "global",
                  editingContext: undefined,
                  hasSeenFuture: true,
                },
              }
            : globalDocument;
          draftRef.current = liveGlobalDocument;
          flushSync(() => {
            setDrawingHistory(globalHistory);
            setSelectedDecisionId("global");
            setTimeframe(globalGraph!.timeframe);
            setReplay(globalGraph!.replay);
            setDocument(liveGlobalDocument);
          });
          if (globalGraph.viewport) {
            pendingViewportRestoreRef.current = globalGraph.viewport;
            chartHandleRef.current?.restoreViewport(globalGraph.viewport);
          }
          else {
            // A different period has no safe logical-range mapping. Clear any
            // older pending restore before fitting the newly revealed data.
            pendingViewportRestoreRef.current = null;
          }
          await chartHandleRef.current?.flush();
          if (!globalGraph.viewport) {
            chartHandleRef.current?.fitAll();
          }
          if (!isCurrentEpisode()) return;
          globalGraph = globalWorkingContextRef.current ?? globalGraph;
        }
        if (draftGenerationRef.current !== completionGeneration) {
          throw new Error("截图期间内容已修改，未留存或完成，请重试。");
        }
        const captureContext = globalGraph;
        const captureTimeframe = captureContext?.timeframe ?? timeframe;
        const captureReplay = captureContext?.replay ?? replay;
        const captureCandles = captureContext?.replay.revealedCandles ?? chartCandles;
        const captureResult = await capture();
        if (!isCurrentEpisode()) return;
        if (!confirmCaptureWarnings(captureResult.warnings)) {
          setError("截图文字可能被裁切；已取消完成，请调整视野后重试。");
          return;
        }
        // ReplayChart may commit a focused Text editor while capture is in
        // flight. Read the synchronously updated drawing ref and carry that
        // same working graph into both the global snapshot and final payload.
        const capturedGraph: WorkingGraph = {
          drawings: cloneDrawings(drawingHistoryRef.current.present),
          replay: captureReplay,
          timeframe: captureTimeframe,
          // The chart capture is the authoritative post-flush viewport. This
          // keeps retained metadata aligned with the pixels after fitAll and
          // avoids carrying a logical range across timeframe changes.
          viewport: captureResult.viewport,
        };
        globalWorkingContextRef.current = capturedGraph;
        const capturedWorkingDocument: RecallDocument = {
          ...completionDocument,
          working: {
            ...completionDocument.working,
            phase: "post-review",
            phaseContexts: {
              ...completionDocument.working.phaseContexts,
              "post-review": persistedEditingContext("global", "global", capturedGraph),
            },
            drawings: capturedGraph.drawings,
            timeframe: capturedGraph.timeframe,
            cursor: capturedGraph.replay.cursor,
            executionCursor: capturedGraph.replay.executionCursor,
            selectedDecisionId: "global",
            editingContext: undefined,
            hasSeenFuture: true,
          },
        };
        const globalSnapshot = createSnapshot(
          capturedWorkingDocument.snapshots.find((snapshot) => snapshot.decisionId === "global"),
          "global",
          captureTimeframe,
          captureReplay,
          capturedGraph.drawings,
          captureCandles,
          captureResult,
        );
        globalSnapshot.phase = "post-review";
        globalSnapshot.priceBasis = "raw";
        globalSnapshot.hasSeenFuture = true;
        const withGlobal = capturedWorkingDocument.snapshots.some((snapshot) => snapshot.decisionId === "global")
          ? updateRecallSnapshot(capturedWorkingDocument, globalSnapshot)
          : retainRecallSnapshot(capturedWorkingDocument, globalSnapshot);
        const completed = completeRecallDocument(freezeRecallSnapshotBundle(withGlobal, globalSnapshot.id, { bundleId: `bundle-${crypto.randomUUID()}`, retainedAt: nowIso(), episode }), episode);
        const changedInitialPlan = draftRef.current?.plans?.drafts.some(draft => {
          if (draft.kind !== "initial" || baseDocument.plans?.versions.some(version => version.planId === draft.planId && version.kind === "initial")) return false;
          const frozen = completed.plans?.versions.find(version => version.planId === draft.planId && version.kind === "initial");
          return frozen && JSON.stringify(frozen.input) !== JSON.stringify(draft.input);
        });
        if (changedInitialPlan) {
          setError("截图期间计划已修改，未完成保存，请重试。");
          return;
        }
        setSaving(true);
        const freezesInitialPlan = completed.plans?.versions.some(version => version.kind === "initial"
          && !baseDocument.plans?.versions.some(previous => previous.planId === version.planId && previous.kind === "initial"));
        if (freezesInitialPlan) {
          initialPlanFreezeEpisodeRef.current = episode.id;
          setInitialPlanFreezeEpisode(episode.id);
        }
        let saved: RecallDocument;
        try {
          saved = await repository.save(completed, { expectedRevision: completionDocument.revision, finalize: true });
        } finally {
          if (freezesInitialPlan && initialPlanFreezeEpisodeRef.current === episode.id) {
            initialPlanFreezeEpisodeRef.current = null;
            setInitialPlanFreezeEpisode(null);
          }
        }
        acceptedQueuedSavesRef.current.set(saved.episodeId, { document: saved, generation: generationAtStart });
        onSaved?.(saved);
        onFormalCompletion?.(saved);
        if (!isCurrentEpisode()) return;
        // Keep the in-flight editor usable while capture/finalization is
        // pending. Once the server accepts the formal candidate, the local
        // phase follows the persisted post-review working state as well.
        setPhase(saved.working.phase ?? "post-review");
        latestSavedDocumentRef.current = saved;
        latestSavedGenerationRef.current = generationAtStart;
        dirtyRef.current = generationAtStart !== draftGenerationRef.current;
        setFormalBaseline(saved.lastCompleted ?? saved);
        setDocument((current) => {
          if (!current || current.episodeId !== saved.episodeId) return current;
          const reconciled = reconcileRecallSaveResponse(
            current,
            saved,
            generationAtStart,
            draftGenerationRef.current,
          );
          dirtyRef.current = reconciled.dirty;
          setDirty(reconciled.dirty);
          draftRef.current = reconciled.document;
          return reconciled.document;
        });
        setConflict(false);
        setError(null);
      });
      saveQueueRef.current = completionTask.then(() => undefined, () => undefined);
      await completionTask;
    } catch (completeError) {
      if (!isCurrentEpisode()) return;
      if (isConflict(completeError)) setConflict(true);
      setError(completeError instanceof Error ? completeError.message : "完成回合保存失败");
    } finally {
      if (isCurrentEpisode()) setSaving(false);
    }
  }, [capture, candlesByTimeframe, chartCandles, confirmCaptureWarnings, currentExecutions, document, editingSnapshotId, episode, historyMode, importedTimelineCandles, missing, onFormalCompletion, onSaved, replay, repository, selectedDecisionId, timeframe]);

  const handleChartReady = useCallback((handle: RecallChartHandle | null) => {
    chartHandleRef.current = handle;
    if (!handle) return;
    if (activeContextModeRef.current === "global" && globalWorkingContextRef.current && !globalWorkingContextRef.current.viewport) {
      globalWorkingContextRef.current = { ...globalWorkingContextRef.current, viewport: handle.getViewport() };
    }
    restoreQueuedViewport();
  }, [restoreQueuedViewport]);

  if (loading) {
    return <section className="recall-workspace recall-loading" aria-busy="true"><ClipboardPenLine size={20} /><strong>正在读取复盘草稿…</strong></section>;
  }
  if (!document || !replay) {
    return <section className="recall-workspace recall-loading" role="alert"><CircleAlert size={20} /><strong>{error ?? "复盘草稿不可用"}</strong></section>;
  }

  const decisionSnapshots = document.snapshots.filter((snapshot) => snapshot.decisionId !== "global");
  const globalSnapshot = document.snapshots.find((snapshot) => snapshot.decisionId === "global");
  const revealedExecutionIds = new Set(chartExecutions.map((execution) => execution.id));
  const selectedExecutionCandidate = currentDecisionExecution(document, currentExecutions, selectedDecisionId);
  const selectedExecution = selectedExecutionCandidate && revealedExecutionIds.has(selectedExecutionCandidate.id)
    ? selectedExecutionCandidate
    : undefined;
  const decisionNumber = selectedDecisionId && selectedDecisionId !== "global"
    ? document.decisions.findIndex((decision) => decision.id === selectedDecisionId) + 1
    : 0;
  const selectedDetailsVisible = Boolean(
    selectedDecisionId === "global" ||
      historyMode ||
      (currentDecision?.executionIds.some((id) => revealedExecutionIds.has(id)) ?? false),
  );
  const selectedLabel = selectedDecisionId === "global"
    ? "全局总结"
    : currentDecision && selectedDetailsVisible
      ? currentDecision.executionIds
          .map((id) => currentExecutions.find((execution) => execution.id === id))
          .filter((execution): execution is TradeExecution => execution !== undefined && revealedExecutionIds.has(execution.id))
          .map(executionLabel)
          .join(" · ") || `决策 ${decisionNumber}`
      : currentDecision
        ? `决策 ${decisionNumber}`
        : "选择一笔成交";
  // Outcome labels are only knowable in explicit full-history/post-review
  // views. Holding may expose a first fill while later exits remain hidden.
  const blindEpisodeSelection = !historyMode && phase !== "post-review";
  const firstDecision = phase === "pre-entry" ? firstDecisionInExecutionOrder(document, currentExecutions) : undefined;
  const nextDecisionReplay = phase === "pre-entry" ? undefined : nextRecallDecisionState({
    candles: allCandles,
    executions: currentExecutions,
    decisions: document.decisions,
    current: replay,
  });
  const hasNextDecision = phase === "pre-entry"
    ? Boolean(firstDecision)
    : Boolean(nextDecisionReplay && (
        nextDecisionReplay.cursor !== replay.cursor ||
        nextDecisionReplay.executionCursor !== replay.executionCursor
      ));
  const atReplayEnd = replay.revealedCandles.length >= allCandles.length;
  const replayControlReason = historyMode
    ? "完整历史查看中；返回回放后才能继续揭示。"
    : editingSnapshotId
      ? "正在编辑快照；返回工作图后才能继续揭示。"
      : phase === "post-review"
        ? "事后复盘已揭示完整历史；可回到买入前判断保留计划、快照和后续补记。"
        : !hasNextDecision && atReplayEnd
          ? "已到当前行情与决策末尾；可回到买入前判断重新检查计划。"
          : !hasNextDecision
            ? "已到最后一笔决策；可回到买入前判断重新检查计划。"
            : "已到可用行情末尾；可回到买入前判断重新检查计划。";
  const showReplayControlReason = historyMode || Boolean(editingSnapshotId) || phase === "post-review" || atReplayEnd || !hasNextDecision;
  const canReturnToPreEntry = phase !== "pre-entry" && !editingSnapshotId && !historyMode && (phase === "post-review" || atReplayEnd || !hasNextDecision);
  const sidebarPhase: RecallPhase = editingSnapshotId
    ? viewedBundle?.captureContext.phase ?? viewedSnapshot?.phase ?? "holding"
    : phase;
  const compactReplayPlan = phase === "pre-entry" && planInput && (planInput.entry || planInput.initialStop || planInput.resolvedQuantity)
    ? (() => {
      const calculation = calculateRecallPlan(planInput);
      const risk = calculation.initialRisk.value
        ? `风险 ${calculation.initialRisk.value}${calculation.initialRisk.currency ? ` ${calculation.initialRisk.currency}` : ""}`
        : "风险待补充";
      return { risk, expectedR: calculation.expectedR.value };
    })()
    : null;
  const compactReplaySummary = phase === "holding"
    ? `持仓 ${quantityAvailable ? position.quantity : "待核对"}`
    : phase === "post-review"
      ? `历史已揭示 · 持仓 ${quantityAvailable ? position.quantity : "待核对"}`
      : (() => {
        if (!compactReplayPlan) return "计划待记录";
        const expectedR = compactReplayPlan.expectedR ? `${compactRecallDerivedNumber(compactReplayPlan.expectedR)}R` : "预期R待补充";
        return `计划 · ${expectedR} / ${compactReplayPlan.risk}`;
      })();
  const compactReplaySummaryTitle = compactReplayPlan?.expectedR
    ? `计划 · ${compactReplayPlan.expectedR}R / ${compactReplayPlan.risk}`
    : compactReplaySummary;
  const marketCutoff = marketRevealCursor(replay);
  const alignedMarketCutoff = marketCutoff ? formatMarketCursor(marketCutoff, instrument.market) : "尚无行情游标";
  const alignedMarketCutoffShort = marketCutoff ? formatMarketCursorShort(marketCutoff, instrument.market) : "尚无时间";
  const visibleExecution = replay.mode === "history"
    ? orderedRecallExecutions(currentExecutions).at(-1)
    : replay.revealedExecutions.at(-1);
  const visibleExecutionCutoff = visibleExecution ? recallExecutionKnowledgeAt(visibleExecution) : undefined;
  const executionCutoff = visibleExecutionCutoff ? formatMarketCursor(visibleExecutionCutoff, instrument.market) : "成交尚未揭示";
  const executionCutoffShort = visibleExecutionCutoff ? formatMarketCursorShort(visibleExecutionCutoff, instrument.market) : executionCutoff;

  return (
    <section ref={workspaceElementRef} className="recall-workspace trade-review-workspace--recall-frame" data-layout={focusMode ? "focus" : "standard"} aria-label="导入交易回忆复盘工作区" tabIndex={-1} onKeyDown={handleWorkspaceKeyDown} onFocusCapture={(event) => { if ((event.target as HTMLElement).matches("input, textarea, select, [contenteditable=true]")) setPlaying(false); }}>
      <header className="recall-header recall-frame-header">
        <div className="recall-heading">
          <span className="eyebrow">{tradeNature === "simulation" ? "TradingView · 模拟盘" : "导入交易 · 回忆复盘"}</span>
          <h1 title={`${instrument.name} · ${instrument.symbol}`}>{instrument.name} <small>{instrument.symbol}</small></h1>
          <span className="recall-status" data-status={document.status}>
            {document.status === "completed" ? "已完成" : document.status === "needs-confirmation" ? "待重新确认" : "草稿"}
            {(dirty || hasFormalDraft) && " · 有草稿修改"}
          </span>
        </div>
          <ChartToolbar
            timeframe={timeframe}
            timeframeAvailability={timeframeAvailability}
            onTimeframeChange={changeTimeframe}
            instruments={instruments}
            onSelectInstrument={onInstrumentChange}
            dataDetails={dataDetails}
            onRefreshMarketData={onRefreshMarketData}
            refreshDisabledReason={undefined}
            layersOpen={layersOpen}
            layersDisabledReason={visibleDrawings.length === 0 ? "当前没有可见绘图" : undefined}
            onToggleLayers={() => setLayersOpen((open) => !open)}
            fullscreen={{ supported: false, isFullscreen: false, error: null, toggleFullscreen: async () => undefined } as ComponentProps<typeof ChartToolbar>["fullscreen"]}
            settings={settings}
            onSettingsChange={onSettingsChange}
            symbol={instrument.symbol}
            instrumentName={instrument.name}
            market={instrument.market}
          />
        <nav className="recall-phases recall-frame-actions" aria-label="复盘阶段">
          {([["pre-entry", "买入前判断"], ["holding", "持仓过程"], ["post-review", "事后复盘"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={(snapshotEdit?.phase ?? phase) === value} disabled={Boolean(editingSnapshotId)} onClick={() => void switchPhase(value)}>{label}</button>)}
        </nav>
        <div className="recall-header-controls recall-frame-more">
          <label>
            <span>标的</span>
            <select aria-label="复盘标的" value={instrument.id} onChange={(event) => onInstrumentChange(event.target.value)}>
              {instruments.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.symbol}</option>)}
            </select>
          </label>
          <label>
            <span>交易回合</span>
            <select aria-label="交易回合" value={episode.id} onChange={(event) => onEpisodeChange(event.target.value)}>
              {episodes.map((item, index) => <option key={item.id} value={item.id}>{blindEpisodeSelection ? `第 ${episodes.length - index} 次` : `第 ${episodes.length - index} 次 · ${item.status === "closed" ? "已平仓" : "持仓中"}`}</option>)}
            </select>
          </label>
          {<button type="button" className="recall-icon-button" title={focusMode ? "切换到标准布局" : "切换到专注布局"} aria-label={focusMode ? "展开复盘导航，切换到标准布局" : "收起复盘导航，切换到专注布局"} onClick={() => { setLeftNavOpen(!navOpen); if (focused) onFocusedChange?.(false); }}>
            {navOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>}
          <button type="button" className="recall-icon-button" aria-label="统计" aria-pressed={statsOpen} onClick={() => setStatsOpen((open) => !open)}><BarChart3 size={17} /></button>
          <button type="button" className="recall-export-button" title="导出已留存内容" onClick={() => onExport ? onExport(document) : setExportOpen(true)}><Download size={15} />导出</button>
          {headerActions}
        </div>
      </header>

      {tradeNature === "simulation" && (
        <div className="tradingview-replay-notice" data-testid="tradingview-replay-notice">
          <strong>模拟盘回放</strong>
          <span>成交日期按 TradingView 导出记录保留；游标回放只显示当前时点已知的行情与成交。</span>
          {simulationRunId && (
            <details className="tradingview-run-provenance">
              <summary>运行标识</summary>
              <code>{simulationRunId}</code>
            </details>
          )}
        </div>
      )}

      {visibleSourceReport && tradeNature === "simulation" && (
        <div className="tradingview-source-report" data-testid="tradingview-source-report">
          <div>
            <span>TradingView 报告净盈亏</span>
            <strong className={Number(visibleSourceReport.netPnl) >= 0 ? "positive" : "negative"}>
              {money(visibleSourceReport.netPnl, instrument.currency)}
            </strong>
          </div>
          <div>
            <span>报告收益率</span>
            <strong>{visibleSourceReport.returnPercent}%</strong>
          </div>
          <div>
            <span>持仓 K 线</span>
            <strong>{visibleSourceReport.durationBars}</strong>
          </div>
          <small>报告字段仅作来源对照，不并入本地成交账本的计算。</small>
        </div>
      )}

      {error && <div className="recall-alert" role="alert"><CircleAlert size={16} /><span>{error}</span><button type="button" aria-label="关闭提示" onClick={() => setError(null)}><X size={14} /></button></div>}
      {conflict && <div className="recall-conflict" role="status"><CircleAlert size={15} /><span>检测到其他窗口更新；当前草稿已保留。</span><button type="button" onClick={() => { setConflict(false); void loadEpisode(episode, () => false); }}>重新载入</button></div>}
      {phaseResolutionNotice && <div className="recall-phase-provenance" role="status">{phaseResolutionNotice}</div>}
      {document.reconciliation?.stale && (
        <section className="recall-reconciliation" aria-label="行情变更处理" role="status">
          <div className="recall-reconciliation-heading"><strong>导入行情已有变更</strong><span>请明确确认新增/移除成交，避免旧快照悄悄完成。</span></div>
          <div className="recall-reconciliation-facts">
            {document.reconciliation.addedExecutionIds.length > 0 && <span>新增 {document.reconciliation.addedExecutionIds.length} 笔成交</span>}
            {document.reconciliation.removedExecutionIds.length > 0 && <span>移除 {document.reconciliation.removedExecutionIds.length} 笔成交</span>}
          </div>
          {reconciliationOrphans.length > 0 && <div className="recall-reconciliation-orphans">
            {reconciliationOrphans.flatMap((decision) => document.snapshots.filter((snapshot) => snapshot.decisionId === decision.id).map((snapshot) => (
              <label key={snapshot.id}>
                <span>快照 {snapshot.id.slice(-6)} 原决策已无成交</span>
                <select aria-label={`重新关联快照 ${snapshot.id}`} value="" onChange={(event) => reassignReconciliationSnapshot(snapshot, event.target.value)}>
                  <option value="">选择新决策</option>
                  {document.decisions.filter((candidate) => candidate.executionIds.length > 0).map((candidate) => <option key={candidate.id} value={candidate.id}>决策 {document.decisions.indexOf(candidate) + 1}</option>)}
                </select>
                <button type="button" onClick={() => removeSnapshot(snapshot)}>删除快照</button>
              </label>
            )))}
          </div>}
          <div className="recall-reconciliation-orphans">
            {Object.entries(document.working.phaseContexts ?? {}).filter(([, context]) => reconciliationOrphans.some(decision => decision.id === context?.decisionId)).map(([contextPhase, context]) => {
              const label = contextPhase === "pre-entry" ? "买入前判断" : contextPhase === "holding" ? "持仓过程" : "事后复盘";
              return <label key={contextPhase}><span>{label}草稿原决策已无成交 · 保留 {context?.drawings.length ?? 0} 个图文</span><select aria-label={`重新关联${label}草稿`} value="" onChange={event => reassignPhaseContext(contextPhase as RecallPhase, event.target.value)}><option value="">选择草稿新归属</option><option value="global">全局总结</option>{document.decisions.filter(decision => decision.executionIds.length > 0).map((decision) => <option key={decision.id} value={decision.id}>决策 {document.decisions.indexOf(decision) + 1}</option>)}</select></label>;
            })}
          </div>
          <button type="button" className="recall-reconciliation-confirm" disabled={reconciliationOrphans.some((decision) => document.snapshots.some((snapshot) => snapshot.decisionId === decision.id) || Object.values(document.working.phaseContexts ?? {}).some(context => context?.decisionId === decision.id))} onClick={resolveReconciliation}>确认已处理行情变更</button>
        </section>
      )}

      <div className={`recall-layout${navOpen ? "" : " nav-collapsed"}`}>
        {navOpen && (
          <aside className={`recall-nav${mobileRecordsOpen ? " mobile-records-open" : ""}`} aria-label="回合与决策导航">
            <div className="recall-nav-title"><span>本回合记录</span><small>{document.decisions.length} 笔决策</small><button type="button" className="recall-nav-toggle" aria-expanded={mobileRecordsOpen} onClick={() => setMobileRecordsOpen((open) => !open)}>{mobileRecordsOpen ? "收起" : "展开"}</button></div>
            <button type="button" className={`recall-nav-item global${selectedDecisionId === "global" ? " selected" : ""}`} aria-current={selectedDecisionId === "global" ? "true" : undefined} onClick={() => selectDecision("global")}>
              <span className="recall-nav-icon"><ClipboardPenLine size={15} /></span><span><strong>全局总结</strong><small>{globalSnapshot ? "已有留存" : "尚未留存"}</small></span>
            </button>
            <div className="recall-nav-divider" />
            {document.decisions.map((decision, index) => {
              const decisionExecutions = decision.executionIds.map((id) => currentExecutions.find((execution) => execution.id === id)).filter(Boolean) as TradeExecution[];
              const snapshots = decisionSnapshots.filter((snapshot) => snapshot.decisionId === decision.id);
              const missingSnapshot = snapshots.length === 0;
              const unmatched = unmatchedDecisionIds.has(decision.id);
              const detailsVisible = historyMode || decisionExecutions.some((execution) => revealedExecutionIds.has(execution.id));
              const decisionTitle = detailsVisible
                ? decisionExecutions.filter((execution) => revealedExecutionIds.has(execution.id)).map(executionLabel).join(" · ") || `决策 ${index + 1}`
                : `决策 ${index + 1}`;
              return (
                <div className="recall-decision-wrap" key={decision.id}>
                  <label className="recall-decision-check"><input type="checkbox" checked={selectedDecisionIds.includes(decision.id)} onChange={() => setSelectedDecisionIds((ids) => ids.includes(decision.id) ? ids.filter((id) => id !== decision.id) : [...ids, decision.id])} aria-label={`选择决策 ${index + 1} 进行合并`} /></label>
                  <button type="button" className={`recall-nav-item${selectedDecisionId === decision.id ? " selected" : ""}`} aria-current={selectedDecisionId === decision.id ? "true" : undefined} onClick={() => selectDecision(decision.id)}>
                    <span className="recall-nav-index">{index + 1}</span>
                    <span><strong>{decisionTitle}</strong><small>{snapshots.length ? `${snapshots.length} 份快照` : "待留存快照"}{unmatched && detailsVisible ? " · 缺少行情" : ""}</small></span>
                    {missingSnapshot ? <CircleAlert size={14} className="negative" /> : <CircleCheck size={14} className="positive" />}
                  </button>
                </div>
              );
            })}
            {selectedDecisionIds.length >= 2 && <button type="button" className="recall-secondary-action" onClick={merge}>合并所选决策</button>}
            {currentDecision && currentDecision.executionIds.length > 1 && <button type="button" className="recall-secondary-action" onClick={openSplit}><Split size={14} />拆分当前决策</button>}
            {splitDrafts && currentDecision && (
              <div className="recall-split-editor" aria-label="拆分决策">
                <strong>明确分配成交</strong>
                {splitDrafts.map((draft, index) => (
                  <div className="recall-split-row" key={`${index}-${draft.id}`}>
                    <input aria-label={`第 ${index + 1} 组决策编号`} value={draft.id} disabled={index === 0} placeholder="新决策 ID" onChange={(event) => setSplitDrafts((groups) => groups?.map((group, groupIndex) => groupIndex === index ? { ...group, id: event.target.value } : group) ?? null)} />
                    <input aria-label={`第 ${index + 1} 组成交 ID`} value={draft.executionIds} placeholder="成交 ID，用逗号分隔" onChange={(event) => setSplitDrafts((groups) => groups?.map((group, groupIndex) => groupIndex === index ? { ...group, executionIds: event.target.value } : group) ?? null)} />
                    <select multiple aria-label={`第 ${index + 1} 组快照归属`} value={draft.snapshotIds} onChange={(event) => setSplitDrafts((groups) => groups?.map((group, groupIndex) => groupIndex === index ? { ...group, snapshotIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) } : group) ?? null)}>
                      {document.snapshots.filter((snapshot) => snapshot.decisionId === currentDecision.id || snapshot.decisionId === "unassigned").map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.timeframe} · {snapshot.id.slice(-6)}</option>)}
                    </select>
                  </div>
                ))}
                <div><button type="button" onClick={applySplit}>确认拆分</button><button type="button" onClick={() => setSplitDrafts(null)}>取消</button></div>
              </div>
            )}
            <div className="recall-nav-help">选中一笔成交会定位到其完整 K 线；文字归属跟随当前记录对象。</div>
          </aside>
        )}

        <div className="recall-main">

          <div className="recall-phase-provenance" role="status">{editingSnapshotId ? "正在编辑已留存快照" : phase === "pre-entry" ? "复盘补记 · 买入事实尚未揭示" : phase === "holding" ? "持仓过程 · 仅展示当前已知事实" : "事后复盘 · 完整历史已主动揭示"}{document.working.hasSeenFuture && " · 已看后续补记"}</div>
          {historyMode && <div className="recall-history-banner"><History size={15} />完整历史：当前回合成交全部显示；返回后恢复原回放边界。<button type="button" onClick={toggleHistory}>返回回放</button></div>}
          {unmatchedDecisionIds.size > 0 && <div className="recall-unmatched" role="status"><CircleAlert size={15} />有成交找不到对应 K 线；相关决策可编辑草稿，但不能留存冒充该时点的快照。</div>}

          <div className={`recall-chart-and-plan${planOpen ? " plan-open" : ""}`}><div className="recall-chart-shell">
            <DrawingToolbar compact activeTool={activeTool} canUndo={canUndo} canRedo={canRedo} allLocked={allLocked} onToolChange={(tool) => { setPlaying(false); setActiveTool(tool); }} onUndo={() => replay && commitDrawingHistory(undoDrawingAtCursor(drawingHistory, replay.cursor, timeframe))} onRedo={() => replay && commitDrawingHistory(redoDrawingAtCursor(drawingHistory, replay.cursor, timeframe))} onClear={() => commitDrawingHistory(applyDrawingCommand(drawingHistory, { type: "clear-unlocked" }))} onToggleLock={() => replay && commitDrawingHistory(setAllDrawingsLockedAtCursor(drawingHistory, replay.cursor, timeframe))} />
            <div className="recall-chart-column">
              <ReplayChartWithHandle
                episodeId={episode.id}
                viewportKey={`${episode.id}:${timeframe}:${editingSnapshotId ?? "working"}:${chartCandles[0]?.time ?? ""}:${chartCandles.at(-1)?.time ?? ""}`}
                candles={chartCandles}
                executions={chartExecutions}
                focusRange={{ start: episode.startedAt, end: episode.endedAt ?? replay.cursor }}
                cursor={replay.cursor}
                revealRequest={revealRequest}
                averageCost={pnlAvailable ? Number(position.averageCost) : 0}
                drawings={visibleDrawingsAtCursor(drawingHistory.present, replay.cursor, timeframe)}
                activeTool={activeTool}
                settings={pnlAvailable ? settings : { ...settings, showAverageCost: false }}
                selectedDrawingId={selectedDrawingId}
                planPriceLines={planPriceLines}
                planLinesEditable={chartPlanEditable}
                onPlanPriceChange={changePlanPrice}
                onPlanPriceSelect={selectPlanPrice}
                onPlanInteractionStart={() => setPlaying(false)}
                onExecutionSelect={handleExecutionSelect}
                plannedRiskAmount={undefined}
                currency={instrument.currency}
                onSelectDrawing={setSelectedDrawingId}
                onCommand={applyCommand}
                onReady={handleChartReady}
              />
              {layersOpen && (
                <div className="recall-drawing-layers" role="region" aria-label="绘图图层面板">
                  <div className="recall-drawing-layers__heading">
                    <strong>绘图图层</strong>
                    <button type="button" aria-label="关闭绘图图层" onClick={() => setLayersOpen(false)}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <DrawingLayersPanel drawings={visibleDrawings} onCommand={applyCommand} onSelectDrawing={setSelectedDrawingId} selectedDrawingId={selectedDrawingId} />
                </div>
              )}
            </div>
            <button type="button" className="recall-fit-all" onClick={() => chartHandleRef.current?.fitAll()} aria-label="适应全部">适应全部</button>
          </div>

          {
            <RecallPlanSidebar
              hidden={!planOpen}
              input={planInput}
              missingReason={snapshotPlanAmbiguous ? "此快照包含多个原计划，尚未明确所展示的计划；请按原决策查看对应留存。" : undefined}
              phase={sidebarPhase}
              readOnly={planReadOnly}
              compactReadOnly={sidebarPhase !== "pre-entry"}
              retained={Boolean(editingSnapshotId ? snapshotPlan : frozenPlan)}
              onChange={editPlan}
              onClose={closePlan}
              error={planEdit?.error}
              hasSeenFuture={document.working.hasSeenFuture}
              knownQuantity={quantityAvailable ? position.quantity : undefined}
              primaryContent={sidebarPhase === "pre-entry" ? undefined : <div className="recall-plan-primary-content">
                {editingSnapshotId
                  ? <RecallActualMetricsPanel metrics={actualMetrics} phase={sidebarPhase} retained />
                  : <RecallActualMetricsPanel metrics={actualMetrics} phase={sidebarPhase} compact />}
                {sidebarPhase === "post-review" && <RecallExitEvaluations
                  key={`evaluations:${episode.id}`}
                  document={viewedBundle ? { ...document, decisions: viewedBundle.decisions } : document}
                  episode={viewedBundle ? {
                    ...episode, ...viewedBundle.executionEvidence.payload.episode,
                    instrument: { ...episode.instrument, ...viewedBundle.executionEvidence.payload.episode.instrument },
                    executions: viewedBundle.executionEvidence.payload.executions.map(fill => ({
                      ...fill, accountLabel: episode.accountLabel, instrument: { ...episode.instrument, ...fill.instrument },
                    })),
                  } : episode}
                  phase={sidebarPhase}
                  knowledgeCutoff={{ cursor: replay.cursor, executionCursor: replay.executionCursor }}
                  hasSeenFuture={document.working.hasSeenFuture === true}
                  readOnly={Boolean(editingSnapshotId)}
                  evaluationRevisionIds={editingSnapshotId ? viewedBundle?.evaluationRevisionIds ?? [] : undefined}
                  onValidationChange={setEvaluationInputError}
                  onChangeDocument={next => { setDocument(touchRecallDraft(next)); markDirty(); }}
                />}
                {sidebarPhase === "post-review" && <RecallManualEvaluations
                  document={document}
                  episode={episode}
                  phase={sidebarPhase}
                  target={{ scope: "episode", decisionId: null, episodeId: episode.id }}
                  knowledgeCutoff={{ cursor: replay.cursor, executionCursor: replay.executionCursor }}
                  hasSeenFuture={document.working.hasSeenFuture === true}
                  readOnly={Boolean(editingSnapshotId)}
                  manualEvaluationRevisionIds={editingSnapshotId ? viewedBundle?.manualEvaluationRevisionIds ?? [] : undefined}
                  onValidityChange={setManualEvaluationValid}
                  onValidationChange={setManualEvaluationInputError}
                  onChangeDocument={next => { setDocument(touchRecallDraft(next)); markDirty(); }}
                />}
              </div>}
              secondaryContent={sidebarPhase === "pre-entry" ? undefined : <RecallPlanSecondaryDetails key={`plan-secondary:${sidebarPhase}`} summary={sidebarPhase === "post-review" ? "完整实际结果、计划与修订" : "计划修订与来源详情"}>
                {!editingSnapshotId && <RecallActualMetricsPanel metrics={actualMetrics} phase={sidebarPhase} retained={Boolean(editingSnapshotId)} />}
                <div hidden={Boolean(editingSnapshotId) || !document.plans?.versions.length}>
                  <RecallPlanRevisionSection
                    key={`revision:${episode.id}`}
                    document={document} episode={episode} phase={sidebarPhase}
                    knowledgeCutoff={{ cursor: replay.cursor, executionCursor: replay.executionCursor }}
                    hasSeenFuture={document.working.hasSeenFuture === true}
                    planId={revisionPlanId} onPlanIdChange={setSelectedRevisionPlanId}
                    onValidationChange={setRevisionInputError}
                    onChangeDocument={next => { setDocument(touchRecallDraft(next)); markDirty(); setRevisionDragError(null); }}
                  />
                </div>
                {revisionDragError && <p role="alert">{revisionDragError}；计划线已恢复，请通过输入框修正。</p>}
              </RecallPlanSecondaryDetails>}
            />
          }
          </div>

          <div className="recall-replay-bar">
            <div className="recall-position-strip recall-replay-bar__primary">
              <div><span className={`live-dot${historyMode ? "" : " playing"}`} /><strong title={selectedLabel}>{historyMode ? "事后复盘" : "逐步"} · {selectedDecisionId === "global" ? "全局" : currentDecision ? `决策 ${decisionNumber}` : "未选择"}</strong><small className="recall-replay-cutoff" aria-label={historyMode ? "完整历史" : `行情时间 ${alignedMarketCutoff}；${executionCutoff}`}>
                {historyMode ? <span>完整历史</span> : <><span title={alignedMarketCutoff}>行情时间 {alignedMarketCutoffShort}</span><span title={executionCutoff}>{visibleExecutionCutoff ? `成交截止 ${executionCutoffShort}` : executionCutoff}</span></>}
              </small></div>
              <span className="recall-replay-summary" aria-label={compactReplaySummaryTitle} title={compactReplaySummaryTitle}>{compactReplaySummary}</span>
            </div>

            <div className="recall-controls recall-replay-bar__primary" aria-label="回放控制">
              <button type="button" aria-label="上一根 K 线" disabled={phase === "post-review" || historyMode || Boolean(editingSnapshotId) || replay.revealedCandles.length === 0} title={editingSnapshotId ? replayControlReason : undefined} onClick={() => {
                setWorking(rewindRecallBar({ candles: allCandles, executions: currentExecutions, current: replay }));
              }}><ChevronLeft size={17} />上一根</button>
              <button type="button" className={playing ? "active" : ""} onClick={() => setPlaying((current) => !current)} disabled={phase === "post-review" || historyMode || Boolean(editingSnapshotId) || atReplayEnd} title={editingSnapshotId || atReplayEnd ? replayControlReason : undefined} aria-pressed={playing}>{playing ? "暂停" : "播放"}</button>
              <button type="button" onClick={nextBar} disabled={phase === "post-review" || historyMode || Boolean(editingSnapshotId) || atReplayEnd} title={editingSnapshotId || atReplayEnd ? replayControlReason : undefined}><ChevronDown size={17} />下一根 K 线</button>
              <button type="button" className="primary" onClick={nextDecision} disabled={phase === "post-review" || historyMode || Boolean(editingSnapshotId) || !hasNextDecision} title={editingSnapshotId || !hasNextDecision ? replayControlReason : undefined}><ChevronRight size={17} />下一笔决策</button>
              {editingSnapshotId ? <><button type="button" className="primary" onClick={() => void updateSnapshot()}><FileImage size={15} />更新此快照</button><button type="button" onClick={leaveSnapshotEdit}><X size={15} />返回工作图</button></> : <button type="button" className="primary" onClick={() => void retain()} disabled={!selectedDecisionId || historyMode}><Save size={15} />留存当前快照</button>}
              <button ref={planToggleRef} type="button" aria-expanded={planOpen} onClick={() => updateRecallPanelState({ type: "toggle-plan", contentWidth: recallPanelContentWidth() })}>计划侧栏</button>
            </div>

            <div className="recall-replay-more" data-open={moreOpen ? "true" : "false"} aria-label="更多记录与完成">
              <button
                type="button"
                className="recall-replay-more__summary"
                aria-expanded={moreOpen}
                aria-controls={`recall-replay-more-body-${episode.id}`}
                onClick={() => updateRecallPanelState({ type: "toggle-more", contentWidth: recallPanelContentWidth() })}
              >更多 / 记录</button>
              <div id={`recall-replay-more-body-${episode.id}`} className="recall-replay-more__body" hidden={!moreOpen}>
                <div className="recall-replay-bar__secondary" aria-label="更多回放与记录动作">
                  <button type="button" onClick={toggleHistory} className={historyMode ? "active" : ""} disabled={Boolean(editingSnapshotId)} title={editingSnapshotId ? replayControlReason : undefined}>{historyMode ? <Undo2 size={15} /> : <History size={15} />}{historyMode ? "返回回放" : "完整历史"}</button>
                  <button type="button" className="complete-button" onClick={() => void complete()} disabled={document.status === "completed" && !dirty && !hasFormalDraft}><Check size={15} />保存并完成回合复盘</button>
                </div>

                <div className="recall-position-details" aria-label="完整持仓摘要">
                  {phase === "pre-entry" ? <span>仅记录计划 · 成交尚未揭示</span> : <div className="recall-position-stats">
                    <span>持仓 <b>{quantityAvailable ? position.quantity : "待核对"}</b></span>
                    <span>均价 <b>{pnlAvailable ? Number(position.averageCost).toFixed(2) : settlementCurrencyMismatch ? "币种待换算" : "待补齐成本"}</b></span>
                    <span>估值 <b>{latestCandle?.close?.toFixed(2) ?? "—"}</b></span>
                    <span className={pnlPositive ? "positive" : "negative"}>净盈亏 <b>{pnlAvailable ? money(position.netPnl, instrument.currency) : settlementCurrencyMismatch ? "币种待换算" : "历史不完整"}</b></span>
                  </div>}
                </div>

                <details className="recall-snapshot-panel recall-replay-more__panel" aria-label="三阶段代表图">
                  <summary>三阶段代表图</summary>
                  <RecallStoryboard
                    document={document}
                    disabled={saving || Boolean(editingSnapshotId)}
                    onChangeDocument={next => { setDocument(touchRecallDraft(next)); markDirty(); }}
                  />
                </details>

                <details className="recall-snapshot-panel recall-replay-more__panel" aria-label="阶段快照"><summary>全部记录与快照（{document.snapshots.length}）</summary>
                  <div className="recall-panel-heading"><div><strong>阶段快照</strong><small>{decisionSnapshots.length} 份决策快照{globalSnapshot ? " · 1 份全局总结" : ""}</small></div><span>{saving ? "保存中…" : dirty ? "自动保存将在 1 秒后执行" : "已保存"}</span></div>
                  {deletedNotice && <div className="recall-delete-notice" role="status"><Undo2 size={14} />快照已删除<button type="button" onClick={undoDeleteSnapshot}>撤销</button></div>}
                  {document.snapshots.length === 0 ? <p className="recall-empty">选中一笔成交，在图表上完成标注后留存快照。</p> : <ol className="recall-snapshot-list">
                    {document.snapshots.map((snapshot, index) => {
                      const owner = snapshot.decisionId === "global" ? "全局总结" : `决策 ${document.decisions.findIndex((decision) => decision.id === snapshot.decisionId) + 1}`;
                      return <li key={snapshot.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/recall-snapshot", snapshot.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onSnapshotDrop(event, snapshot.id)} className={editingSnapshotId === snapshot.id ? "editing" : ""}>
                        <span className="recall-drag-handle" aria-hidden="true"><GripVertical size={16} /></span><span className="recall-snapshot-owner"><strong>{owner}</strong><small>{snapshotTitle(snapshot, index)} · {snapshot.drawings.filter((drawing) => drawing.tool === "text").length} 段文字</small></span><span className="recall-snapshot-actions"><button type="button" aria-label={`编辑${owner}快照`} title={`编辑${owner}快照`} onClick={() => editSnapshot(snapshot)}><ClipboardPenLine size={14} />编辑</button><button type="button" aria-label={`删除${owner}快照`} title={`删除${owner}快照`} onClick={() => removeSnapshot(snapshot)}><Trash2 size={14} /></button></span>
                      </li>;
                    })}
                  </ol>}
                </details>

                {selectedExecution && phase !== "pre-entry" && <p className="recall-selected-fill"><span>当前决策首笔成交</span> {executionLabel(selectedExecution)} · 成交事实来自导入记录</p>}
              </div>
            </div>

            {(showReplayControlReason || canReturnToPreEntry) && <div className="recall-replay-bar__secondary" role="status">
              {showReplayControlReason && <span className="recall-control-note">{replayControlReason}</span>}
              {canReturnToPreEntry && <button type="button" className="recall-return-pre-entry" onClick={() => void switchPhase("pre-entry")}>回到买入前判断</button>}
            </div>}
          </div>

          {!pnlAvailable && <p role="status">持仓历史、成本或费用尚未补齐，盈亏及成本线暂不展示。{settlementCurrencyMismatch ? "报价币种与结算币种不同，未换算汇率，盈亏不可用。" : position.accuracy?.reasons.includes("ambiguous-opening") ? "首笔卖出缺少期初持仓或明确卖空依据，持仓方向待核对。" : ""}</p>}

          {statsOpen && <aside className="recall-stats-panel" aria-label="当前统计"><div><strong>当前统计</strong><button type="button" aria-label="关闭统计" onClick={() => setStatsOpen(false)}><X size={15} /></button></div><dl><dt>标记收盘价</dt><dd>{latestCandle?.close?.toFixed(2) ?? "—"}</dd><dt>标记时间</dt><dd>{latestCandle ? formatMarketCursor(latestCandle.time, instrument.market) : "—"}</dd><dt>已揭示成交</dt><dd>{chartExecutions.length} / {currentExecutions.length}</dd><dt>持仓数量</dt><dd>{quantityAvailable ? position.quantity : "待核对"}</dd><dt>平均成本</dt><dd>{pnlAvailable ? Number(position.averageCost).toFixed(2) : settlementCurrencyMismatch ? "币种待换算" : "待补齐成本"}</dd><dt>净盈亏</dt><dd className={pnlPositive ? "positive" : "negative"}>{pnlAvailable ? money(position.netPnl, instrument.currency) : settlementCurrencyMismatch ? "币种待换算" : "历史不完整"}</dd><dt>累计费用</dt><dd>{chartExecutions.some((execution) => execution.source.feeStatus === "unknown") ? "待核对" : feeCurrency ? fee(position.fees, feeCurrency) : "币种待核对"}</dd></dl></aside>}

        </div>
      </div>
      {exportOpen && (
        <div className="recall-export-modal">
          <RecallExportDialog
            document={document}
            episode={episode}
            onClose={() => setExportOpen(false)}
            onOrderChange={persistExportOrder}
          />
        </div>
      )}
    </section>
  );
}

type ReplayChartWithHandleProps = ComponentProps<typeof ReplayChart> & {
  onReady?: (handle: RecallChartHandle | null) => void;
  revealRequest?: { id: number; time: string };
};
const ReplayChartWithHandle = ReplayChart as unknown as (props: ReplayChartWithHandleProps) => ReactElement;
