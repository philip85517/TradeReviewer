import Decimal from "decimal.js";

import { sha256 } from "../recall/retained-digest";
import type { TradeExecution, TradeNature } from "../trades/types";
import {
  classifyTradingViewExecution,
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
  TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
  tradingViewSourceRun,
} from "../trades/tradingview-account-identity";

export type TradingViewEpisodeSnapshot = {
  id: string;
  accountId: string;
  instrumentId: string;
  direction: "long" | "short";
  executionIds: readonly string[];
  tradeNature?: TradeNature;
  simulationRunId?: string;
  startedAt?: string;
  endedAt?: string;
  executionRoles?: Readonly<Record<string, "entry" | "exit">>;
  executionOrder?: readonly string[];
};

export type TradingViewMigrationReferenceSnapshot = {
  table: string;
  primaryKey: string;
  fields: Readonly<Record<string, unknown>>;
  owner?: string;
};

export type TradingViewCanonicalAccountOccupancySnapshot = {
  accountId: string;
  platform: string;
  tradeNature: TradeNature;
  executionIds?: readonly string[];
};

export type TradingViewPrincipalSnapshot = {
  accountId: string;
  currency: string;
  amount: string;
  asOf: string | null;
  status: "provisional" | "confirmed";
  source: string;
  revision: number;
};

/** Pure input data. The planner never obtains a database connection or writes a snapshot. */
export type TradingViewAccountMigrationSnapshot = {
  executions: readonly TradeExecution[];
  oldEpisodes: readonly TradingViewEpisodeSnapshot[];
  newEpisodes: readonly TradingViewEpisodeSnapshot[];
  references?: readonly TradingViewMigrationReferenceSnapshot[];
  canonicalAccountOccupancy?: readonly TradingViewCanonicalAccountOccupancySnapshot[];
  existingProvisionals?: readonly TradingViewPrincipalSnapshot[];
};

export type TradingViewMigrationBlockerCode =
  | "duplicate-execution-id"
  | "invalid-decimal"
  | "live-execution"
  | "unknown-nature"
  | "nature-conflict"
  | "platform-mismatch"
  | "missing-account-id"
  | "missing-source-run"
  | "source-run-conflict"
  | "canonical-account-conflict"
  | "ambiguous-episode"
  | "unknown-reference"
  | "principal-conflict";

export type TradingViewMigrationBlocker = {
  code: TradingViewMigrationBlockerCode;
  message: string;
  executionId?: string;
  oldEpisodeId?: string;
  newEpisodeId?: string;
  table?: string;
  primaryKey?: string;
  fieldPath?: string;
  owner?: string;
};

export type TradingViewExecutionMigrationPlanRow = {
  executionId: string;
  beforeAccountId: string;
  afterAccountId: typeof TRADINGVIEW_CANONICAL_ACCOUNT_ID;
  beforeAccountLabel: string;
  afterAccountLabel: typeof TRADINGVIEW_CANONICAL_ACCOUNT_LABEL;
  sourceRunId: string;
  originalSourceFingerprint?: string;
  originalSourceRow: number;
  originalSourceTradeId?: string;
  executedAt: string;
  side: TradeExecution["side"];
  instrumentId: string;
  quantity: string;
  price: string;
  fee: string;
  originalQuantity: string;
  originalPrice: string;
  originalFee: string;
  originalGrossAmount?: string;
  beforeDigest: string;
  afterDigest: string;
  before: {
    accountId: string;
    accountLabel: string;
    sourceRunId: string;
    sourceFingerprint?: string;
    sourceRow: number;
  };
  after: {
    accountId: typeof TRADINGVIEW_CANONICAL_ACCOUNT_ID;
    accountLabel: typeof TRADINGVIEW_CANONICAL_ACCOUNT_LABEL;
    sourceRunId: string;
    sourceFingerprint?: string;
    sourceRow: number;
  };
};

export type TradingViewEpisodeMigrationMapRow = {
  oldEpisodeId: string;
  newEpisodeId: string;
  accountId: typeof TRADINGVIEW_CANONICAL_ACCOUNT_ID;
  instrumentId: string;
  direction: TradingViewEpisodeSnapshot["direction"];
  executionIds: string[];
  sourceRunId?: string;
  beforeDigest: string;
  afterDigest: string;
};

