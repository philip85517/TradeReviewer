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
};

type ResolveOptions = {
  repository: InstrumentMetadataRepository;
  fetcher?: typeof fetch;
  concurrency?: number;
  forceRefresh?: boolean;
  signal?: AbortSignal;
};

type ProviderSource = Exclude<InstrumentMetadataSource, "statement">;

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
          resolved.set(
            instrumentId,
            validateResolvedInstrument(record, lookup),
          );
          cacheHits += 1;
          return false;
        } catch {
          return true;
        }
      });
    } catch {
      // A broken cache read must not prevent independent network resolution.
    }
  }

  let nextJob = 0;
  const worker = async () => {
    while (nextJob < pending.length) {
      const job = pending[nextJob];
      nextJob += 1;
      if (!job) return;
      const [instrumentId, lookup] = job;

      if (options.signal?.aborted) {
        unresolved.set(
          instrumentId,
          clientFailure(lookup, "aborted", "证券元数据请求已取消"),
        );
        continue;
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
        unresolved.set(
          instrumentId,
          clientFailure(
            lookup,
            options.signal?.aborted ? "aborted" : "request-failed",
            error instanceof Error ? error.message : "证券元数据请求失败",
          ),
        );
        continue;
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        unresolved.set(
          instrumentId,
          clientFailure(lookup, "invalid-response", "证券元数据响应无效"),
        );
        continue;
      }
      if (!response.ok) {
        unresolved.set(instrumentId, parseFailure(body, lookup));
        continue;
      }
      if (options.signal?.aborted) {
        unresolved.set(
          instrumentId,
          clientFailure(lookup, "aborted", "证券元数据请求已取消"),
        );
        continue;
      }

      let record: ResolvedInstrument;
      try {
        record = validateResolvedInstrument(body, lookup);
      } catch {
        unresolved.set(
          instrumentId,
          clientFailure(lookup, "invalid-response", "证券元数据响应无效"),
        );
        continue;
      }

      try {
        await options.repository.put(record);
      } catch (error) {
        unresolved.set(
          instrumentId,
          clientFailure(
            lookup,
            "cache-write-failed",
            error instanceof Error ? error.message : "证券元数据缓存失败",
          ),
        );
        continue;
      }
      resolved.set(instrumentId, record);
    }
  };

  await Promise.all(
    Array.from(
      { length: workerCount(options.concurrency, pending.length) },
      worker,
    ),
  );

  return { resolved, unresolved, cacheHits };
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
