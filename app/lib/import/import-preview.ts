import { STATEMENT_FORMATS } from "./statement-formats";
import { buildTradeEpisodes } from "../trades/episodes";
import type { InstrumentMetadataFailure } from "../instruments/metadata-contracts";
import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
} from "../instruments/display-name";
import {
  buildInstrumentTradeSummaries,
  type InstrumentTradeSummary,
} from "../trades/instruments";
import type { TradeExecution } from "../trades/types";
import type {
  ImportExclusion,
  StatementParseResult,
} from "./contracts";
import {
  UNRESOLVED_ASSET_EXCLUSION_LABEL,
  type EnrichedImportResult,
} from "./enrich-import";

export type ImportPreview = {
  id: string;
  fileName: string;
  sourceLabel: string;
  sourceKind: "statement" | "screenshot";
  captureCount?: number;
  records: TradeExecution[];
  instruments: InstrumentTradeSummary[];
  unresolved: InstrumentMetadataFailure[];
  exclusionGroups: ImportExclusion[];
  tradeCount: number;
  instrumentCount: number;
  duplicateTradeCount: number;
  conflictTradeCount?: number;
  unresolvedInstrumentCount: number;
  /** Kept until import-history migrates to categorized record counts. */
  excludedInstrumentCount: number;
  firstTradeAt?: string;
  lastTradeAt?: string;
  notices?: string[];
  simulation?: { rawRowCount: number; pairCount: number; episodeCount: number; diagnostics: string[] };
  blocked: boolean;
};

type CreateImportPreviewOptions = {
  sourceKind?: "statement" | "screenshot";
  captureCount?: number;
  duplicateTradeCount?: number;
  conflictTradeCount?: number;
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

function unresolvedFromRawParse(
  result: StatementParseResult,
): InstrumentMetadataFailure[] {
  const failures = new Map<string, InstrumentMetadataFailure>();
  for (const candidate of result.candidates) {
    const symbol = canonicalInstrumentSymbol(
      candidate.symbol,
      candidate.market,
    );
    failures.set(canonicalInstrumentId(symbol, candidate.market), {
      market: candidate.market,
      symbol,
      attempts: [],
    });
  }
  for (const record of result.records) {
    if (
      record.instrument.market !== "US" &&
      record.instrument.market !== "HK" &&
      record.instrument.market !== "CN-SH" &&
      record.instrument.market !== "CN-SZ"
    ) {
      continue;
    }
    const symbol = canonicalInstrumentSymbol(
      record.instrument.symbol,
      record.instrument.market,
    );
    const instrumentId = canonicalInstrumentId(
      symbol,
      record.instrument.market,
    );
    if (!failures.has(instrumentId)) {
      failures.set(instrumentId, {
        market: record.instrument.market,
        symbol,
        attempts: [],
      });
    }
  }
  return [...failures.values()];
}

function duplicateCount(result: EnrichedImportResult) {
  return result.diagnostics.filter((diagnostic) =>
    diagnostic.code.toLowerCase().includes("duplicate"),
  ).length;
}

function isRetryableMetadataExclusion(
  exclusion: ImportExclusion,
  unresolvedSymbols: Set<string>,
) {
  return (
    exclusion.category === "unknown-asset" &&
    exclusion.label.trim() ===
      UNRESOLVED_ASSET_EXCLUSION_LABEL &&
    typeof exclusion.instrumentSymbol === "string" &&
    unresolvedSymbols.has(
      exclusion.instrumentSymbol.trim().toUpperCase(),
    )
  );
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
          // A parser can identify rows, but only enrichment can prove both
          // name and stock/ETF type. Keep this compatibility path fail-closed.
          importable: [],
          unresolved: unresolvedFromRawParse(result),
          exclusions: result.exclusions,
          diagnostics: result.diagnostics,
          cacheHits: 0,
        };
  const instruments = buildInstrumentTradeSummaries(enriched.importable);
  const times = enriched.importable
    .map((record) => record.executedAt)
    .sort((a, b) => a.localeCompare(b));
  const fingerprint =
    (options.sourceKind === "screenshot"
      ? enriched.importable[0]?.source.batchId
      : undefined) ??
    enriched.importable[0]?.source.fileFingerprint ??
    `${enriched.broker}:${fileName}:${enriched.importable.length}`;
  const unresolvedSymbols = new Set(
    enriched.unresolved.map((failure) =>
      failure.symbol.trim().toUpperCase(),
    ),
  );
  const exclusionGroups = groupedExclusions(
    enriched.exclusions.filter(
      (exclusion) =>
        !isRetryableMetadataExclusion(
          exclusion,
          unresolvedSymbols,
        ),
    ),
  );

  return {
    id: `import:${enriched.importable[0]?.source.simulationRunId ?? fingerprint}`,
    ...(enriched.broker === "tradingview" ? { simulation: {
      rawRowCount: enriched.importable.length + enriched.exclusions.reduce((sum,item)=>sum+item.count,0),
      pairCount: new Set(enriched.importable.map(item=>item.source.simulationTradeId)).size,
      episodeCount: buildTradeEpisodes(enriched.importable).length,
      diagnostics: enriched.diagnostics.map(item=>item.message),
    } } : {}),
    fileName,
    sourceLabel:
      options.sourceKind === "screenshot"
        ? enriched.broker === "futu"
          ? "富途截图"
          : enriched.broker === "tiger"
            ? "老虎截图"
            : "交易截图"
        : STATEMENT_FORMATS[enriched.broker].label,
    notices: [...new Set([
      ...(enriched.importable.some(record=>record.source.timePrecision === "date-only") && !enriched.importable.some(record=>record.source.platform === "tradingview")
        ? ["账单仅提供交易日期，未提供成交时刻；同日记录按账单顺序展示。"] : []),
      ...enriched.diagnostics.filter(item=>item.severity !== "info").map(item=>item.message),
    ])],
    sourceKind: options.sourceKind ?? "statement",
    ...(options.sourceKind === "screenshot" &&
    typeof options.captureCount === "number"
      ? { captureCount: options.captureCount }
      : {}),
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
    ...(options.sourceKind === "screenshot" &&
    typeof options.conflictTradeCount === "number"
      ? { conflictTradeCount: options.conflictTradeCount }
      : {}),
    unresolvedInstrumentCount: enriched.unresolved.length,
    excludedInstrumentCount: exclusionGroups.length,
    firstTradeAt: times[0],
    lastTradeAt: times.at(-1),
    blocked:
      enriched.importable.length === 0 ||
      ("blocked" in result && result.blocked),
  };
}
