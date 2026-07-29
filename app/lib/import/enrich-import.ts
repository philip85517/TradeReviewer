import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
} from "../instruments/display-name";
import type {
  InstrumentLookup,
  InstrumentMetadataFailure,
  ResolvedInstrument,
} from "../instruments/metadata-contracts";
import {
  resolveInstrumentMetadataBatch,
  type ResolveBatchResult,
} from "../instruments/resolve-service";
import type { InstrumentMetadataRepository } from "../storage/instrument-metadata-repository";
import type { TradeExecution } from "../trades/types";
import type {
  ImportExclusion,
  ParsedInstrumentCandidate,
  StatementParseResult,
} from "./contracts";
import type { ImportDiagnostic } from "./import-result";

export type EnrichedImportResult = {
  broker: StatementParseResult["broker"];
  importable: TradeExecution[];
  unresolved: InstrumentMetadataFailure[];
  exclusions: ImportExclusion[];
  diagnostics: ImportDiagnostic[];
  cacheHits: number;
};

export type InstrumentMetadataResolver = (
  lookups: InstrumentLookup[],
) => Promise<ResolveBatchResult>;

export type EnrichStatementImportOptions = {
  resolver?: InstrumentMetadataResolver;
  repository?: InstrumentMetadataRepository;
  forceRefresh?: boolean;
  onlyInstrumentIds?: string[];
  signal?: AbortSignal;
};

function candidateId(candidate: ParsedInstrumentCandidate): string {
  return canonicalInstrumentId(candidate.symbol, candidate.market);
}

function usableStatementName(candidate: ParsedInstrumentCandidate) {
  const sourceName = candidate.sourceName?.trim();
  const symbol = canonicalInstrumentSymbol(
    candidate.symbol,
    candidate.market,
  );
  return sourceName &&
    sourceName !== symbol &&
    (candidate.sourceAssetType === "stock" ||
      candidate.sourceAssetType === "etf")
    ? sourceName
    : undefined;
}

function unknownFailure(
  candidate: ParsedInstrumentCandidate,
): InstrumentMetadataFailure {
  const source =
    candidate.market === "US"
      ? "nasdaq"
      : candidate.market === "HK"
        ? "hkex"
        : "tencent";
  return {
    market: candidate.market,
    symbol: canonicalInstrumentSymbol(
      candidate.symbol,
      candidate.market,
    ),
    attempts: [
      {
        source,
        code: "unresolved",
        message: "无法确认该标的是股票或 ETF",
      },
    ],
  };
}

function addUnknownExclusion(
  exclusions: ImportExclusion[],
  candidate: ParsedInstrumentCandidate,
  count: number,
) {
  const symbol = canonicalInstrumentSymbol(
    candidate.symbol,
    candidate.market,
  );
  const existing = exclusions.find(
    (item) =>
      item.category === "unknown-asset" &&
      item.instrumentSymbol === symbol,
  );
  if (existing) existing.count += count;
  else {
    exclusions.push({
      category: "unknown-asset",
      label: "无法确认属于股票或 ETF",
      count,
      instrumentSymbol: symbol,
    });
  }
}

function applyMetadata(
  execution: TradeExecution,
  metadata: ResolvedInstrument | { name: string },
): TradeExecution {
  return {
    ...execution,
    instrument: {
      ...execution.instrument,
      name: metadata.name,
    },
  };
}

export async function enrichStatementImport(
  parsed: StatementParseResult,
  options: EnrichStatementImportOptions,
): Promise<EnrichedImportResult> {
  const exclusions = parsed.exclusions.map((item) => ({ ...item }));
  if (parsed.blocked) {
    return {
      broker: parsed.broker,
      importable: [],
      unresolved: [],
      exclusions,
      diagnostics: [...parsed.diagnostics],
      cacheHits: 0,
    };
  }

  const selectedIds = options.onlyInstrumentIds
    ? new Set(options.onlyInstrumentIds)
    : undefined;
  const candidates = new Map(
    parsed.candidates.map((candidate) => [candidateId(candidate), candidate]),
  );
  for (const record of parsed.records) {
    const market = record.instrument
      .market as ParsedInstrumentCandidate["market"];
    const instrumentId = canonicalInstrumentId(
      record.instrument.symbol,
      market,
    );
    if (!candidates.has(instrumentId)) {
      candidates.set(instrumentId, {
        market,
        symbol: record.instrument.symbol,
        sourceAssetType: "unknown",
      });
    }
  }
  const statementNames = new Map<string, string>();
  const lookups: InstrumentLookup[] = [];

  for (const [instrumentId, candidate] of candidates) {
    if (selectedIds && !selectedIds.has(instrumentId)) continue;
    const statementName = usableStatementName(candidate);
    if (statementName) {
      statementNames.set(instrumentId, statementName);
    } else {
      lookups.push({
        market: candidate.market,
        symbol: canonicalInstrumentSymbol(
          candidate.symbol,
          candidate.market,
        ),
      });
    }
  }

  let resolution: ResolveBatchResult = {
    resolved: new Map(),
    unresolved: new Map(),
    cacheHits: 0,
    backgroundRefresh: Promise.resolve(),
  };
  if (lookups.length > 0) {
    if (options.resolver) {
      resolution = await options.resolver(lookups);
    } else {
      if (!options.repository) {
        throw new Error("证券元数据补全需要本地缓存仓库");
      }
      resolution = await resolveInstrumentMetadataBatch(lookups, {
        repository: options.repository,
        forceRefresh: options.forceRefresh,
        signal: options.signal,
      });
    }
  }

  const unresolved: InstrumentMetadataFailure[] = [];
  const importable: TradeExecution[] = [];
  const recordsByInstrument = new Map<string, TradeExecution[]>();
  for (const record of parsed.records) {
    const instrumentId = canonicalInstrumentId(
      record.instrument.symbol,
      record.instrument.market,
    );
    const records = recordsByInstrument.get(instrumentId) ?? [];
    records.push(record);
    recordsByInstrument.set(instrumentId, records);
  }

  for (const [instrumentId, candidate] of candidates) {
    if (selectedIds && !selectedIds.has(instrumentId)) continue;
    const records = recordsByInstrument.get(instrumentId) ?? [];
    const statementName = statementNames.get(instrumentId);
    if (statementName) {
      importable.push(
        ...records.map((record) =>
          applyMetadata(record, { name: statementName }),
        ),
      );
      continue;
    }

    const metadata = resolution.resolved.get(instrumentId);
    if (metadata) {
      importable.push(
        ...records.map((record) => applyMetadata(record, metadata)),
      );
      continue;
    }

    const failure =
      resolution.unresolved.get(instrumentId) ??
      unknownFailure(candidate);
    unresolved.push(failure);
    addUnknownExclusion(exclusions, candidate, Math.max(records.length, 1));
  }

  return {
    broker: parsed.broker,
    importable,
    unresolved,
    exclusions,
    diagnostics: [...parsed.diagnostics],
    cacheHits: resolution.cacheHits,
  };
}
