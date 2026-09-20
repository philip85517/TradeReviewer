import type { NormalizedDrawing } from "../chart/drawings";
import type { Candle, Timeframe } from "../market/types";
import type { TradeEpisode } from "../trades/types";

/** A chart viewport is intentionally open ended so the chart package can add fields without a migration. */
export type RecallViewport = {
  version: 1;
  logicalRange: { from: number; to: number } | null;
  barSpacing: number;
  rightOffset: number;
  width: number;
  height: number;
  [key: string]: unknown;
};

/**
 * Normalized drawings are the public chart contract. Runtime cloning keeps
 * additional JSON fields so older/raw Text records survive a round trip.
 */
export type RecallDrawing = NormalizedDrawing;
export type RecallCandle = Candle;

export type RecallDecision = {
  id: string;
  executionIds: string[];
};

export type RecallSnapshot = {
  id: string;
  /** `unassigned` is used only while an explicit split allocation is pending. */
  decisionId: string | "global" | "unassigned";
  timeframe: Timeframe;
  cursor: string;
  executionCursor: string;
  candles: RecallCandle[];
  drawings: RecallDrawing[];
  viewport?: RecallViewport;
  imageDataUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type RecallWorkingState = {
  drawings: RecallDrawing[];
  timeframe: Timeframe;
  cursor: string;
  executionCursor: string;
  selectedDecisionId: string | "global" | null;
  /**
   * Optional persisted overlay for a decision-stage visit. `working` remains
   * the full global graph; this context lets a reload resume an in-progress
   * stage without replacing that graph.
   */
  editingContext?: RecallWorkingContext;
  /**
   * Decision-local working graphs survive switching back to the global chart
   * and completion. They are drafts only; retained snapshots remain the
   * exportable/formal record until the user explicitly saves one.
   */
  decisionDrafts?: RecallWorkingContext[];
};

export type RecallWorkingContext = {
  mode: "global" | "decision";
  decisionId: string | "global";
  drawings: RecallDrawing[];
  timeframe: Timeframe;
  cursor: string;
  executionCursor: string;
};

export type RecallDocumentStatus =
  | "in-progress"
  | "completed"
  | "needs-confirmation";

export type RecallReconciliationState = {
  addedExecutionIds: string[];
  removedExecutionIds: string[];
  stale: boolean;
};

/** The persisted formal version never contains another formal version. */
export type RecallCompletedVersion = Omit<
  RecallDocument,
  "lastCompleted" | "reconciliation"
> & {
  status: "completed";
  completedAt: string;
};

export type RecallDocument = {
  version: 1;
  episodeId: string;
  revision: number;
  decisions: RecallDecision[];
  snapshots: RecallSnapshot[];
  working: RecallWorkingState;
  status: RecallDocumentStatus;
  completedAt?: string;
  updatedAt: string;
  lastCompleted?: RecallCompletedVersion;
  reconciliation?: RecallReconciliationState;
};

export type RecallSplitGroup = {
  id?: string;
  executionIds: readonly string[];
  snapshotIds?: readonly string[];
};

export type RecallSplitInput =
  | readonly RecallSplitGroup[]
  | readonly (readonly string[])[];

export type RecallReconciliation = {
  document: RecallDocument;
  addedExecutionIds: string[];
  removedExecutionIds: string[];
  staleExecutionIds: string[];
  missingDecisionIds: string[];
};

/** Explicitly acknowledge a refreshed execution set after orphaned content is handled. */
export type RecallReconciliationResolution = {
  addedExecutionIds?: readonly string[];
  removedExecutionIds?: readonly string[];
  /** Empty decisions must be removed explicitly after their snapshots are reassigned/deleted. */
  decisionIdsToRemove?: readonly string[];
};

export type RecallSaveInput = {
  document: RecallDocument;
  expectedRevision: number;
  finalize?: boolean;
};

export type RecallSaveResult = {
  document: RecallDocument;
  revision: number;
};

export type RecallEpisode = TradeEpisode;
