import Decimal from "decimal.js";

import { buildTradeEpisodes } from "../trades/episodes";
import {
  canonicalizeTradingViewExecution,
  classifyTradingViewExecution,
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
  tradingViewSourceRun,
} from "../trades/tradingview-account-identity";
import { tradeNatureOf, type TradeEpisode, type TradeExecution, type TradeNature } from "../trades/types";
import { sha256 } from "../recall/retained-digest";
import type {
  TradingViewAccountMigrationSnapshot,
  TradingViewCanonicalAccountOccupancySnapshot,
  TradingViewEpisodeSnapshot,
  TradingViewMigrationReferenceSnapshot,
} from "./tradingview-account-migration-plan";

export type ReadonlySqliteRow = Record<string, unknown>;

/**
 * The adapter only depends on SELECT-like row reads. A DatabaseSync caller can
 * implement this with `prepare(sql).all(...params)` while keeping opening the
 * database and enabling query_only outside this module.
 */
export type ReadonlySqliteRows = {
  all<T extends ReadonlySqliteRow = ReadonlySqliteRow>(
    sql: string,
    params?: readonly unknown[],
  ): readonly T[];
};

export type TradingViewSnapshotAdapterBlocker = {
  code:
    | "domain-run-grouping"
    | "invalid-execution-row"
    | "invalid-json"
    | "table-read-error";
  message: string;
  table?: string;
  primaryKey?: string;
  executionId?: string;
  fieldPath?: string;
};

export type TradingViewSnapshotTableScan = {
  table: string;
  scanned: number;
  included: number;
  digest: string;
};

export type TradingViewSnapshotAdapterResult = {
  snapshot: TradingViewAccountMigrationSnapshot;
  blockers: readonly TradingViewSnapshotAdapterBlocker[];
  snapshotDigest: string;
  scans: readonly TradingViewSnapshotTableScan[];
  domain: {
    oldEpisodes: number;
    newEpisodes: number;
    sourceRuns: readonly string[];
    newEpisodeInterface: "required";
  };
};

type ExecutionRow = ReadonlySqliteRow;
type ReferenceRow = ReadonlySqliteRow;

const EXECUTIONS_SQL = `
  select e.*, i.symbol, i.name, i.market, i.currency,
         i.metadata_json, i.localized_name_json
  from executions e
  join instruments i on i.id = e.instrument_id
`;

const REFERENCE_TABLES = [
  "import_batches",
  "reviews",
  "tag_suggestions",
  "app_settings",
  "trade_revisions",
  "recall_documents",
  "recall_plan_versions",
  "recall_plan_targets",
  "recall_risk_baselines",
  "recall_retained_bundles",
  "recall_bundle_plans",
  "recall_bundle_baselines",
  "recall_plan_associations",
  "recall_exit_evaluations",
  "recall_evaluation_associations",
  "recall_evaluation_tags",
  "recall_evaluation_evidence",
  "recall_evaluation_executions",
  "recall_bundle_evaluations",
  "recall_evaluation_selections",
  "recall_actual_metric_sources",
  "recall_actual_metrics",
  "recall_actual_metric_refs",
  "recall_actual_metric_exits",
  "recall_manual_evaluations",
  "recall_manual_evaluation_tags",
  "recall_manual_evaluation_evidence",
  "recall_manual_evaluation_executions",
  "recall_manual_evaluation_associations",
  "recall_manual_evaluation_association_executions",
  "recall_bundle_manual_evaluations",
] as const;

