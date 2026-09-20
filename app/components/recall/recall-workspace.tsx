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
  type ReactElement,
} from "react";
import { flushSync } from "react-dom";

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
  splitRecallDecision,
  updateRecallSnapshot,
} from "../../lib/recall/document";
import {
  createRecallRepository,
  RecallRepositoryError,
} from "../../lib/recall/repository";
import type {
  RecallDocument,
  RecallSnapshot,
  RecallSplitGroup,
  RecallWorkingContext,
} from "../../lib/recall/types";
import {
  executionBoundaryForCursor,
  executionsThroughCursor,
  mapRecallExecutionToCandle,
  nextRecallDecisionState,
  recallExecutionCandleIndex,
  revealRecallBar,
  revealRecallDecision,
  revealRecallHistory,
  NO_REVEALED_EXECUTIONS,
  rewindRecallBar,
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
  const newerDraftExists = requestGeneration !== currentGeneration;
  return {
    document: newerDraftExists
      ? {
          ...current,
          revision: saved.revision,
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
  /** Export is intentionally an adapter. The export worker owns its dialog and format. */
  onExport?: (document: RecallDocument) => void;
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

function persistedEditingContext(
  mode: RecallWorkingContext["mode"],
  decisionId: RecallWorkingContext["decisionId"],
  graph: WorkingGraph,
): RecallWorkingContext {
  return {
    mode,
    decisionId,
    drawings: cloneDrawings(graph.drawings),
    timeframe: graph.timeframe,
    cursor: graph.replay.cursor,
    executionCursor: graph.replay.executionCursor,
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
    snapshots,
    working: {
      drawings: working.drawings,
      timeframe: working.timeframe,
      cursor: working.cursor,
      executionCursor: working.executionCursor,
      editingContext: working.editingContext,
      decisionDrafts: working.decisionDrafts,
    },
    status,
  });
}

function snapshotTitle(snapshot: RecallSnapshot, index: number) {
  return `${snapshot.timeframe} · 第 ${index + 1} 次留存`;
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

function mapCursorToTimeframe(
  replay: RecallReplayCursor,
  executions: TradeExecution[],
  candles: Candle[],
) {
  const lastExecution = replay.revealedExecutions.at(-1);
  const mapped = lastExecution ? mapRecallExecutionToCandle(lastExecution, candles) : undefined;
  if (mapped) {
    return {
      ...replay,
      cursor: candleKnowledgeAt(mapped),
      currentCandle: mapped,
      revealedCandles: candles.filter((candle) => candle.time <= mapped.time),
    };
  }
  const sorted = [...candles].sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
  const cursorTime = Date.parse(replay.cursor);
  const current = replay.executionCursor === NO_REVEALED_EXECUTIONS
    ? sorted.findLast((candle) => Date.parse(candleKnowledgeAt(candle)) <= cursorTime) ?? sorted[0]
    : sorted.findLast((candle) => Date.parse(candle.time) <= cursorTime) ?? sorted[0];
  return {
    ...replay,
    cursor: replay.executionCursor === NO_REVEALED_EXECUTIONS
      ? replay.cursor
      : current ? candleKnowledgeAt(current) : replay.cursor,
    currentCandle: current,
    revealedCandles: current ? sorted.slice(0, sorted.findIndex((candle) => candle.time === current.time) + 1) : [],
    revealedExecutions: executionsThroughCursor(executions, replay.executionCursor),
  };
}

function restorePersistedWorkingGraph(
  context: RecallWorkingContext,
  decisions: RecallDocument["decisions"],
  executions: TradeExecution[],
  candles: Candle[],
): WorkingGraph {
  const base = revealRecallDecision({
    candles,
    executions,
    decisions,
    decisionId: context.decisionId,
  });
  const boundary = executionBoundaryForCursor(executions, context.executionCursor);
  const beforeFirst = context.executionCursor === NO_REVEALED_EXECUTIONS;
  const replay: RecallReplayCursor = {
    ...base,
    cursor: context.cursor || base.cursor,
    executionCursor: boundary >= 0 || beforeFirst ? context.executionCursor : base.executionCursor,
    revealedExecutions: boundary >= 0
      ? executionsThroughCursor(executions, context.executionCursor)
      : beforeFirst
        ? []
        : base.revealedExecutions,
  };
  return {
    drawings: cloneDrawings(context.drawings),
    replay: mapCursorToTimeframe(replay, executions, candles),
    timeframe: context.timeframe,
  };
}

function textContentChanged(previous: NormalizedDrawing, next: NormalizedDrawing) {
  return previous.text !== next.text;
}

function stampRecallDrawingCommand(
  command: DrawingCommand,
  drawings: NormalizedDrawing[],
  ownerId: string | "global" | null,
): DrawingCommand {
  const owner = ownerId ?? "global";
  if (command.type === "add" && command.drawing.tool === "text") {
    return {
      ...command,
      drawing: {
        ...command.drawing,
        recallOwnerId: owner,
        textRevision: command.drawing.textRevision ?? 1,
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
  onExport,
}: RecallWorkspaceProps) {
  const fallbackTimeframe = firstEnabledTimeframe(timeframeAvailability, candlesByTimeframe);
  const chartHandleRef = useRef<RecallChartHandle | null>(null);
  const previousEpisodeIdRef = useRef<string | null>(null);
  const saveDocumentRef = useRef<((document?: RecallDocument, force?: boolean, generation?: number) => Promise<void>) | null>(null);
  const saveQueueRef = useRef(Promise.resolve());
  const draftGenerationRef = useRef(0);
  const episodeRef = useRef(episode);
  const draftRef = useRef<RecallDocument | null>(null);
  const latestSavedDocumentRef = useRef<RecallDocument | null>(null);
  const latestSavedGenerationRef = useRef(-1);
  const dirtyRef = useRef(false);
  const snapshotEditBackupRef = useRef<SnapshotEditBackup | null>(null);
  const historyReplayBackupRef = useRef<RecallReplayCursor | null>(null);
  const pendingViewportRestoreRef = useRef<ChartViewport | null>(null);
  const deletedSnapshotRef = useRef<RecallSnapshot | null>(null);
  const globalWorkingContextRef = useRef<WorkingGraph | null>(null);
  const stageWorkingContextsRef = useRef(new Map<string, WorkingGraph>());
  const activeContextModeRef = useRef<RecallWorkingContext["mode"]>("global");
  const [document, setDocument] = useState<RecallDocument | null>(null);
  const [formalBaseline, setFormalBaseline] = useState<RecallDocument | null>(null);
  const [replay, setReplay] = useState<RecallReplayCursor | null>(null);
  const [drawingHistory, setDrawingHistory] = useState<DrawingHistory>(() => createDrawingHistory());
  const drawingHistoryRef = useRef<DrawingHistory>(drawingHistory);
  const [timeframe, setTimeframe] = useState<Timeframe>(fallbackTimeframe);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | "global" | null>(null);
  const [selectedDecisionIds, setSelectedDecisionIds] = useState<string[]>([]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [leftNavOpen, setLeftNavOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [historyMode, setHistoryMode] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [snapshotEditDirty, setSnapshotEditDirty] = useState(false);
  const [snapshotCandles, setSnapshotCandles] = useState<Candle[] | null>(null);
  const [splitDrafts, setSplitDrafts] = useState<SplitDraft[] | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const markDirty = useCallback(() => {
    draftGenerationRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  useEffect(() => {
    draftRef.current = document;
    dirtyRef.current = dirty;
    drawingHistoryRef.current = drawingHistory;
  }, [document, dirty, drawingHistory]);

  useEffect(() => {
    episodeRef.current = episode;
  }, [episode]);

  const allCandles = timeframeCandles(timeframe, { importedTimelineCandles, candlesByTimeframe });
  const currentExecutions = episode.executions;
  const currentDecision = document?.decisions.find((decision) => decision.id === selectedDecisionId);
  const snapshotEdit = document?.snapshots.find((snapshot) => snapshot.id === editingSnapshotId);
  const chartCandles = snapshotCandles ?? replay?.revealedCandles ?? allCandles;
  const chartExecutions = useMemo(
    () => snapshotEdit
      ? executionsThroughCursor(currentExecutions, snapshotEdit.executionCursor)
      : replay?.mode === "history"
        ? currentExecutions
        : replay?.revealedExecutions ?? [],
    [currentExecutions, replay?.mode, replay?.revealedExecutions, snapshotEdit],
  );
  const latestCandle = chartCandles.at(-1);
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
  }, [drawingHistory.present, editingSnapshotId, historyMode, markDirty, selectedDecisionId, timeframe]);

  const restoreWorkingFromDocument = useCallback((nextDocument: RecallDocument, preferredTimeframe?: Timeframe) => {
    const nextTimeframe = preferredTimeframe && timeframeAvailability[preferredTimeframe].enabled
      ? preferredTimeframe
      : nextDocument.working.timeframe && timeframeAvailability[nextDocument.working.timeframe].enabled
        ? nextDocument.working.timeframe
        : fallbackTimeframe;
    const globalCandles = timeframeCandles(nextTimeframe, { importedTimelineCandles, candlesByTimeframe });
    const globalReplayBase = revealRecallDecision({
      candles: globalCandles,
      executions: currentExecutions,
      decisions: nextDocument.decisions,
      decisionId: nextDocument.decisions[0]?.id ?? "",
    });
    const storedExecutionCursor = nextDocument.working.executionCursor;
    const storedBoundary = executionBoundaryForCursor(currentExecutions, storedExecutionCursor);
    const storedBeforeFirst = storedExecutionCursor === NO_REVEALED_EXECUTIONS;
    const globalReplay: RecallReplayCursor = {
      ...globalReplayBase,
      cursor: nextDocument.working.cursor || globalReplayBase.cursor,
      executionCursor: storedBoundary >= 0 || storedBeforeFirst ? storedExecutionCursor : globalReplayBase.executionCursor,
      revealedExecutions: storedBoundary >= 0
        ? executionsThroughCursor(currentExecutions, storedExecutionCursor)
        : storedBeforeFirst
          ? []
          : globalReplayBase.revealedExecutions,
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
      const draftCandles = timeframeCandles(draftTimeframe, { importedTimelineCandles, candlesByTimeframe });
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
      const stageCandles = timeframeCandles(stageTimeframe, { importedTimelineCandles, candlesByTimeframe });
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

    setTimeframe(activeGraph.timeframe);
    setSelectedDecisionId(activeDecisionId);
    const nextHistory = createDrawingHistory(activeGraph.drawings);
    drawingHistoryRef.current = nextHistory;
    setDrawingHistory(nextHistory);
    setReplay(activeGraph.replay);
  }, [candlesByTimeframe, currentExecutions, fallbackTimeframe, importedTimelineCandles, timeframeAvailability]);

  const loadEpisode = useCallback(async (episodeToLoad: TradeEpisode, cancelled: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await repository.load(episodeToLoad.id);
      if (cancelled()) return;
      let nextDocument = loaded ?? createRecallDocument(episodeToLoad);
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
  }, [initialDrawings, repository, restoreWorkingFromDocument]);

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
      if (!force && requestGeneration !== draftGenerationRef.current) return;
      setSaving(true);
      try {
        const saved = await repository.save(candidate, { expectedRevision: candidate.revision });
        latestSavedDocumentRef.current = saved;
        latestSavedGenerationRef.current = requestGeneration;
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
        if (isConflict(saveError)) {
          setConflict(true);
          setError("云端草稿已有新版本；当前编辑仍保留，请重新载入或手动合并。");
        } else {
          setError(saveError instanceof Error ? saveError.message : "复盘草稿保存失败");
        }
      } finally {
        setSaving(false);
      }
    });
    saveQueueRef.current = saveTask.then(() => undefined, () => undefined);
    await saveTask;
  }, [repository]);

  useEffect(() => {
    saveDocumentRef.current = saveNow;
  }, [saveNow]);

  useEffect(() => {
    let cancelled = false;
    const previousEpisodeId = previousEpisodeIdRef.current;
    if (previousEpisodeId && previousEpisodeId !== episode.id) {
      void saveDocumentRef.current?.();
    }
    previousEpisodeIdRef.current = episode.id;
    // Loading a selected episode is an external synchronization boundary.
    void loadEpisode(episodeRef.current, () => cancelled);
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

  const applyCommand = useCallback((command: DrawingCommand) => {
    const stamped = stampRecallDrawingCommand(
      command,
      drawingHistory.present,
      snapshotEdit?.decisionId ?? selectedDecisionId,
    );
    const nextHistory = applyDrawingCommand(drawingHistory, stamped);
    commitDrawingHistory(nextHistory);
  }, [commitDrawingHistory, drawingHistory, selectedDecisionId, snapshotEdit?.decisionId]);

  const selectDecision = useCallback((decisionId: string | "global") => {
    if (!document) return;
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
    const next = savedStage?.replay ?? revealRecallDecision({
      candles: nextCandles,
      executions: currentExecutions,
      decisions: document.decisions,
      decisionId,
    });
    const boundaryDrawings = savedStage?.drawings ?? drawingsAtDecisionBoundary(document, decisionId);
    const stageGraph: WorkingGraph = {
      drawings: cloneDrawings(boundaryDrawings),
      replay: savedStage?.replay ?? mapCursorToTimeframe(next, currentExecutions, nextCandles),
      timeframe: nextTimeframe,
    };
    stageWorkingContextsRef.current.set(decisionId, stageGraph);
    const stageHistory = createDrawingHistory(stageGraph.drawings);
    drawingHistoryRef.current = stageHistory;
    setDrawingHistory(stageHistory);
    setTimeframe(nextTimeframe);
    setReplay(stageGraph.replay);
    const context = persistedEditingContext("decision", decisionId, stageGraph);
    setDocument((current) => current ? touchRecallDraft({
      ...current,
      updatedAt: nowIso(),
      working: {
        ...current.working,
        selectedDecisionId: decisionId,
        editingContext: context,
        decisionDrafts: upsertDecisionDraft(current.working.decisionDrafts, context),
      },
    }) : current);
    markDirty();
  }, [candlesByTimeframe, currentExecutions, document, importedTimelineCandles, markDirty, replay, selectedDecisionId, timeframe, timeframeAvailability]);

  const nextDecision = useCallback(() => {
    if (!document || !replay) return;
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
  }, [allCandles, currentExecutions, document, editingSnapshotId, replay, selectedDecisionId, setWorking]);

  const nextBar = useCallback(() => {
    if (!replay) return;
    setWorking(revealRecallBar({ candles: allCandles, executions: currentExecutions, current: replay }));
  }, [allCandles, currentExecutions, replay, setWorking]);

  const toggleHistory = useCallback(() => {
    if (!replay) return;
    if (historyMode) {
      const selected = historyReplayBackupRef.current ?? replay;
      setHistoryMode(false);
      setReplay(selected);
      historyReplayBackupRef.current = null;
      return;
    }
    historyReplayBackupRef.current = replay;
    setHistoryMode(true);
    setReplay(revealRecallHistory(allCandles, currentExecutions));
  }, [allCandles, currentExecutions, historyMode, replay]);

  const changeTimeframe = useCallback((nextTimeframe: Timeframe) => {
    if (!timeframeAvailability[nextTimeframe].enabled || !document || !replay) return;
    const nextCandles = timeframeCandles(nextTimeframe, { importedTimelineCandles, candlesByTimeframe });
    const mapped = mapCursorToTimeframe(replay, currentExecutions, nextCandles);
    setTimeframe(nextTimeframe);
    setReplay(mapped);
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
          },
        }) : current);
      }
      markDirty();
    } else if (editingSnapshotId) {
      setSnapshotEditDirty(true);
    }
  }, [candlesByTimeframe, currentExecutions, document, editingSnapshotId, historyMode, importedTimelineCandles, markDirty, onTimeframeChange, replay, selectedDecisionId, timeframeAvailability]);

  const capture = useCallback(async () => {
    const chartHandle = chartHandleRef.current;
    if (!chartHandle) throw new Error("图表尚未完成渲染，无法留存截图");
    const captureResult = await chartHandle.capture();
    if (!captureResult.imageDataUrl.startsWith("data:image/")) throw new Error("图表截图无效，未创建快照");
    return captureResult;
  }, []);

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
      const nextSnapshot = createSnapshot(undefined, selectedDecisionId, timeframe, replay, drawingHistoryRef.current.present, chartCandles, captureResult);
      setDocument((current) => current ? touchRecallDraft(retainRecallSnapshot(current, nextSnapshot)) : current);
      markDirty();
      setError(null);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "图表截图失败，未创建快照");
    }
  }, [capture, chartCandles, confirmCaptureWarnings, document, markDirty, replay, selectedDecisionId, timeframe, unmatchedDecisionIds]);

  const editSnapshot = useCallback((snapshot: RecallSnapshot) => {
    if (!replay || !document) return;
    snapshotEditBackupRef.current = {
      drawings: cloneDrawings(drawingHistory.present),
      replay,
      selectedDecisionId,
      timeframe,
      viewport: chartHandleRef.current?.getViewport(),
    };
    setEditingSnapshotId(snapshot.id);
    setSnapshotEditDirty(false);
    setSnapshotCandles(snapshot.candles.map((candle) => ({ ...candle, tradingDates: candle.tradingDates ? [...candle.tradingDates] : undefined })));
    setTimeframe(snapshot.timeframe);
    setSelectedDecisionId(snapshot.decisionId === "global" ? "global" : snapshot.decisionId);
    const snapshotHistory = createDrawingHistory(snapshot.drawings);
    drawingHistoryRef.current = snapshotHistory;
    setDrawingHistory(snapshotHistory);
    setReplay({
      cursor: snapshot.cursor,
      executionCursor: snapshot.executionCursor,
      mode: "replay",
      revealedCandles: snapshot.candles,
      revealedExecutions: executionsThroughCursor(currentExecutions, snapshot.executionCursor),
      currentCandle: snapshot.candles.at(-1),
    });
    setError(null);
  }, [currentExecutions, document, drawingHistory.present, replay, selectedDecisionId, timeframe]);

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
      setSelectedDecisionId(backup.selectedDecisionId);
      setTimeframe(backup.timeframe);
    }
    snapshotEditBackupRef.current = null;
    setEditingSnapshotId(null);
    setSnapshotEditDirty(false);
    setSnapshotCandles(null);
  }, []);

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
      const nextSnapshot = createSnapshot(snapshotEdit, snapshotEdit.decisionId, timeframe, replay, drawingHistoryRef.current.present, chartCandles, captureResult);
      setDocument((current) => current ? touchRecallDraft(updateRecallSnapshot(current, nextSnapshot)) : current);
      markDirty();
      leaveSnapshotEditNow();
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "图表截图失败，未更新快照");
    }
  }, [capture, chartCandles, confirmCaptureWarnings, document, leaveSnapshotEditNow, markDirty, replay, snapshotEdit, timeframe]);

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
    try {
      // A pending one-second draft save must settle before finalization so the
      // completion request uses the server's newest CAS revision.
      await saveQueueRef.current;
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
      const completionFromDecision = completionDecisionId !== null;
      let completionDocument = baseDocument;
      let globalGraph = globalWorkingContextRef.current;
      if (completionDecisionId) {
        await capture();
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
      if (completionFromDecision && globalGraph) {
        activeContextModeRef.current = "global";
        const globalHistory = createDrawingHistory(globalGraph.drawings);
        drawingHistoryRef.current = globalHistory;
        const globalDocument: RecallDocument = {
          ...completionDocument,
          working: {
            ...completionDocument.working,
            drawings: cloneDrawings(globalGraph.drawings),
            timeframe: globalGraph.timeframe,
            cursor: globalGraph.replay.cursor,
            executionCursor: globalGraph.replay.executionCursor,
            selectedDecisionId: "global",
            editingContext: undefined,
          },
        };
        completionDocument = globalDocument;
        draftRef.current = globalDocument;
        flushSync(() => {
          setDrawingHistory(globalHistory);
          setSelectedDecisionId("global");
          setTimeframe(globalGraph!.timeframe);
          setReplay(globalGraph!.replay);
          setDocument(globalDocument);
        });
        if (globalGraph.viewport) {
          pendingViewportRestoreRef.current = globalGraph.viewport;
          chartHandleRef.current?.restoreViewport(globalGraph.viewport);
        }
        await chartHandleRef.current?.flush();
        globalGraph = globalWorkingContextRef.current ?? globalGraph;
      }
      const captureContext = completionFromDecision ? globalGraph : null;
      const captureTimeframe = captureContext?.timeframe ?? timeframe;
      const captureReplay = captureContext?.replay ?? replay;
      const captureCandles = captureContext?.replay.revealedCandles ?? chartCandles;
      const captureResult = await capture();
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
        viewport: globalGraph?.viewport,
      };
      const capturedWorkingDocument: RecallDocument = {
        ...completionDocument,
        working: {
          ...completionDocument.working,
          drawings: capturedGraph.drawings,
          editingContext: activeContextModeRef.current === "decision" && selectedDecisionId && selectedDecisionId !== "global"
            ? persistedEditingContext("decision", selectedDecisionId, capturedGraph)
            : undefined,
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
      const withGlobal = capturedWorkingDocument.snapshots.some((snapshot) => snapshot.decisionId === "global")
        ? updateRecallSnapshot(capturedWorkingDocument, globalSnapshot)
        : retainRecallSnapshot(capturedWorkingDocument, globalSnapshot);
      const completed = completeRecallDocument(withGlobal, episode);
      const generationAtStart = draftGenerationRef.current;
      setSaving(true);
      const saved = await repository.save(completed, { expectedRevision: completionDocument.revision, finalize: true });
      latestSavedDocumentRef.current = saved;
      latestSavedGenerationRef.current = generationAtStart;
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
    } catch (completeError) {
      if (isConflict(completeError)) setConflict(true);
      setError(completeError instanceof Error ? completeError.message : "完成回合保存失败");
    } finally {
      setSaving(false);
    }
  }, [capture, chartCandles, confirmCaptureWarnings, document, editingSnapshotId, episode, missing, replay, repository, selectedDecisionId, timeframe]);

  const handleChartReady = useCallback((handle: RecallChartHandle | null) => {
    chartHandleRef.current = handle;
    if (!handle) return;
    if (activeContextModeRef.current === "global" && globalWorkingContextRef.current && !globalWorkingContextRef.current.viewport) {
      globalWorkingContextRef.current = { ...globalWorkingContextRef.current, viewport: handle.getViewport() };
    }
    if (editingSnapshotId && snapshotEdit?.viewport) {
      const viewport = snapshotEdit.viewport;
      window.requestAnimationFrame(() => chartHandleRef.current?.restoreViewport(viewport));
      return;
    }
    if (!editingSnapshotId && pendingViewportRestoreRef.current) {
      const viewport = pendingViewportRestoreRef.current;
      pendingViewportRestoreRef.current = null;
      window.requestAnimationFrame(() => chartHandleRef.current?.restoreViewport(viewport));
    }
  }, [editingSnapshotId, snapshotEdit]);

  if (loading) {
    return <section className="recall-workspace recall-loading" aria-busy="true"><ClipboardPenLine size={20} /><strong>正在读取复盘草稿…</strong></section>;
  }
  if (!document || !replay) {
    return <section className="recall-workspace recall-loading" role="alert"><CircleAlert size={20} /><strong>{error ?? "复盘草稿不可用"}</strong></section>;
  }

  const decisionSnapshots = document.snapshots.filter((snapshot) => snapshot.decisionId !== "global");
  const globalSnapshot = document.snapshots.find((snapshot) => snapshot.decisionId === "global");
  const selectedExecution = currentDecisionExecution(document, currentExecutions, selectedDecisionId);
  const revealedExecutionIds = new Set(chartExecutions.map((execution) => execution.id));
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

  return (
    <section className="recall-workspace" aria-label="导入交易回忆复盘工作区">
      <header className="recall-header">
        <div className="recall-heading">
          <span className="eyebrow">{tradeNature === "simulation" ? "TradingView · 模拟盘" : "导入交易 · 回忆复盘"}</span>
          <h1>{instrument.name} <small>{instrument.symbol}</small></h1>
          <span className="recall-status" data-status={document.status}>
            {document.status === "completed" ? "已完成" : document.status === "needs-confirmation" ? "待重新确认" : "草稿"}
            {(dirty || hasFormalDraft) && " · 有草稿修改"}
          </span>
        </div>
        <div className="recall-header-controls">
          <label>
            <span>标的</span>
            <select aria-label="复盘标的" value={instrument.id} onChange={(event) => onInstrumentChange(event.target.value)}>
              {instruments.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.symbol}</option>)}
            </select>
          </label>
          <label>
            <span>交易回合</span>
            <select aria-label="交易回合" value={episode.id} onChange={(event) => onEpisodeChange(event.target.value)}>
              {episodes.map((item, index) => <option key={item.id} value={item.id}>第 {episodes.length - index} 次 · {item.status === "closed" ? "已平仓" : "持仓中"}</option>)}
            </select>
          </label>
          <button type="button" className="recall-icon-button" aria-label={leftNavOpen ? "收起复盘导航" : "展开复盘导航"} onClick={() => setLeftNavOpen((open) => !open)}>
            {leftNavOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
          <button type="button" className="recall-icon-button" aria-label="统计" aria-pressed={statsOpen} onClick={() => setStatsOpen((open) => !open)}><BarChart3 size={17} /></button>
          <button type="button" className="recall-export-button" title="导出已留存内容" onClick={() => onExport ? onExport(document) : setExportOpen(true)}><Download size={15} />导出</button>
        </div>
      </header>

      {tradeNature === "simulation" && (
        <div className="tradingview-replay-notice" data-testid="tradingview-replay-notice">
          <strong>模拟盘回放</strong>
          <span>成交日期按 TradingView 导出记录保留；游标回放只显示当前时点已知的行情与成交。</span>
          {simulationRunId && <small>运行 {simulationRunId}</small>}
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
          <button type="button" className="recall-reconciliation-confirm" disabled={reconciliationOrphans.some((decision) => document.snapshots.some((snapshot) => snapshot.decisionId === decision.id))} onClick={resolveReconciliation}>确认已处理行情变更</button>
        </section>
      )}

      <div className={`recall-layout${leftNavOpen ? "" : " nav-collapsed"}`}>
        {leftNavOpen && (
          <aside className="recall-nav" aria-label="回合与决策导航">
            <div className="recall-nav-title"><span>本回合记录</span><small>{document.decisions.length} 笔决策</small></div>
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
          {historyMode && <div className="recall-history-banner"><History size={15} />完整历史：当前回合成交全部显示；返回后恢复原回放边界。<button type="button" onClick={toggleHistory}>返回回放</button></div>}
          {unmatchedDecisionIds.size > 0 && <div className="recall-unmatched" role="status"><CircleAlert size={15} />有成交找不到对应 K 线；相关决策可编辑草稿，但不能留存冒充该时点的快照。</div>}

          <div className="recall-chart-shell">
            <DrawingToolbar activeTool={activeTool} canUndo={canUndo} canRedo={canRedo} allLocked={allLocked} onToolChange={setActiveTool} onUndo={() => replay && commitDrawingHistory(undoDrawingAtCursor(drawingHistory, replay.cursor, timeframe))} onRedo={() => replay && commitDrawingHistory(redoDrawingAtCursor(drawingHistory, replay.cursor, timeframe))} onClear={() => commitDrawingHistory(applyDrawingCommand(drawingHistory, { type: "clear-unlocked" }))} onToggleLock={() => replay && commitDrawingHistory(setAllDrawingsLockedAtCursor(drawingHistory, replay.cursor, timeframe))} />
            <div className="recall-chart-column">
              <ReplayChartWithHandle
                episodeId={episode.id}
                viewportKey={`${episode.id}:${timeframe}:${editingSnapshotId ?? "working"}:${chartCandles[0]?.time ?? ""}:${chartCandles.at(-1)?.time ?? ""}`}
                candles={chartCandles}
                executions={chartExecutions}
                cursor={replay.cursor}
                averageCost={pnlAvailable ? Number(position.averageCost) : 0}
                drawings={visibleDrawingsAtCursor(drawingHistory.present, replay.cursor, timeframe)}
                activeTool={activeTool}
                settings={pnlAvailable ? settings : { ...settings, showAverageCost: false }}
                selectedDrawingId={selectedDrawingId}
                plannedRiskAmount={undefined}
                currency={instrument.currency}
                onSelectDrawing={setSelectedDrawingId}
                onCommand={applyCommand}
                onReady={handleChartReady}
              />
              {layersOpen && <DrawingLayersPanel drawings={visibleDrawings} onCommand={applyCommand} onSelectDrawing={setSelectedDrawingId} selectedDrawingId={selectedDrawingId} />}
            </div>
            <button type="button" className="recall-fit-all" onClick={() => chartHandleRef.current?.fitAll()} aria-label="适应全部">适应全部</button>
          </div>

          <div className="recall-position-strip">
            <div><span className={`live-dot${historyMode ? "" : " playing"}`} /><strong>{selectedLabel}</strong><small>{replay.cursor ? `行情截至 ${formatMarketCursor(replay.cursor, instrument.market)}` : "尚无行情游标"}</small></div>
            <div className="recall-position-stats">
              <span>持仓 <b>{quantityAvailable ? position.quantity : "待核对"}</b></span>
              <span>均价 <b>{pnlAvailable ? Number(position.averageCost).toFixed(2) : settlementCurrencyMismatch ? "币种待换算" : "待补齐成本"}</b></span>
              <span>估值 <b>{latestCandle?.close?.toFixed(2) ?? "—"}</b></span>
              <span className={pnlPositive ? "positive" : "negative"}>净盈亏 <b>{pnlAvailable ? money(position.netPnl, instrument.currency) : settlementCurrencyMismatch ? "币种待换算" : "历史不完整"}</b></span>
            </div>
          </div>

          {!pnlAvailable && <p role="status">持仓历史、成本或费用尚未补齐，盈亏及成本线暂不展示。{settlementCurrencyMismatch ? "报价币种与结算币种不同，未换算汇率，盈亏不可用。" : position.accuracy?.reasons.includes("ambiguous-opening") ? "首笔卖出缺少期初持仓或明确卖空依据，持仓方向待核对。" : ""}</p>}

          <div className="recall-controls" aria-label="回放控制">
            <button type="button" aria-label="上一根 K 线" disabled={replay.revealedCandles.length <= 1 || historyMode} onClick={() => {
              const previous = replay.revealedCandles.at(-2);
              if (!previous) return;
              setWorking(rewindRecallBar({ candles: allCandles, executions: currentExecutions, current: replay }));
            }}><ChevronLeft size={17} />上一根</button>
            <button type="button" className="primary" onClick={nextDecision} disabled={historyMode}><ChevronRight size={17} />下一笔决策</button>
            <button type="button" onClick={nextBar} disabled={historyMode || replay.revealedCandles.length >= allCandles.length}><ChevronDown size={17} />下一根 K 线</button>
            <button type="button" onClick={toggleHistory} className={historyMode ? "active" : ""}>{historyMode ? <Undo2 size={15} /> : <History size={15} />}{historyMode ? "返回回放" : "完整历史"}</button>
            <span className="recall-control-spacer" />
            {editingSnapshotId ? <><button type="button" className="primary" onClick={() => void updateSnapshot()}><FileImage size={15} />更新此快照</button><button type="button" onClick={leaveSnapshotEdit}><X size={15} />返回工作图</button></> : <button type="button" className="primary" onClick={() => void retain()} disabled={!selectedDecisionId || historyMode}><Save size={15} />留存当前快照</button>}
            <button type="button" className="complete-button" onClick={() => void complete()} disabled={document.status === "completed" && !dirty && !hasFormalDraft}><Check size={15} />保存并完成回合复盘</button>
          </div>

          {statsOpen && <aside className="recall-stats-panel" aria-label="当前统计"><div><strong>当前统计</strong><button type="button" aria-label="关闭统计" onClick={() => setStatsOpen(false)}><X size={15} /></button></div><dl><dt>标记收盘价</dt><dd>{latestCandle?.close?.toFixed(2) ?? "—"}</dd><dt>标记时间</dt><dd>{latestCandle ? formatMarketCursor(latestCandle.time, instrument.market) : "—"}</dd><dt>已揭示成交</dt><dd>{chartExecutions.length} / {currentExecutions.length}</dd><dt>持仓数量</dt><dd>{quantityAvailable ? position.quantity : "待核对"}</dd><dt>平均成本</dt><dd>{pnlAvailable ? Number(position.averageCost).toFixed(2) : settlementCurrencyMismatch ? "币种待换算" : "待补齐成本"}</dd><dt>净盈亏</dt><dd className={pnlPositive ? "positive" : "negative"}>{pnlAvailable ? money(position.netPnl, instrument.currency) : settlementCurrencyMismatch ? "币种待换算" : "历史不完整"}</dd><dt>累计费用</dt><dd>{chartExecutions.some((execution) => execution.source.feeStatus === "unknown") ? "待核对" : feeCurrency ? fee(position.fees, feeCurrency) : "币种待核对"}</dd></dl></aside>}

          <section className="recall-snapshot-panel" aria-label="阶段快照">
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
          </section>

          {selectedExecution && <p className="recall-selected-fill"><span>当前决策首笔成交</span> {executionLabel(selectedExecution)} · 成交事实来自导入记录</p>}
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

type ReplayChartWithHandleProps = ComponentProps<typeof ReplayChart> & { onReady?: (handle: RecallChartHandle | null) => void };
const ReplayChartWithHandle = ReplayChart as unknown as (props: ReplayChartWithHandleProps) => ReactElement;
