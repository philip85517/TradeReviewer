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
  options?: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
  },
) => Promise<ResolveBatchResult>;

export type EnrichStatementImportOptions = {
  resolver?: InstrumentMetadataResolver;
  repository?: InstrumentMetadataRepository;
  forceRefresh?: boolean;
  onlyInstrumentIds?: string[];
  signal?: AbortSignal;
  clock?: () => number;
};

function candidateId(candidate: ParsedInstrumentCandidate): string {
  return canonicalInstrumentId(candidate.symbol, candidate.market);
}

function mergeCandidateEvidence(
  current: ParsedInstrumentCandidate | undefined,
  incoming: ParsedInstrumentCandidate,
): ParsedInstrumentCandidate {
  if (!current) {
    return {
      ...incoming,
      symbol: canonicalInstrumentSymbol(
        incoming.symbol,
        incoming.market,
      ),
    };
  }
  const symbol = canonicalInstrumentSymbol(
    incoming.symbol,
    incoming.market,
  );
  const names = [current.sourceName, incoming.sourceName]
    .map((name) => name?.trim())
    .filter(
      (name): name is string =>
        typeof name === "string" &&
        name.length > 0 &&
        canonicalInstrumentSymbol(name, incoming.market) !== symbol,
    )
    .sort();
  const evidence = [
    current.sourceAssetType,
    incoming.sourceAssetType,
  ];
  return {
    market: incoming.market,
    symbol,
    sourceName: names[0],
    sourceAssetType: evidence.includes("etf")
      ? "etf"
      : evidence.includes("stock")
        ? "stock"
        : "unknown",
  };
}

function usableStatementName(candidate: ParsedInstrumentCandidate) {
  const sourceName = candidate.sourceName?.trim();
  const symbol = canonicalInstrumentSymbol(
    candidate.symbol,
    candidate.market,
  );
  return sourceName &&
    canonicalInstrumentSymbol(sourceName, candidate.market) !== symbol &&
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

function emptyResolution(): ResolveBatchResult {
  return {
    resolved: new Map(),
    unresolved: new Map(),
    cacheHits: 0,
    backgroundRefresh: Promise.resolve(),
  };
}

function mergeResolutions(
  results: ResolveBatchResult[],
): ResolveBatchResult {
  const resolved = new Map<string, ResolvedInstrument>();
  const unresolved = new Map<string, InstrumentMetadataFailure>();
  for (const result of results) {
    for (const [instrumentId, metadata] of result.resolved) {
      resolved.set(instrumentId, metadata);
      unresolved.delete(instrumentId);
    }
    for (const [instrumentId, failure] of result.unresolved) {
      if (!resolved.has(instrumentId)) {
        unresolved.set(instrumentId, failure);
      }
    }
  }
  return {
    resolved,
    unresolved,
    cacheHits: results.reduce(
      (total, result) => total + result.cacheHits,
      0,
    ),
    backgroundRefresh: Promise.all(
      results.map((result) => result.backgroundRefresh),
    ).then(() => undefined),
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
  const candidates = new Map<string, ParsedInstrumentCandidate>();
  for (const candidate of parsed.candidates) {
    const instrumentId = candidateId(candidate);
    candidates.set(
      instrumentId,
      mergeCandidateEvidence(candidates.get(instrumentId), candidate),
    );
  }
  for (const record of parsed.records) {
    const market = record.instrument
      .market as ParsedInstrumentCandidate["market"];
    const instrumentId = canonicalInstrumentId(
      record.instrument.symbol,
      market,
    );
    candidates.set(
      instrumentId,
      mergeCandidateEvidence(candidates.get(instrumentId), {
        market,
        symbol: record.instrument.symbol,
        sourceAssetType: "unknown",
      }),
    );
  }
  const statementMetadata = new Map<string, ResolvedInstrument>();
  const lookups: InstrumentLookup[] = [];
  const resolvedAt = new Date(
    (options.clock ?? Date.now)(),
  ).toISOString();

  for (const [instrumentId, candidate] of candidates) {
    const statementName = usableStatementName(candidate);
    if (statementName) {
      statementMetadata.set(instrumentId, {
        market: candidate.market,
        symbol: canonicalInstrumentSymbol(
          candidate.symbol,
          candidate.market,
        ),
        name: statementName,
        assetType: candidate.sourceAssetType as "stock" | "etf",
        source: "statement",
        confidence: "statement",
        resolvedAt,
      });
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

  if (options.repository && statementMetadata.size > 0) {
    await Promise.all(
      [...statementMetadata.values()].map(async (metadata) => {
        try {
          await options.repository?.put(metadata);
        } catch {
          // Cache durability must not decide whether a valid trade imports.
        }
      }),
    );
  }

  const runResolver = async (
    batch: InstrumentLookup[],
    forceRefresh: boolean,
  ): Promise<ResolveBatchResult> => {
    if (batch.length === 0) return emptyResolution();
    if (options.resolver) {
      return forceRefresh || options.signal
        ? options.resolver(batch, {
            forceRefresh,
            signal: options.signal,
          })
        : options.resolver(batch);
    }
    if (!options.repository) {
      throw new Error("证券元数据补全需要本地缓存仓库");
    }
    return resolveInstrumentMetadataBatch(batch, {
      repository: options.repository,
      forceRefresh,
      signal: options.signal,
      clock: options.clock,
    });
  };

  let resolution = emptyResolution();
  if (lookups.length > 0) {
    if (options.forceRefresh && selectedIds) {
      const forced = lookups.filter((lookup) =>
        selectedIds.has(
          canonicalInstrumentId(lookup.symbol, lookup.market),
        ),
      );
      const normal = lookups.filter(
        (lookup) =>
          !selectedIds.has(
            canonicalInstrumentId(lookup.symbol, lookup.market),
          ),
      );
      resolution = mergeResolutions(
        await Promise.all([
          runResolver(normal, false),
          runResolver(forced, true),
        ]),
      );
    } else {
      resolution = await runResolver(
        lookups,
        Boolean(options.forceRefresh),
      );
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
    const records = recordsByInstrument.get(instrumentId) ?? [];
    const statement = statementMetadata.get(instrumentId);
    if (statement) {
      resolution.resolved.set(instrumentId, statement);
      continue;
    }

    const metadata = resolution.resolved.get(instrumentId);
    if (metadata) continue;

    const failure =
      resolution.unresolved.get(instrumentId) ??
      unknownFailure(candidate);
    unresolved.push(failure);
    addUnknownExclusion(exclusions, candidate, Math.max(records.length, 1));
  }

  for (const record of parsed.records) {
    const instrumentId = canonicalInstrumentId(
      record.instrument.symbol,
      record.instrument.market,
    );
    const metadata = resolution.resolved.get(instrumentId);
    if (metadata) importable.push(applyMetadata(record, metadata));
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
