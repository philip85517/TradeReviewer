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

export type RecallPhase = "pre-entry" | "holding" | "post-review";

export type RecallSnapshot = {
  /** Supplied only when the capture's market-data pipeline attests this basis. */
  priceBasis?: "raw" | "adjusted";
  retainedBundleId?: string;
  phase?: RecallPhase;
  hasSeenFuture?: boolean;
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
  phase?: RecallPhase;
  phaseContexts?: Partial<Record<RecallPhase, RecallWorkingContext>>;
  hasSeenFuture?: boolean;
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
  /** Last actually revealed completed candle; null means no completed candle was visible. */
  revealedCandleCursor?: string | null;
  viewport?: RecallViewport;
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
  exitEvaluations?: import("./exit-evaluations").RecallExitEvaluationState;
  /** Optional episode-level manual attribution, absent on legacy documents. */
  manualEvaluations?: import("./manual-evaluations").RecallManualEvaluationState;
  plans?: { drafts: RecallPlanDraft[]; versions: RecallPlanVersion[]; riskBaselines: RecallRiskBaseline[] };
  retainedBundles?: RecallRetainedBundle[];
  planAssociations?: RecallPlanAssociation[];
  storyboard?: Partial<Record<RecallPhase, { snapshotId: string }>>;
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

export type RecallPlanInput = {
  sizing?: import("./sizing").RecallSizingEvidence;
  direction: "long" | "short" | null;
  currency: string | null;
  priceBasis: "raw" | "adjusted" | null;
  entry: string | null;
  initialStop: string | null;
  targets: { id: string; price: string | null; quantity: string | null; ratio: string | null }[];
  sizeInputMode: "quantity" | "amount" | "ratio";
  sizeInputValue: string | null;
  resolvedQuantity: string | null;
  quantityUnit: "share" | "unit";
  capital: { amount: string | null; currency: string | null; asOf: string | null; source: "manual-reference" | "account-snapshot"; snapshotRef?: string } | null;
};
export type RecallPlanDraft = {
  id: string; planId: string; decisionId: string; parentVersionId?: string;
  kind: "initial" | "adjustment" | "correction"; input: RecallPlanInput;
  reason?: string; riskBudget?: RecallRiskBudget;
  recordedPhase: RecallPhase; source: "retrospective"; recordedAt: string;
  knowledgeCutoff: { cursor: string; executionCursor: string }; hasSeenFuture: boolean;
};
export type RecallPlanVersion = RecallPlanDraft & { retainedAt: string };
export type RecallRiskBaseline = {
  id: string; scope: "decision" | "episode"; decisionId?: string; planVersionId: string;
  amount: string; currency: string; method: "planned-price-risk" | "fixed-budget";
  methodVersion: "risk-v1"; frozenAt: string; correctsBaselineId?: string;
};
export type RecallPlanAssociation = { executionIds?: string[]; planId: string; decisionId: string | null; status: "linked" | "needs-confirmation" };
export type RecallExecutionEvidence = {
  version: 1; executionIds: string[]; digest: string;
  payload: { episode: Omit<TradeEpisode, "executions" | "accountLabel" | "instrument"> & { instrument: Omit<TradeEpisode["instrument"], "name" | "localizedName"> };
    executions: (Omit<TradeEpisode["executions"][number], "accountLabel" | "instrument"> & { instrument: Omit<TradeEpisode["instrument"], "name" | "localizedName"> })[] };
};
export type RecallRetainedBundle = {
  actualMetrics?: import("./actual-metrics").RecallActualMetrics;
  id: string; snapshotId: string; documentRevision: number; retainedAt: string;
  /** Optional only on bundles accepted before visual-content binding was introduced. */
  snapshotContentDigest?: string;
  executionEvidence: RecallExecutionEvidence; decisions: RecallDecision[];
  captureContext: Pick<RecallSnapshot, "phase" | "cursor" | "executionCursor" | "timeframe" | "viewport" | "hasSeenFuture" | "priceBasis">;
  planVersionIds: string[]; riskBaselineIds: string[]; evaluationRevisionIds?: string[]; manualEvaluationRevisionIds?: string[];
};
export type RecallPlanMetric = { value: string | null; reason: string | null; currency: string | null; unit: string; methodVersion: "plan-v1" };
export type RecallPlanCalculation = { initialRisk: RecallPlanMetric; targetReward: RecallPlanMetric; expectedR: RecallPlanMetric; issues: {field: string; message: string}[] };

export type RecallRiskBudget = { amount: string; currency: string; scope: "decision" | "episode"; sourceDescription: string; evidenceReference: string | null; provenance: "retrospective" | "original-evidence"; effectiveKnowledgeCutoff: { cursor: string; executionCursor: string } };
