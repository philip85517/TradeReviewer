import {
  canonicalInstrumentId,
  canonicalInstrumentSymbol,
} from "./display-name";
import {
  validateResolvedInstrument,
  type InstrumentLookup,
  type InstrumentMetadataFailure,
  type InstrumentMetadataSource,
  type ResolvedInstrument,
} from "./metadata-contracts";
import type { InstrumentMetadataRepository } from "../storage/instrument-metadata-repository";

export type ResolveBatchResult = {
  resolved: Map<string, ResolvedInstrument>;
  unresolved: Map<string, InstrumentMetadataFailure>;
  cacheHits: number;
  backgroundRefresh: Promise<void>;
};

type ResolveOptions = {
  repository: InstrumentMetadataRepository;
  fetcher?: typeof fetch;
  concurrency?: number;
  forceRefresh?: boolean;
  signal?: AbortSignal;
  clock?: () => number;
};

type ProviderSource = Exclude<InstrumentMetadataSource, "statement">;

const DAY_MS = 86_400_000;
const OFFICIAL_METADATA_TTL_MS = DAY_MS;
const PORTAL_METADATA_TTL_MS = 30 * DAY_MS;
const STATEMENT_METADATA_TTL_MS = 365 * DAY_MS;
const PROVIDER_SOURCES = new Set<ProviderSource>([
  "nasdaq",
  "sec",
  "hkex",
  "tencent",
  "eastmoney",
  "sina",
]);

function normalizeLookup(lookup: InstrumentLookup): InstrumentLookup {
  return {
    market: lookup.market,
    symbol: canonicalInstrumentSymbol(lookup.symbol, lookup.market),
  };
}

function defaultSource(lookup: InstrumentLookup): ProviderSource {
  if (lookup.market === "US") return "nasdaq";
  if (lookup.market === "HK") return "hkex";
  return "tencent";
}

function clientFailure(
  lookup: InstrumentLookup,
  code: string,
  message: string,
): InstrumentMetadataFailure {
  return {
    ...lookup,
    attempts: [{ source: defaultSource(lookup), code, message }],
  };
}

function parseFailure(
  value: unknown,
  lookup: InstrumentLookup,
): InstrumentMetadataFailure {
  const error =
    value && typeof value === "object" && "error" in value
      ? (value.error as Record<string, unknown> | undefined)
      : undefined;
  const attempts = Array.isArray(error?.attempts)
    ? error.attempts.flatMap((attempt) => {
        if (!attempt || typeof attempt !== "object") return [];
        const candidate = attempt as Record<string, unknown>;
        if (
          !PROVIDER_SOURCES.has(candidate.source as ProviderSource) ||
          typeof candidate.code !== "string" ||
          typeof candidate.message !== "string"
        ) {
          return [];
        }
        return [
          {
            source: candidate.source as ProviderSource,
            code: candidate.code,
            message: candidate.message,
          },
        ];
      })
    : [];

  return {
    ...lookup,
    attempts:
      attempts.length > 0
        ? attempts
        : [
            {
              source: defaultSource(lookup),
              code:
                typeof error?.code === "string"
                  ? error.code
                  : "request-failed",
              message:
                typeof error?.message === "string"
                  ? error.message
                  : "证券元数据解析失败",
            },
          ],
  };
}

function workerCount(concurrency: number | undefined, jobs: number) {
  const requested =
    typeof concurrency === "number" && Number.isFinite(concurrency)
      ? Math.floor(concurrency)
      : 3;
  return Math.min(jobs, Math.max(1, requested));
}

function metadataTtl(record: ResolvedInstrument) {
  if (
    record.source === "statement" ||
    record.confidence === "statement"
  ) {
    return STATEMENT_METADATA_TTL_MS;
  }
  if (
    record.source === "nasdaq" ||
    record.source === "sec" ||
    record.source === "hkex" ||
    record.confidence === "official"
  ) {
    return OFFICIAL_METADATA_TTL_MS;
  }
  return PORTAL_METADATA_TTL_MS;
}

function isFreshMetadata(record: ResolvedInstrument, now: number) {
  const resolvedAt = Date.parse(record.resolvedAt);
  return (
    Number.isFinite(resolvedAt) &&
    resolvedAt <= now &&
    now - resolvedAt < metadataTtl(record)
  );
}

