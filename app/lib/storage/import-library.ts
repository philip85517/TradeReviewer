import type { TradeExecution } from "../trades/types";
import {
  compareExecutionEvidence,
  compareExecutions,
  reconcileExecutions,
} from "../import/execution-reconciliation";

export const IMPORTED_EXECUTIONS_STORAGE_KEY =
  "trade-reviewer:executions:v1";

function isExecution(value: unknown): value is TradeExecution {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TradeExecution>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.accountId === "string" &&
    typeof candidate.executedAt === "string" &&
    typeof candidate.quantity === "string" &&
    typeof candidate.price === "string" &&
    typeof candidate.instrument?.id === "string" &&
    (candidate.side === "buy" || candidate.side === "sell")
  );
}

export function mergeExecutions(
  current: readonly TradeExecution[],
  incoming: readonly TradeExecution[],
) {
  const byId = new Map<string, TradeExecution>();
  for (const execution of [...current, ...incoming]) {
    const existing = byId.get(execution.id);
    if (
      !existing ||
      compareExecutionEvidence(execution, existing) > 0
    ) {
      byId.set(execution.id, execution);
    }
  }

  return reconcileExecutions([], [...byId.values()]).acceptedIncoming.sort(
    compareExecutions,
  );
}

export function saveImportedExecutions(executions: TradeExecution[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    IMPORTED_EXECUTIONS_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      executions: mergeExecutions([], executions),
    }),
  );
}

export function loadImportedExecutions(): TradeExecution[] {
  if (typeof window === "undefined") return [];
  const serialized = window.localStorage.getItem(
    IMPORTED_EXECUTIONS_STORAGE_KEY,
  );
  if (!serialized) return [];

  try {
    const parsed = JSON.parse(serialized) as {
      version?: unknown;
      executions?: unknown;
    };
    if (parsed.version !== 1 || !Array.isArray(parsed.executions)) return [];
    return mergeExecutions([], parsed.executions.filter(isExecution));
  } catch {
    return [];
  }
}
