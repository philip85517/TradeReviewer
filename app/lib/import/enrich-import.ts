import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
} from "../instruments/display-name";
import type {
  InstrumentLookup,
  InstrumentMetadataFailure,
  ResolvedInstrument,
} from "../instruments/metadata-contracts";
import { validateResolvedInstrument } from "../instruments/metadata-contracts";
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

async function readValidCachedMetadata(
  lookups: InstrumentLookup[],
  repository: InstrumentMetadataRepository | undefined,
): Promise<Map<string, ResolvedInstrument>> {
  if (!repository || lookups.length === 0) return new Map();
  const uniqueLookups = new Map(
    lookups.map((lookup) => [
      canonicalInstrumentId(lookup.symbol, lookup.market),
      lookup,
    ]),
  );
  try {
    const records = await repository.getMany([...uniqueLookups.keys()]);
    const valid = new Map<string, ResolvedInstrument>();
    for (const [instrumentId, lookup] of uniqueLookups) {
      const record = records.get(instrumentId);
      if (!record) continue;
      try {
        valid.set(
          instrumentId,
          validateResolvedInstrument(record, lookup),
        );
      } catch {
        // Invalid cache entries behave exactly like a cache miss.
      }
    }
    return valid;
  } catch {
    return new Map();
  }
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
  const proposedStatementMetadata = new Map<
    string,
    ResolvedInstrument
  >();
  const lookups: InstrumentLookup[] = [];
  const resolvedAt = new Date(
    (options.clock ?? Date.now)(),
  ).toISOString();

  for (const [instrumentId, candidate] of candidates) {
    const statementName = usableStatementName(candidate);
    if (statementName) {
      proposedStatementMetadata.set(instrumentId, {
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

  const cachedStatementMetadata = await readValidCachedMetadata(
    [...proposedStatementMetadata.values()].map(({ market, symbol }) => ({
      market,
      symbol,
    })),
    options.repository,
  );
  const trustedMetadata = new Map<string, ResolvedInstrument>();
  for (const [instrumentId, proposed] of proposedStatementMetadata) {
    trustedMetadata.set(
      instrumentId,
      cachedStatementMetadata.get(instrumentId) ?? proposed,
    );
  }

  if (options.repository && proposedStatementMetadata.size > 0) {
    await Promise.all(
      [...proposedStatementMetadata.entries()].map(
        async ([instrumentId, metadata]) => {
          if (cachedStatementMetadata.has(instrumentId)) return;
          try {
            await options.repository?.put(metadata);
          } catch {
            // Cache durability must not decide whether a valid trade imports.
          }
        },
      ),
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
      const unselected = lookups.filter(
        (lookup) =>
          !selectedIds.has(
            canonicalInstrumentId(lookup.symbol, lookup.market),
          ),
      );
      const cachedUnselected = await readValidCachedMetadata(
        unselected,
        options.repository,
      );
      resolution = await runResolver(forced, true);
      for (const [instrumentId, metadata] of cachedUnselected) {
        resolution.resolved.set(instrumentId, metadata);
      }
      resolution.cacheHits += cachedUnselected.size;
    } else {
      resolution = await runResolver(
        lookups,
        Boolean(options.forceRefresh),
      );
    }
  }
  for (const [instrumentId, metadata] of trustedMetadata) {
    resolution.resolved.set(instrumentId, metadata);
  }
  resolution.cacheHits += cachedStatementMetadata.size;

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