export async function resolveInstrumentMetadataBatch(
  lookups: InstrumentLookup[],
  options: ResolveOptions,
): Promise<ResolveBatchResult> {
  const fetcher = options.fetcher ?? fetch;
  const uniqueLookups = new Map<string, InstrumentLookup>();
  for (const input of lookups) {
    const lookup = normalizeLookup(input);
    uniqueLookups.set(
      canonicalInstrumentId(lookup.symbol, lookup.market),
      lookup,
    );
  }

  const resolved = new Map<string, ResolvedInstrument>();
  const unresolved = new Map<string, InstrumentMetadataFailure>();
  const staleInstrumentIds = new Set<string>();
  const now = (options.clock ?? Date.now)();
  let cacheHits = 0;
  let pending = [...uniqueLookups.entries()];

  if (!options.forceRefresh && pending.length > 0) {
    try {
      const cached = await options.repository.getMany(
        pending.map(([instrumentId]) => instrumentId),
      );
      pending = pending.filter(([instrumentId, lookup]) => {
        const record = cached.get(instrumentId);
        if (!record) return true;
        try {
          const validated = validateResolvedInstrument(record, lookup);
          resolved.set(instrumentId, validated);
          cacheHits += 1;
          if (isFreshMetadata(validated, now)) return false;
          staleInstrumentIds.add(instrumentId);
          return true;
        } catch {
          return true;
        }
      });
    } catch {
      // A broken cache read must not prevent independent network resolution.
    }
  }

  let nextJob = 0;
  const recordFailure = (
    instrumentId: string,
    failure: InstrumentMetadataFailure,
  ) => {
    if (!staleInstrumentIds.has(instrumentId)) {
      unresolved.set(instrumentId, failure);
    }
  };
  const resolveJob = async (
    instrumentId: string,
    lookup: InstrumentLookup,
  ) => {
    if (options.signal?.aborted) {
      recordFailure(
        instrumentId,
        clientFailure(lookup, "aborted", "证券元数据请求已取消"),
      );
      return;
    }

    const query = new URLSearchParams({
      market: lookup.market,
      symbol: lookup.symbol,
    });
    let response: Response;
    try {
      response = await fetcher(`/api/instruments/resolve?${query}`, {
        signal: options.signal,
      });
    } catch (error) {
      recordFailure(
        instrumentId,
        clientFailure(
          lookup,
          options.signal?.aborted ? "aborted" : "request-failed",
          error instanceof Error ? error.message : "证券元数据请求失败",
        ),
      );
      return;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      recordFailure(
        instrumentId,
        clientFailure(lookup, "invalid-response", "证券元数据响应无效"),
      );
      return;
    }
    if (!response.ok) {
      recordFailure(instrumentId, parseFailure(body, lookup));
      return;
    }
    if (options.signal?.aborted) {
      recordFailure(
        instrumentId,
        clientFailure(lookup, "aborted", "证券元数据请求已取消"),
      );
      return;
    }

    let record: ResolvedInstrument;
    try {
      record = validateResolvedInstrument(body, lookup);
    } catch {
      recordFailure(
        instrumentId,
        clientFailure(lookup, "invalid-response", "证券元数据响应无效"),
      );
      return;
    }

    try {
      await options.repository.put(record);
    } catch (error) {
      recordFailure(
        instrumentId,
        clientFailure(
          lookup,
          "cache-write-failed",
          error instanceof Error ? error.message : "证券元数据缓存失败",
        ),
      );
      return;
    }
    resolved.set(instrumentId, record);
    staleInstrumentIds.delete(instrumentId);
    unresolved.delete(instrumentId);
  };

  pending.sort(
    ([left], [right]) =>
      Number(staleInstrumentIds.has(left)) -
      Number(staleInstrumentIds.has(right)),
  );
  const blockingInstrumentIds = new Set(
    pending.flatMap(([instrumentId]) =>
      staleInstrumentIds.has(instrumentId) ? [] : [instrumentId],
    ),
  );
  let blockingJobs = blockingInstrumentIds.size;
  let finishBlockingJobs: (() => void) | undefined;
  const blockingDone =
    blockingJobs === 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          finishBlockingJobs = resolve;
        });

  const worker = async () => {
    while (nextJob < pending.length) {
      const job = pending[nextJob];
      nextJob += 1;
      if (!job) return;
      const [instrumentId, lookup] = job;
      try {
        await resolveJob(instrumentId, lookup);
      } catch (error) {
        recordFailure(
          instrumentId,
          clientFailure(
            lookup,
            "request-failed",
            error instanceof Error ? error.message : "证券元数据请求失败",
          ),
        );
      } finally {
        if (blockingInstrumentIds.has(instrumentId)) {
          blockingJobs -= 1;
          if (blockingJobs === 0) finishBlockingJobs?.();
        }
      }
    }
  };

  const backgroundRefresh = Promise.all(
    Array.from(
      { length: workerCount(options.concurrency, pending.length) },
      worker,
    ),
  ).then(
    () => undefined,
    () => undefined,
  );
  await blockingDone;

  return { resolved, unresolved, cacheHits, backgroundRefresh };
}

export async function refreshInstrumentMetadata(
  lookup: InstrumentLookup,
  options: Omit<ResolveOptions, "forceRefresh">,
) {
  const instrumentId = canonicalInstrumentId(lookup.symbol, lookup.market);
  const result = await resolveInstrumentMetadataBatch([lookup], {
    ...options,
    forceRefresh: true,
  });
  return result.resolved.get(instrumentId);
}
