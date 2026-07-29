import type { InstrumentMetadataFailure } from "../instruments/metadata-contracts";
import {
  buildInstrumentTradeSummaries,
  type InstrumentTradeSummary,
} from "../trades/instruments";
import type { TradeExecution } from "../trades/types";
import type {
  ImportExclusion,
  StatementBroker,
  StatementParseResult,
} from "./contracts";
import type { EnrichedImportResult } from "./enrich-import";

export type ImportPreview = {
  id: string;
  fileName: string;
  sourceLabel: string;
  records: TradeExecution[];
  instruments: InstrumentTradeSummary[];
  unresolved: InstrumentMetadataFailure[];
  exclusionGroups: ImportExclusion[];
  tradeCount: number;
  instrumentCount: number;
  duplicateTradeCount: number;
  unresolvedInstrumentCount: number;
  /** Kept until import-history migrates to categorized record counts. */
  excludedInstrumentCount: number;
  firstTradeAt?: string;
  lastTradeAt?: string;
  blocked: boolean;
};

type CreateImportPreviewOptions = {
  duplicateTradeCount?: number;
};

const BROKER_LABELS: Record<StatementBroker, string> = {
  futu: "富途证券",
  tiger: "Tiger 证券",
  "china-merchants": "招商证券",
};

function groupedExclusions(
  exclusions: ImportExclusion[],
): ImportExclusion[] {
  const grouped = new Map<string, ImportExclusion>();
  for (const exclusion of exclusions) {
    const label = exclusion.label.trim() || "其他未导入内容";
    const key = `${exclusion.category}:${label}`;
    const current = grouped.get(key);
    if (current) {
      current.count += exclusion.count;
    } else {
      grouped.set(key, {
        category: exclusion.category,
        label,
        count: exclusion.count,
      });
    }
  }
  return [...grouped.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.label.localeCompare(b.label),
  );
}

function duplicateCount(result: EnrichedImportResult) {
  return result.diagnostics.filter((diagnostic) =>
    diagnostic.code.toLowerCase().includes("duplicate"),
  ).length;
}

export function createImportPreview(
  fileName: string,
  result: EnrichedImportResult | StatementParseResult,
  options: CreateImportPreviewOptions = {},
): ImportPreview {
  const enriched =
    "importable" in result
      ? result
      : {
          broker: result.broker,
          importable: result.records,
          unresolved: [],
          exclusions: result.exclusions,
          diagnostics: result.diagnostics,
          cacheHits: 0,
        };
  const instruments = buildInstrumentTradeSummaries(enriched.importable);
  const times = enriched.importable
    .map((record) => record.executedAt)
    .sort((a, b) => a.localeCompare(b));
  const fingerprint =
    enriched.importable[0]?.source.fileFingerprint ??
    `${enriched.broker}:${fileName}:${enriched.importable.length}`;
  const exclusionGroups = groupedExclusions(enriched.exclusions);

  return {
    id: `import:${fingerprint}`,
    fileName,
    sourceLabel: BROKER_LABELS[enriched.broker],
    records: enriched.importable,
    instruments,
    unresolved: enriched.unresolved.map((failure) => ({
      ...failure,
      attempts: failure.attempts.map((attempt) => ({ ...attempt })),
    })),
    exclusionGroups,
    tradeCount: enriched.importable.length,
    instrumentCount: instruments.length,
    duplicateTradeCount:
      options.duplicateTradeCount ?? duplicateCount(enriched),
    unresolvedInstrumentCount: enriched.unresolved.length,
    excludedInstrumentCount: exclusionGroups.length,
    firstTradeAt: times[0],
    lastTradeAt: times.at(-1),
    blocked:
      enriched.importable.length === 0 ||
      ("blocked" in result && result.blocked),
  };
}