export type TradingViewReferenceMigrationPlanRow = {
  table: string;
  primaryKey: string;
  owner?: string;
  status: "mapped" | "preserved" | "blocked";
  before: Readonly<Record<string, unknown>>;
  after: Readonly<Record<string, unknown>>;
  beforeDigest: string;
  afterDigest: string;
};

export type TradingViewProvisionalPrincipalPlan = {
  action: "create-if-absent" | "no-op" | "conflict";
  accountId: typeof TRADINGVIEW_CANONICAL_ACCOUNT_ID;
  currency: "CNY";
  amount: "100000";
  asOf: null;
  status: "provisional";
  source: "user-default";
  revision?: number;
};

export type TradingViewMigrationCounts = {
  executions: number;
  oldAccounts: number;
  sourceRuns: number;
  instruments: number;
  reviews: number;
  recallRows: number;
  settingsRows: number;
  quantity: string;
  fee: string;
};

export type TradingViewMigrationConservation = {
  executionIdsBefore: string[];
  executionIdsAfter: string[];
  executionIdsPreserved: boolean;
  sourceRunsBefore: string[];
  sourceRunsAfter: string[];
  sourceRunsPreserved: boolean;
  quantityBefore: string;
  quantityAfter: string;
  feeBefore: string;
  feeAfter: string;
};

export type TradingViewAccountMigrationPlan = {
  status: "ready" | "blocked";
  canonicalAccountId: typeof TRADINGVIEW_CANONICAL_ACCOUNT_ID;
  canonicalAccountLabel: typeof TRADINGVIEW_CANONICAL_ACCOUNT_LABEL;
  baseSnapshotDigest: string;
  planDigest: string;
  counts: TradingViewMigrationCounts;
  executionPlan: TradingViewExecutionMigrationPlanRow[];
  episodeMap: TradingViewEpisodeMigrationMapRow[];
  referencePlan: TradingViewReferenceMigrationPlanRow[];
  browserStatePlan: TradingViewReferenceMigrationPlanRow[];
  provisionalPrincipal: TradingViewProvisionalPrincipalPlan;
  conservation: TradingViewMigrationConservation;
  blockers: TradingViewMigrationBlocker[];
};

type IdentityMapping = { kind: "account" | "episode"; before: string; after: string };
type ReferenceWalkResult = { value: unknown; changed: boolean; preserved: boolean };