const JSON_COLUMNS = new Set([
  "cursor_json",
  "plan_json",
  "review_json",
  "drawings_json",
  "revisions_json",
  "confirmed_tags_json",
  "evidence_json",
  "reconciliation_json",
  "value_json",
  "request_json",
  "revision_json",
  "draft_json",
  "finalized_json",
  "capture_viewport_json",
  "decisions_json",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneValue(child)]));
  return value;
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot digest a non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort((left, right) => left.localeCompare(right)).flatMap((key) => {
      const child = value[key];
      return child === undefined ? [] : [`${JSON.stringify(key)}:${stableSerialize(child)}`];
    }).join(",")}}`;
  }
  throw new Error("Cannot digest unsupported SQLite value");
}

function digest(value: unknown): string {
  return `sha256:${sha256(stableSerialize(value))}`;
}

function rowValue(row: ReadonlySqliteRow, key: string): unknown {
  return row[key];
}

function requiredString(row: ReadonlySqliteRow, key: string): string {
  const value = rowValue(row, key);
  if (typeof value !== "string") throw new Error(`Invalid ${key}`);
  return value;
}

function parseJsonColumn(
  value: unknown,
  table: string,
  primaryKey: string,
  column: string,
  blockers: TradingViewSnapshotAdapterBlocker[],
): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return cloneValue(value);
  try {
    return JSON.parse(value) as unknown;
  } catch {
    blockers.push({
      code: "invalid-json",
      message: `The ${table}.${column} value is not valid JSON; the raw value is retained and the row cannot be migrated.`,
      table,
      primaryKey,
      fieldPath: column,
    });
    return { raw: value };
  }
}

function semanticTradeNature(value: unknown, allowLegacySimulation = false): TradeNature | undefined {
  if (typeof value !== "string") return undefined;
  switch (value.trim().toLowerCase()) {
    case "simulation":
      return "simulation";
    case "simulated":
      return allowLegacySimulation ? "simulation" : undefined;
    case "live":
      return "live";
    case "unknown":
      return "unknown";
    default:
      return undefined;
  }
}

function addExecutionRowBlocker(
  blockers: TradingViewSnapshotAdapterBlocker[],
  executionId: string,
  message: string,
): void {
  blockers.push({
    code: "invalid-execution-row",
    message,
    table: "executions",
    executionId,
  });
}

function sourceFromEvidence(
  row: ExecutionRow,
  blockers: TradingViewSnapshotAdapterBlocker[],
): { execution: TradeExecution; isCandidate: boolean } | null {
  const executionId = typeof row.id === "string" ? row.id : undefined;
  if (!executionId) {
    blockers.push({
      code: "invalid-execution-row",
      message: "An executions row has no string id and cannot be safely included.",
      table: "executions",
    });
    return null;
  }

  let evidence: Record<string, unknown> = {};
  if (row.evidence_json !== null && row.evidence_json !== undefined) {
    if (typeof row.evidence_json !== "string") {
      blockers.push({ code: "invalid-execution-row", message: "Execution evidence is not a string.", table: "executions", executionId });
      return null;
    }
    try {
      const parsed = JSON.parse(row.evidence_json) as unknown;
      if (!isRecord(parsed)) throw new Error("not an object");
      evidence = parsed;
    } catch {
      blockers.push({ code: "invalid-json", message: "Execution evidence is not valid JSON.", table: "executions", executionId, fieldPath: "evidence_json" });
      return null;
    }
  }

  const evidenceSource = evidence.source;
  const source: TradeExecution["source"] = isRecord(evidenceSource)
    ? cloneValue(evidenceSource) as TradeExecution["source"]
    : { platform: "unknown", row: 0 };

  const sourceWithLegacyRun = source as TradeExecution["source"] & { run?: unknown };
  const sourceTradeNaturePresent = source.tradeNature !== undefined;
  const sourceLegacyNaturePresent = source.tradingNature !== undefined;
  const sourceTradeNature = semanticTradeNature(source.tradeNature);
  const sourceLegacyNature = semanticTradeNature(source.tradingNature, true);
  const sqlNaturePresent = row.trade_nature !== null && row.trade_nature !== undefined;
  const sqlNature = semanticTradeNature(row.trade_nature, true);
  if (sourceTradeNaturePresent && sourceTradeNature === undefined) {
    addExecutionRowBlocker(blockers, executionId, "Execution evidence has an invalid source.tradeNature value.");
  }
  if (sourceLegacyNaturePresent && sourceLegacyNature === undefined) {
    addExecutionRowBlocker(blockers, executionId, "Execution evidence has an invalid source.tradingNature value.");
  }
  if (sqlNaturePresent && sqlNature === undefined) {
    addExecutionRowBlocker(blockers, executionId, "The executions.trade_nature value is invalid.");
  }
  if (sqlNature) {
    if (sourceTradeNature && sourceTradeNature !== sqlNature) {
      addExecutionRowBlocker(blockers, executionId, "The SQL trade_nature conflicts with evidence.source.tradeNature.");
    }
    if (sourceLegacyNature && sourceLegacyNature !== sqlNature) {
      addExecutionRowBlocker(blockers, executionId, "The SQL trade_nature conflicts with evidence.source.tradingNature.");
    }
    if (!sourceTradeNaturePresent && !sourceLegacyNaturePresent) {
      source.tradeNature = sqlNature;
    } else if (!sourceTradeNaturePresent && sourceLegacyNature === sqlNature) {
      source.tradeNature = sqlNature;
    }
  }

  const sourceSimulationRunId = source.simulationRunId;
  const sourceLegacyRun = sourceWithLegacyRun.run;
  const sourceSimulationRunPresent = sourceSimulationRunId !== undefined;
  const sourceLegacyRunPresent = sourceLegacyRun !== undefined;
  if (sourceSimulationRunPresent && typeof sourceSimulationRunId !== "string") {
    addExecutionRowBlocker(blockers, executionId, "Execution evidence has an invalid source.simulationRunId value.");
  }
  if (sourceLegacyRunPresent && typeof sourceLegacyRun !== "string") {
    addExecutionRowBlocker(blockers, executionId, "Execution evidence has an invalid source.run value.");
  }
  const sqlRunPresent = row.simulation_run_id !== null && row.simulation_run_id !== undefined;
  const sqlRun = typeof row.simulation_run_id === "string" ? row.simulation_run_id : undefined;
  if (sqlRunPresent && (sqlRun === undefined || sqlRun.trim() === "")) {
    addExecutionRowBlocker(blockers, executionId, "The executions.simulation_run_id value is invalid.");
  }
  if (sqlRun) {
    if (typeof sourceSimulationRunId === "string" && sourceSimulationRunId !== sqlRun) {
      addExecutionRowBlocker(blockers, executionId, "The SQL simulation_run_id conflicts with evidence.source.simulationRunId.");
    }
    if (typeof sourceLegacyRun === "string" && sourceLegacyRun !== sqlRun) {
      addExecutionRowBlocker(blockers, executionId, "The SQL simulation_run_id conflicts with evidence.source.run.");
    }
    if (!sourceSimulationRunPresent && !sourceLegacyRunPresent) {
      source.simulationRunId = sqlRun;
    }
  }

  const accountId = typeof row.account === "string" ? row.account : "";
  const platform = typeof source.platform === "string" ? source.platform.trim().toLowerCase() : "";
  const isCandidate = platform === "tradingview" || accountId.toLowerCase().startsWith("tradingview:");
  try {
    const execution: TradeExecution = {
      id: executionId,
      source,
      accountId,
      accountLabel: typeof evidence.accountLabel === "string" ? evidence.accountLabel : "",
      instrument: {
        id: requiredString(row, "instrument_id"),
        symbol: requiredString(row, "symbol"),
        name: requiredString(row, "name"),
        market: requiredString(row, "market"),
        currency: requiredString(row, "currency"),
      },
      side: requiredString(row, "side") as TradeExecution["side"],
      executedAt: requiredString(row, "executed_at"),
      quantity: requiredString(row, "quantity"),
      price: requiredString(row, "price"),
      fee: typeof row.fee === "string" ? row.fee : "",
    };
    return { execution, isCandidate };
  } catch {
    blockers.push({ code: "invalid-execution-row", message: "A candidate execution row is missing a required field.", table: "executions", executionId });
    return null;
  }
}

function episodeSnapshot(episode: TradeEpisode): TradingViewEpisodeSnapshot {
  const executionIds = episode.executions.map((execution) => execution.id);
  const executionRoles = Object.fromEntries(
    episode.executions.flatMap((execution) => execution.source.simulationRole
      ? [[execution.id, execution.source.simulationRole] as const]
      : []),
  );
  return {
    id: episode.id,
    accountId: episode.accountId,
    instrumentId: episode.instrument.id,
    direction: episode.direction,
    executionIds,
    ...(episode.tradeNature ? { tradeNature: episode.tradeNature } : {}),
    ...(episode.simulationRunId ? { simulationRunId: episode.simulationRunId } : {}),
    startedAt: episode.startedAt,
    ...(episode.endedAt ? { endedAt: episode.endedAt } : {}),
    ...(Object.keys(executionRoles).length ? { executionRoles } : {}),
    executionOrder: executionIds,
  };
}

function referencePrimaryKey(table: string, row: ReferenceRow): string {
  if (typeof row.key === "string") return row.key;
  if (typeof row.id === "string") return row.id;
  if ((table === "reviews" || table === "recall_documents") && typeof row.episode_id === "string") {
    return row.episode_id;
  }
  const composite = [
    "episode_id",
    "version_kind",
    "document_revision",
    "entity_id",
    "plan_entity_id",
    "bundle_id",
    "evaluation_entity_id",
    "evaluation_id",
    "decision_id",
    "execution_id",
    "ordinal",
  ].flatMap((key) => typeof row[key] === "string" || typeof row[key] === "number" ? [`${key}=${String(row[key])}`] : []);
  if (composite.length) return composite.join("|");
  if (typeof row.episode_id === "string") return row.episode_id;
  return `${table}:${digest(row).slice("sha256:".length)}`;
}

function fieldName(column: string): string {
  return JSON_COLUMNS.has(column) && column.endsWith("_json")
    ? column.slice(0, -"_json".length)
    : column;
}

function referenceFields(
  table: string,
  row: ReferenceRow,
  primaryKey: string,
  blockers: TradingViewSnapshotAdapterBlocker[],
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(row).map(([column, value]) => [
    fieldName(column),
    JSON_COLUMNS.has(column)
      ? parseJsonColumn(value, table, primaryKey, column, blockers)
      : cloneValue(value),
  ]));
}

function encodedVariants(value: string): string[] {
  const variants = [value];
  let encoded = value;
  for (let depth = 0; depth < 2; depth += 1) {
    encoded = encodeURIComponent(encoded);
    variants.push(encoded, encoded.toLowerCase(), encoded.toUpperCase());
  }
  return [...new Set(variants)];
}

function containsIdentity(value: string, identities: readonly string[]): boolean {
  for (const identity of identities) {
    if (encodedVariants(identity).some((variant) => value.includes(variant))) return true;
    let decoded = value;
    for (let depth = 0; depth < 2; depth += 1) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        break;
      }
      if (decoded.includes(identity)) return true;
    }
  }
  return false;
}

function rowContainsIdentity(
  row: ReferenceRow,
  identities: readonly string[],
): boolean {
  const scan = (value: unknown): boolean => {
    if (typeof value === "string") return containsIdentity(value, identities);
    if (Array.isArray(value)) return value.some(scan);
    if (isRecord(value)) return Object.entries(value).some(([key, child]) => containsIdentity(key, identities) || scan(child));
    return false;
  };
  return Object.entries(row).some(([column, value]) => {
    if (scan(value)) return true;
    if (!JSON_COLUMNS.has(column) || typeof value !== "string") return false;
    try {
      return scan(JSON.parse(value) as unknown);
    } catch {
      return false;
    }
  });
}

function rawRowsDigest(rows: readonly ReferenceRow[]): string {
  return digest([...rows].map(cloneValue).sort((left, right) => stableSerialize(left).localeCompare(stableSerialize(right))));
}

function snapshotDigest(snapshot: TradingViewAccountMigrationSnapshot): string {
  return digest({
    executions: [...snapshot.executions].sort((left, right) => left.id.localeCompare(right.id)),
    oldEpisodes: [...snapshot.oldEpisodes].sort((left, right) => left.id.localeCompare(right.id)),
    newEpisodes: [...snapshot.newEpisodes].sort((left, right) => left.id.localeCompare(right.id)),
    references: [...(snapshot.references ?? [])].sort((left, right) => `${left.table}\u0000${left.primaryKey}`.localeCompare(`${right.table}\u0000${right.primaryKey}`)),
    canonicalAccountOccupancy: snapshot.canonicalAccountOccupancy,
    existingProvisionals: snapshot.existingProvisionals,
  });
}

function canonicalOccupancy(executions: readonly TradeExecution[]): TradingViewCanonicalAccountOccupancySnapshot[] {
  const rows = new Map<string, TradingViewCanonicalAccountOccupancySnapshot>();
  for (const execution of executions) {
    if (execution.accountId !== TRADINGVIEW_CANONICAL_ACCOUNT_ID) continue;
    const key = `${execution.accountId}\u0000${execution.source.platform}\u0000${tradeNatureOf(execution)}`;
    const existing = rows.get(key);
    if (existing) {
      existing.executionIds = [...(existing.executionIds ?? []), execution.id];
      continue;
    }
    rows.set(key, {
      accountId: execution.accountId,
      platform: execution.source.platform,
      tradeNature: tradeNatureOf(execution),
      executionIds: [execution.id],
    });
  }
  return [...rows.values()].map((row) => ({ ...row, executionIds: [...(row.executionIds ?? [])].sort() }));
}

function readRows<T extends ReadonlySqliteRow>(
  reader: ReadonlySqliteRows,
  sql: string,
  table: string,
  blockers: TradingViewSnapshotAdapterBlocker[],
): readonly T[] {
  try {
    return reader.all<T>(sql);
  } catch {
    blockers.push({ code: "table-read-error", message: `Read-only scan of ${table} failed.`, table });
    return [];
  }
}

export function buildTradingViewAccountMigrationSnapshot(
  reader: ReadonlySqliteRows,
): TradingViewSnapshotAdapterResult {
  const blockers: TradingViewSnapshotAdapterBlocker[] = [];
  const executionRows = readRows<ExecutionRow>(reader, EXECUTIONS_SQL, "executions", blockers);
  const mappedExecutions = executionRows.flatMap((row) => {
    const mapped = sourceFromEvidence(row, blockers);
    return mapped ? [mapped] : [];
  });
  const candidateExecutions = mappedExecutions.filter((item) => item.isCandidate).map((item) => item.execution);
  const eligibleExecutions: TradeExecution[] = [];
  for (const execution of candidateExecutions) {
    const classification = classifyTradingViewExecution(execution);
    if (classification.eligible) {
      eligibleExecutions.push(execution);
      continue;
    }
    blockers.push({
      code: "invalid-execution-row",
      message: `Candidate execution ${execution.id} is not an eligible TradingView simulation row (${classification.code}).`,
      table: "executions",
      executionId: execution.id,
    });
  }

  let oldEpisodes: TradingViewEpisodeSnapshot[] = [];
  try {
    oldEpisodes = buildTradeEpisodes(eligibleExecutions).map(episodeSnapshot);
  } catch {
    blockers.push({ code: "invalid-execution-row", message: "The eligible executions could not be constructed into domain episodes.", table: "executions" });
  }

  const sourceRuns = [...new Set(eligibleExecutions.flatMap((execution) => {
    const run = tradingViewSourceRun(execution);
    return run ? [run] : [];
  }))].sort();

  const canonicalExecutions = eligibleExecutions.flatMap((execution) => {
    const canonical = canonicalizeTradingViewExecution(execution);
    return canonical ? [canonical] : [];
  });
  let newEpisodes: TradingViewEpisodeSnapshot[] = [];
  if (canonicalExecutions.length !== eligibleExecutions.length) {
    blockers.push({
      code: "invalid-execution-row",
      message: "The canonical shadow did not preserve the eligible execution set.",
      table: "executions",
    });
  } else {
    try {
      newEpisodes = buildTradeEpisodes(canonicalExecutions).map(episodeSnapshot);
    } catch {
      blockers.push({ code: "invalid-execution-row", message: "The canonical executions could not be constructed into domain episodes.", table: "episodes" });
    }
  }

  const oldAccounts = [...new Set(eligibleExecutions.map((execution) => execution.accountId))];
  const identityNeedles = [...new Set([...oldAccounts, ...oldEpisodes.map((episode) => episode.id), ...sourceRuns])];
  const references: TradingViewMigrationReferenceSnapshot[] = [];
  const scans: TradingViewSnapshotTableScan[] = [{
    table: "executions",
    scanned: executionRows.length,
    included: candidateExecutions.length,
    digest: rawRowsDigest(executionRows),
  }];
  for (const table of REFERENCE_TABLES) {
    const rows = readRows<ReferenceRow>(reader, `select * from ${table}`, table, blockers);
    const includedRows = rows.filter((row) => rowContainsIdentity(row, identityNeedles));
    scans.push({ table, scanned: rows.length, included: includedRows.length, digest: rawRowsDigest(rows) });
    for (const row of includedRows) {
      const primaryKey = referencePrimaryKey(table, row);
      references.push({
        table,
        primaryKey,
        owner: table,
        fields: referenceFields(table, row, primaryKey, blockers),
      });
    }
  }

  const snapshot: TradingViewAccountMigrationSnapshot = {
    // Keep candidate rows in the pure snapshot so the frozen planner can
    // classify live/unknown/platform-mismatched rows itself. Domain episodes
    // below are built only from the eligible subset.
    executions: candidateExecutions,
    oldEpisodes,
    newEpisodes,
    references,
    canonicalAccountOccupancy: canonicalOccupancy(mappedExecutions.map((item) => item.execution)),
    existingProvisionals: [],
  };
  return {
    snapshot,
    blockers: [...blockers].sort((left, right) => stableSerialize(left).localeCompare(stableSerialize(right))),
    snapshotDigest: snapshotDigest(snapshot),
    scans,
    domain: {
      oldEpisodes: oldEpisodes.length,
      newEpisodes: newEpisodes.length,
      sourceRuns,
      newEpisodeInterface: "required",
    },
  };
}

export const readTradingViewAccountMigrationSnapshot = buildTradingViewAccountMigrationSnapshot;

/** Decimal conservation helper for read-only reports; it never mutates rows. */
export function tradingViewSnapshotTotals(snapshot: TradingViewAccountMigrationSnapshot): { quantity: string; fee: string } {
  const eligible = snapshot.executions.filter((execution) => classifyTradingViewExecution(execution).eligible);
  const sum = (values: readonly string[]) => values.reduce((total, value) => total.plus(new Decimal(value)), new Decimal(0)).toFixed();
  return {
    quantity: sum(eligible.map((execution) => new Decimal(execution.quantity).abs().toString())),
    fee: sum(eligible.map((execution) => execution.fee)),
  };
}
