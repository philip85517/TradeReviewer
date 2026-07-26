import type { TradeExecution } from "../trades/types";
import { canonicalInstrumentId } from "../instruments/display-name";

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
  current: TradeExecution[],
  incoming: TradeExecution[],
) {
  const byId = new Map<string, TradeExecution>();
  for (const execution of [...current, ...incoming]) {
    const existing = byId.get(execution.id);
    byId.set(
      execution.id,
      existing ? withBestInstrumentName(existing, [execution]) : execution,
    );
  }

  const bySignature = new Map<string, TradeExecution[]>();
  for (const execution of byId.values()) {
    const signature = [
      execution.accountId,
      canonicalInstrumentId(
        execution.instrument.symbol,
        execution.instrument.market,
      ),
      execution.executedAt,
      execution.side,
      execution.quantity,
      execution.price,
      execution.fee,
    ].join("|");
    bySignature.set(signature, [
      ...(bySignature.get(signature) ?? []),
      execution,
    ]);
  }

  const merged = [...bySignature.values()].flatMap((duplicates) => {
    const byFile = new Map<string, TradeExecution[]>();
    for (const execution of duplicates) {
      const fingerprint =
        execution.source.fileFingerprint ??
        `legacy:${execution.source.fileName ?? execution.source.platform}`;
      byFile.set(fingerprint, [
        ...(byFile.get(fingerprint) ?? []),
        execution,
      ]);
    }
    const selected = [...byFile.entries()].sort(
      ([fingerprintA, recordsA], [fingerprintB, recordsB]) =>
        recordsB.length - recordsA.length ||
        fingerprintA.localeCompare(fingerprintB),
    )[0]?.[1] ?? [];
    return selected.map((execution) =>
      withBestInstrumentName(execution, duplicates),
    );
  });

  return merged.sort(
    (a, b) =>
      a.executedAt.localeCompare(b.executedAt) || a.id.localeCompare(b.id),
  );
}

function withBestInstrumentName(
  execution: TradeExecution,
  candidates: TradeExecution[],
): TradeExecution {
  const resolvedName = [execution, ...candidates]
    .map((candidate) => candidate.instrument.name.trim())
    .find(
      (name) =>
        name &&
        name !== "名称待行情源补充" &&
        name !== execution.instrument.symbol,
    );
  return resolvedName
    ? {
        ...execution,
        instrument: { ...execution.instrument, name: resolvedName },
      }
    : execution;
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