const ACCOUNT_KEYS = new Set(["accountid", "account_id", "accountids", "account_ids"]);
const EPISODE_KEYS = new Set(["episodeid", "episode_id", "episodeids", "episode_ids"]);
const RUN_KEYS = new Set(["simulationrunid", "simulation_run_id", "run", "simulationrunids", "simulation_run_ids"]);
const SCOPE_KEYS = new Set(["scopeid", "scope_id"]);
const PRESERVED_SUBTREES = new Set([
  "audit",
  "evidence",
  "historicalevidence",
  "originalsource",
  "rawsource",
  "request",
  "retainedevidence",
  "source",
]);

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Migration plan cannot serialize a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().flatMap((key) => record[key] === undefined ? [] : [`${JSON.stringify(key)}:${stableSerialize(record[key])}`]).join(",")}}`;
  }
  throw new Error("Migration plan cannot serialize this value");
}

function digest(value: unknown): string {
  return `sha256:${sha256(stableSerialize(value))}`;
}

function decimal(value: string): Decimal {
  if (typeof value !== "string" || value.trim() === "") throw new Error("empty decimal");
  const parsed = new Decimal(value);
  if (!parsed.isFinite()) throw new Error("non-finite decimal");
  return parsed;
}

function decimalString(value: string): string {
  return decimal(value).toFixed();
}

function sumDecimal(values: readonly string[], absolute = false): string {
  return values.reduce((total, value) => total.plus(absolute ? decimal(value).abs() : decimal(value)), new Decimal(0)).toFixed();
}

function sorted<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...values].sort((a, b) => key(a).localeCompare(key(b)));
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function episodeExecutionIds(episode: TradingViewEpisodeSnapshot): string[] {
  return [...episode.executionIds].sort((a, b) => a.localeCompare(b));
}

function sourceProjection(execution: TradeExecution, quantity: string, price: string, fee: string) {
  return {
    id: execution.id,
    accountId: execution.accountId,
    accountLabel: execution.accountLabel,
    instrument: execution.instrument,
    side: execution.side,
    executedAt: execution.executedAt,
    quantity,
    price,
    fee,
    source: execution.source,
  };
}

function normalizeExecution(execution: TradeExecution) {
  try {
    return sourceProjection(execution, decimalString(execution.quantity), decimalString(execution.price), decimalString(execution.fee));
  } catch {
    return {
      id: execution.id,
      accountId: execution.accountId,
      accountLabel: execution.accountLabel,
      instrument: execution.instrument,
      side: execution.side,
      executedAt: execution.executedAt,
      quantity: execution.quantity,
      price: execution.price,
      fee: execution.fee,
      source: execution.source,
    };
  }
}

function normalizeEpisode(episode: TradingViewEpisodeSnapshot) {
  return {
    ...episode,
    executionIds: episodeExecutionIds(episode),
    executionRoles: episode.executionRoles ? Object.fromEntries(Object.entries(episode.executionRoles).sort(([a], [b]) => a.localeCompare(b))) : undefined,
  };
}

function baseSnapshotProjection(snapshot: TradingViewAccountMigrationSnapshot): unknown {
  return {
    executions: sorted(snapshot.executions, (item) => item.id).map(normalizeExecution),
    oldEpisodes: sorted(snapshot.oldEpisodes, (item) => item.id).map(normalizeEpisode),
    newEpisodes: sorted(snapshot.newEpisodes, (item) => item.id).map(normalizeEpisode),
    references: sorted(snapshot.references ?? [], (item) => `${item.table}\u0000${item.primaryKey}`).map((item) => ({ ...item, fields: item.fields })),
    canonicalAccountOccupancy: sorted(snapshot.canonicalAccountOccupancy ?? [], (item) => item.accountId).map((item) => ({
      ...item,
      ...(item.executionIds ? { executionIds: [...item.executionIds].sort((a, b) => a.localeCompare(b)) } : {}),
    })),
    existingProvisionals: sorted(snapshot.existingProvisionals ?? [], (item) => `${item.accountId}\u0000${item.revision}`),
  };
}

function addBlocker(blockers: TradingViewMigrationBlocker[], blocker: TradingViewMigrationBlocker) {
  blockers.push(blocker);
}

function validateCanonicalOccupancy(
  snapshot: TradingViewAccountMigrationSnapshot,
  targetExecutionIds: ReadonlySet<string>,
  blockers: TradingViewMigrationBlocker[],
) {
  for (const row of snapshot.canonicalAccountOccupancy ?? []) {
    if (row.accountId !== TRADINGVIEW_CANONICAL_ACCOUNT_ID) continue;
    if (row.platform.trim().toLowerCase() !== "tradingview" || row.tradeNature !== "simulation") {
      addBlocker(blockers, {
        code: "canonical-account-conflict",
        message: "The canonical account is already occupied by a non-TradingView or non-simulation record.",
      });
    }
    for (const executionId of row.executionIds ?? []) {
      if (targetExecutionIds.has(executionId)) continue;
      addBlocker(blockers, {
        code: "canonical-account-conflict",
        message: "Canonical account occupancy references an execution outside the migration snapshot.",
        executionId,
      });
    }
  }
}

function optionalSame<T>(left: T | undefined, right: T | undefined): boolean {
  return left === undefined || right === undefined || left === right;
}

function episodeCandidates(oldEpisode: TradingViewEpisodeSnapshot, newEpisodes: readonly TradingViewEpisodeSnapshot[]) {
  const oldIds = episodeExecutionIds(oldEpisode);
  return newEpisodes.filter((candidate) => {
    if (candidate.accountId !== TRADINGVIEW_CANONICAL_ACCOUNT_ID) return false;
    if (candidate.instrumentId !== oldEpisode.instrumentId || candidate.direction !== oldEpisode.direction) return false;
    if (stableSerialize(episodeExecutionIds(candidate)) !== stableSerialize(oldIds)) return false;
    if (!optionalSame(oldEpisode.tradeNature, candidate.tradeNature)) return false;
    if (!optionalSame(oldEpisode.simulationRunId, candidate.simulationRunId)) return false;
    if (oldEpisode.executionOrder && candidate.executionOrder && stableSerialize(oldEpisode.executionOrder) !== stableSerialize(candidate.executionOrder)) return false;
    if (oldEpisode.executionRoles && candidate.executionRoles && stableSerialize(oldEpisode.executionRoles) !== stableSerialize(candidate.executionRoles)) return false;
    return true;
  });
}

function mapEpisodes(
  snapshot: TradingViewAccountMigrationSnapshot,
  targetExecutionIds: ReadonlySet<string>,
  targetExecutions: ReadonlyMap<string, TradeExecution>,
  blockers: TradingViewMigrationBlocker[],
): { rows: TradingViewEpisodeMigrationMapRow[]; map: Map<string, string> } {
  const rows: TradingViewEpisodeMigrationMapRow[] = [];
  const map = new Map<string, string>();
  const oldEpisodes = sorted(snapshot.oldEpisodes, (item) => item.id);
  const newEpisodes = sorted(snapshot.newEpisodes, (item) => item.id);
  const usedNewIds = new Set<string>();
  const oldIds = new Set<string>();
  const newExecutionOwner = new Map<string, string>();

  for (const episode of oldEpisodes) {
    if (oldIds.has(episode.id)) {
      addBlocker(blockers, { code: "ambiguous-episode", message: "The same old episode ID occurs more than once.", oldEpisodeId: episode.id });
    }
    oldIds.add(episode.id);
    const ids = episodeExecutionIds(episode);
    if (ids.some((id) => !targetExecutionIds.has(id))) {
      addBlocker(blockers, { code: "ambiguous-episode", message: "An old episode references an execution outside the eligible target set.", oldEpisodeId: episode.id });
      continue;
    }
    const mismatchedExecution = ids.find((id) => {
      const execution = targetExecutions.get(id);
      if (!execution) return true;
      if (execution.accountId !== episode.accountId || execution.instrument.id !== episode.instrumentId) return true;
      if (episode.tradeNature !== undefined && episode.tradeNature !== "simulation") return true;
      return episode.simulationRunId !== undefined && tradingViewSourceRun(execution) !== episode.simulationRunId;
    });
    if (mismatchedExecution) {
      addBlocker(blockers, {
        code: "ambiguous-episode",
        message: "An old episode identity does not match the account, instrument, nature, or source run of its executions.",
        oldEpisodeId: episode.id,
      });
      continue;
    }
    if (new Set(ids).size !== ids.length) {
      addBlocker(blockers, { code: "ambiguous-episode", message: "An old episode contains duplicate execution IDs.", oldEpisodeId: episode.id });
    }
    const candidates = episodeCandidates(episode, newEpisodes);
    if (candidates.length !== 1) {
      addBlocker(blockers, {
        code: "ambiguous-episode",
        message: candidates.length === 0 ? "No exact new episode matches the old execution set." : "More than one new episode matches the old execution set.",
        oldEpisodeId: episode.id,
        ...(candidates[0] ? { newEpisodeId: candidates[0].id } : {}),
      });
      continue;
    }
    const candidate = candidates[0];
    if (usedNewIds.has(candidate.id)) {
      addBlocker(blockers, {
        code: "ambiguous-episode",
        message: "Multiple old episodes map to one new episode.",
        oldEpisodeId: episode.id,
        newEpisodeId: candidate.id,
      });
      continue;
    }
    if (ids.some((id) => newExecutionOwner.has(id))) {
      addBlocker(blockers, {
        code: "ambiguous-episode",
        message: "An execution ID is assigned to more than one episode.",
        oldEpisodeId: episode.id,
        newEpisodeId: candidate.id,
      });
      continue;
    }
    usedNewIds.add(candidate.id);
    for (const id of ids) newExecutionOwner.set(id, episode.id);
    map.set(episode.id, candidate.id);
    const before = normalizeEpisode(episode);
    const after = { ...normalizeEpisode(candidate), accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID };
    rows.push({
      oldEpisodeId: episode.id,
      newEpisodeId: candidate.id,
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      instrumentId: episode.instrumentId,
      direction: episode.direction,
      executionIds: ids,
      ...(episode.simulationRunId ? { sourceRunId: episode.simulationRunId } : candidate.simulationRunId ? { sourceRunId: candidate.simulationRunId } : {}),
      beforeDigest: digest(before),
      afterDigest: digest(after),
    });
  }

  for (const episode of newEpisodes) {
    const ids = episodeExecutionIds(episode);
    if (!ids.some((id) => targetExecutionIds.has(id))) continue;
    if (!usedNewIds.has(episode.id)) {
      addBlocker(blockers, {
        code: "ambiguous-episode",
        message: "A target execution set is present in a new episode without an exact old-episode mapping.",
        newEpisodeId: episode.id,
      });
    }
  }

  const oldCoverage = new Map<string, number>();
  for (const episode of oldEpisodes) for (const id of episodeExecutionIds(episode)) if (targetExecutionIds.has(id)) oldCoverage.set(id, (oldCoverage.get(id) ?? 0) + 1);
  const newCoverage = new Map<string, number>();
  for (const episode of newEpisodes) for (const id of episodeExecutionIds(episode)) if (targetExecutionIds.has(id)) newCoverage.set(id, (newCoverage.get(id) ?? 0) + 1);
  for (const executionId of [...targetExecutionIds].sort((a, b) => a.localeCompare(b))) {
    if ((oldCoverage.get(executionId) ?? 0) !== 1 || (newCoverage.get(executionId) ?? 0) !== 1) {
      addBlocker(blockers, {
        code: "ambiguous-episode",
        message: "Every eligible execution must occur in exactly one old and one new episode.",
      });
    }
  }

  return { rows: rows.sort((a, b) => a.oldEpisodeId.localeCompare(b.oldEpisodeId)), map };
}

function encodedIdentity(value: string, mapping: IdentityMapping): { value: string; exact: boolean } | null {
  if (value === mapping.before) return { value: mapping.after, exact: true };
  let encoded = mapping.before;
  for (let depth = 1; depth <= 2; depth += 1) {
    encoded = encodeURIComponent(encoded);
    if (value === encoded) {
      let replacement = mapping.after;
      for (let index = 0; index < depth; index += 1) replacement = encodeURIComponent(replacement);
      return { value: replacement, exact: true };
    }
  }
  try {
    let decoded = value;
    for (let depth = 0; depth < 2; depth += 1) {
      decoded = decodeURIComponent(decoded);
      if (decoded === mapping.before) return { value: mapping.after, exact: true };
    }
  } catch {
    // An invalid percent sequence is not an identity match.
  }
  return null;
}

function encodedTarget(value: string, target: string): boolean {
  if (value === target) return true;
  let encoded = target;
  for (let depth = 1; depth <= 2; depth += 1) {
    encoded = encodeURIComponent(encoded);
    if (value === encoded) return true;
  }
  try {
    let decoded = value;
    for (let depth = 0; depth < 2; depth += 1) {
      decoded = decodeURIComponent(decoded);
      if (decoded === target) return true;
    }
  } catch {
    // An invalid percent sequence is not a canonical identity.
  }
  return false;
}

function identityHit(value: string, mappings: readonly IdentityMapping[]): IdentityMapping | null {
  for (const mapping of mappings) {
    if (encodedIdentity(value, mapping)) return mapping;
    let encoded = mapping.before;
    if (value.includes(mapping.before)) return mapping;
    for (let depth = 1; depth <= 2; depth += 1) {
      encoded = encodeURIComponent(encoded);
      if (value.includes(encoded)) return mapping;
    }
    let decoded = value;
    for (let depth = 0; depth < 2; depth += 1) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        break;
      }
      if (decoded.includes(mapping.before)) return mapping;
    }
  }
  return null;
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, cloneValue(child)]));
  return value;
}

function keyName(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
}

function isPreservedSubtree(key: string): boolean {
  return PRESERVED_SUBTREES.has(keyName(key));
}

function walkReferenceValue(
  value: unknown,
  key: string,
  path: string,
  accountMappings: readonly IdentityMapping[],
  episodeMappings: readonly IdentityMapping[],
  allMappings: readonly IdentityMapping[],
  blockers: TradingViewMigrationBlocker[],
  owner: string | undefined,
): ReferenceWalkResult {
  const normalizedKey = keyName(key);
  if (isPreservedSubtree(key)) return { value: cloneValue(value), changed: false, preserved: true };

  const mappings = ACCOUNT_KEYS.has(normalizedKey)
    ? accountMappings
    : EPISODE_KEYS.has(normalizedKey)
      ? episodeMappings
      : SCOPE_KEYS.has(normalizedKey)
        ? [...accountMappings, ...episodeMappings]
        : [];
  const recognized = ACCOUNT_KEYS.has(normalizedKey) || EPISODE_KEYS.has(normalizedKey) || SCOPE_KEYS.has(normalizedKey) || RUN_KEYS.has(normalizedKey);

  if (Array.isArray(value)) {
    let changed = false;
    let preserved = false;
    const next = value.map((child, index) => {
      const result = walkReferenceValue(child, key, `${path}[${index}]`, accountMappings, episodeMappings, allMappings, blockers, owner);
      changed ||= result.changed;
      preserved ||= result.preserved;
      return result.value;
    });
    return { value: next, changed, preserved };
  }
  if (value && typeof value === "object") {
    let changed = false;
    let preserved = false;
    const next: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      const hitInKey = identityHit(childKey, allMappings);
      if (hitInKey) {
        addBlocker(blockers, {
          code: "unknown-reference",
          message: "An old account or episode identity occurs in an unknown JSON key.",
          fieldPath: `${path}.${childKey}`,
          owner: owner ?? "unassigned",
        });
      }
      const result = walkReferenceValue(child, childKey, `${path}.${childKey}`, accountMappings, episodeMappings, allMappings, blockers, owner);
      changed ||= result.changed;
      preserved ||= result.preserved;
      next[childKey] = result.value;
    }
    return { value: next, changed, preserved };
  }
  if (typeof value !== "string") return { value, changed: false, preserved: false };
  if (RUN_KEYS.has(normalizedKey)) return { value, changed: false, preserved: true };

  if (recognized) {
    if (mappings.length === 0) return { value, changed: false, preserved: false };
    const match = mappings.map((mapping) => ({ mapping, result: encodedIdentity(value, mapping) })).find((item) => item.result);
    if (match?.result) return { value: match.result.value, changed: match.result.value !== value, preserved: false };
    if (mappings.some((mapping) => encodedTarget(value, mapping.after))) return { value, changed: false, preserved: true };
    if (identityHit(value, allMappings) || (ACCOUNT_KEYS.has(normalizedKey) || EPISODE_KEYS.has(normalizedKey)) && value.trim() !== "") {
      addBlocker(blockers, {
        code: "unknown-reference",
        message: "A whitelisted account or episode reference has no exact mapping.",
        fieldPath: path,
        owner: owner ?? "unassigned",
      });
    }
    return { value, changed: false, preserved: false };
  }

  const hit = identityHit(value, allMappings);
  if (hit) {
    addBlocker(blockers, {
      code: "unknown-reference",
      message: "An old account or episode identity occurs under an unknown JSON key; mapping is blocked.",
      fieldPath: path,
      owner: owner ?? "unassigned",
    });
  }
  return { value, changed: false, preserved: false };
}

function mapReference(
  row: TradingViewMigrationReferenceSnapshot,
  accountMappings: readonly IdentityMapping[],
  episodeMappings: readonly IdentityMapping[],
  blockers: TradingViewMigrationBlocker[],
): TradingViewReferenceMigrationPlanRow {
  const rowBlockerCount = blockers.length;
  const allMappings = [...accountMappings, ...episodeMappings];
  const walked = walkReferenceValue(row.fields, "", "$", accountMappings, episodeMappings, allMappings, blockers, row.owner);
  const blocked = blockers.length > rowBlockerCount;
  for (const blocker of blockers.slice(rowBlockerCount)) {
    blocker.table ??= row.table;
    blocker.primaryKey ??= row.primaryKey;
  }
  const before = cloneValue(row.fields) as Readonly<Record<string, unknown>>;
  const after = walked.value as Readonly<Record<string, unknown>>;
  const beforeDigest = digest(before);
  const afterDigest = digest(after);
  return {
    table: row.table,
    primaryKey: row.primaryKey,
    ...(row.owner ? { owner: row.owner } : {}),
    status: blocked ? "blocked" : walked.changed ? "mapped" : "preserved",
    before,
    after,
    beforeDigest,
    afterDigest,
  };
}

function principalPlan(
  existing: readonly TradingViewPrincipalSnapshot[],
  blockers: TradingViewMigrationBlocker[],
): TradingViewProvisionalPrincipalPlan {
  const target: TradingViewProvisionalPrincipalPlan = {
    action: "create-if-absent",
    accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
    currency: "CNY",
    amount: "100000",
    asOf: null,
    status: "provisional",
    source: "user-default",
  };
  if (existing.length === 0) return target;
  if (existing.length !== 1) {
    addBlocker(blockers, { code: "principal-conflict", message: "More than one provisional principal record is present for this preview." });
    return { ...target, action: "conflict" };
  }
  const record = existing[0];
  let amount = "";
  try { amount = decimalString(record.amount); } catch { /* handled as a conflict below */ }
  const matches = record.accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID
    && record.currency.trim().toUpperCase() === "CNY"
    && amount === "100000"
    && record.asOf === null
    && record.status === "provisional"
    && record.source === "user-default";
  if (matches) return { ...target, action: "no-op", revision: record.revision };
  addBlocker(blockers, { code: "principal-conflict", message: "The existing principal differs from the one-account provisional principal contract." });
  return { ...target, action: "conflict" };
}

function executionPlanRow(
  execution: TradeExecution,
  sourceRunId: string,
  blockers: TradingViewMigrationBlocker[],
): TradingViewExecutionMigrationPlanRow | null {
  let quantity: string;
  let price: string;
  let fee: string;
  try {
    quantity = decimalString(execution.quantity);
    price = decimalString(execution.price);
    fee = decimalString(execution.fee);
  } catch {
    addBlocker(blockers, { code: "invalid-decimal", message: "Execution quantity, price, or fee is not a finite decimal string.", executionId: execution.id });
    return null;
  }
  const beforeDigest = digest(normalizeExecution(execution));
  const afterDigest = digest(normalizeExecution({
    ...execution,
    accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
    accountLabel: TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
  }));
  const grossAmount = typeof execution.source.grossAmount === "string" ? execution.source.grossAmount : undefined;
  return {
    executionId: execution.id,
    beforeAccountId: execution.accountId,
    afterAccountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
    beforeAccountLabel: execution.accountLabel,
    afterAccountLabel: TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
    sourceRunId,
    ...(execution.source.fileFingerprint ? { originalSourceFingerprint: execution.source.fileFingerprint } : {}),
    originalSourceRow: execution.source.row,
    ...(execution.source.sourceTradeId ? { originalSourceTradeId: execution.source.sourceTradeId } : {}),
    executedAt: execution.executedAt,
    side: execution.side,
    instrumentId: execution.instrument.id,
    quantity,
    price,
    fee,
    originalQuantity: execution.quantity,
    originalPrice: execution.price,
    originalFee: execution.fee,
    ...(grossAmount ? { originalGrossAmount: grossAmount } : {}),
    beforeDigest,
    afterDigest,
    before: {
      accountId: execution.accountId,
      accountLabel: execution.accountLabel,
      sourceRunId,
      ...(execution.source.fileFingerprint ? { sourceFingerprint: execution.source.fileFingerprint } : {}),
      sourceRow: execution.source.row,
    },
    after: {
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      accountLabel: TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
      sourceRunId,
      ...(execution.source.fileFingerprint ? { sourceFingerprint: execution.source.fileFingerprint } : {}),
      sourceRow: execution.source.row,
    },
  };
}

function stripPlanFormatting(plan: TradingViewAccountMigrationPlan): unknown {
  return {
    status: plan.status,
    canonicalAccountId: plan.canonicalAccountId,
    canonicalAccountLabel: plan.canonicalAccountLabel,
    counts: plan.counts,
    executionPlan: plan.executionPlan.map((row) => ({
      ...row,
      originalQuantity: undefined,
      originalPrice: undefined,
      originalFee: undefined,
      originalGrossAmount: undefined,
    })),
    episodeMap: plan.episodeMap,
    referencePlan: plan.referencePlan,
    browserStatePlan: plan.browserStatePlan,
    provisionalPrincipal: plan.provisionalPrincipal,
    conservation: plan.conservation,
    blockers: plan.blockers,
  };
}

export function buildTradingViewAccountMigrationPlan(snapshot: TradingViewAccountMigrationSnapshot): TradingViewAccountMigrationPlan {
  const blockers: TradingViewMigrationBlocker[] = [];
  const baseSnapshotDigest = digest(baseSnapshotProjection(snapshot));

  const executions = sorted(snapshot.executions, (item) => item.id);
  const seenExecutionIds = new Set<string>();
  const targetExecutions: Array<{ execution: TradeExecution; sourceRunId: string }> = [];
  for (const execution of executions) {
    if (seenExecutionIds.has(execution.id)) {
      addBlocker(blockers, { code: "duplicate-execution-id", message: "Execution IDs must be unique in the migration snapshot.", executionId: execution.id });
      continue;
    }
    seenExecutionIds.add(execution.id);
    const classification = classifyTradingViewExecution(execution);
    if (!classification.eligible) {
      addBlocker(blockers, { code: classification.code, message: `Execution ${execution.id} is not eligible for the TradingView simulation account.`, executionId: execution.id });
      continue;
    }
    const sourceRunId = tradingViewSourceRun(execution);
    if (!sourceRunId) {
      addBlocker(blockers, { code: "source-run-conflict", message: `Execution ${execution.id} has conflicting source run fields.`, executionId: execution.id });
      continue;
    }
    targetExecutions.push({ execution, sourceRunId });
  }

  const executionPlan = targetExecutions.flatMap(({ execution, sourceRunId }) => {
    const row = executionPlanRow(execution, sourceRunId, blockers);
    return row ? [row] : [];
  });
  const targetExecutionIds = new Set(targetExecutions.map(({ execution }) => execution.id));
  validateCanonicalOccupancy(snapshot, targetExecutionIds, blockers);
  const targetExecutionById = new Map(targetExecutions.map(({ execution }) => [execution.id, execution]));
  const { rows: episodeMap, map: episodeIdMap } = mapEpisodes(snapshot, targetExecutionIds, targetExecutionById, blockers);

  const oldAccounts = sortedUnique(targetExecutions.map(({ execution }) => execution.accountId).filter((accountId) => accountId !== TRADINGVIEW_CANONICAL_ACCOUNT_ID));
  const sourceRuns = sortedUnique(targetExecutions.map(({ sourceRunId }) => sourceRunId));
  const instruments = sortedUnique(targetExecutions.map(({ execution }) => execution.instrument.id));
  const quantityValues = targetExecutions.map(({ execution }) => execution.quantity);
  const feeValues = targetExecutions.map(({ execution }) => execution.fee);
  let quantity = "0";
  let fee = "0";
  try {
    quantity = sumDecimal(quantityValues, true);
    fee = sumDecimal(feeValues);
  } catch {
    // Each offending execution already carries a precise invalid-decimal blocker.
  }
  const executionIds = sortedUnique(targetExecutions.map(({ execution }) => execution.id));
  const conservation: TradingViewMigrationConservation = {
    executionIdsBefore: executionIds,
    executionIdsAfter: executionIds,
    executionIdsPreserved: true,
    sourceRunsBefore: sourceRuns,
    sourceRunsAfter: sourceRuns,
    sourceRunsPreserved: true,
    quantityBefore: quantity,
    quantityAfter: quantity,
    feeBefore: fee,
    feeAfter: fee,
  };

  const accountMappings: IdentityMapping[] = oldAccounts.map((accountId) => ({ kind: "account", before: accountId, after: TRADINGVIEW_CANONICAL_ACCOUNT_ID }));
  const episodeMappings: IdentityMapping[] = [...episodeIdMap.entries()].map(([before, after]) => ({ kind: "episode", before, after }));
  const referencePlans = sorted(snapshot.references ?? [], (item) => `${item.table}\u0000${item.primaryKey}`).map((row) => mapReference(row, accountMappings, episodeMappings, blockers));
  const isBrowser = (row: TradingViewReferenceMigrationPlanRow) => /^(browser|localstorage|indexeddb|reviewkey)/i.test(row.table.replace(/[^a-z]/gi, "").toLowerCase());
  const referencePlan = referencePlans.filter((row) => !isBrowser(row));
  const browserStatePlan = referencePlans.filter(isBrowser);
  const principal = principalPlan(snapshot.existingProvisionals ?? [], blockers);
  const counts: TradingViewMigrationCounts = {
    executions: executionPlan.length,
    oldAccounts: oldAccounts.length,
    sourceRuns: sourceRuns.length,
    instruments: instruments.length,
    reviews: referencePlans.filter((row) => row.table === "reviews").length,
    recallRows: referencePlans.filter((row) => row.table.startsWith("recall_")).length,
    settingsRows: referencePlans.filter((row) => row.table === "app_settings").length,
    quantity,
    fee,
  };
  blockers.sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b)));
  const status = blockers.length === 0 ? "ready" : "blocked";
  const planWithoutDigest: TradingViewAccountMigrationPlan = {
    status,
    canonicalAccountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
    canonicalAccountLabel: TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
    baseSnapshotDigest,
    planDigest: "",
    counts,
    executionPlan,
    episodeMap,
    referencePlan,
    browserStatePlan,
    provisionalPrincipal: principal,
    conservation,
    blockers,
  };
  return { ...planWithoutDigest, planDigest: digest(stripPlanFormatting(planWithoutDigest)) };
}

export const planTradingViewAccountMigration = buildTradingViewAccountMigrationPlan;

export type TradingViewMigrationSnapshot = TradingViewAccountMigrationSnapshot;
export type TradingViewMigrationPlan = TradingViewAccountMigrationPlan;

/** Exported for tests and future API serializers that need the same canonical encoding. */
export function canonicalMigrationPlanDigest(value: unknown): string {
  return digest(value);
}
