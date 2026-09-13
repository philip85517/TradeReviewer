import { instrumentPresentation } from "../instruments/instrument-presentation";
import { canonicalInstrumentId } from "../instruments/display-name";
import type { InstrumentLookup } from "../instruments/metadata-contracts";
import {
  resolveInstrumentMetadataBatch,
  type ResolveBatchResult,
} from "../instruments/resolve-service";
import type { InstrumentMetadataRepository } from "../storage/instrument-metadata-repository";
import type { StoredInstrument } from "../storage/sqlite-contracts";

export const LOCALIZED_METADATA_HYDRATION_BATCH_SIZE = 12;
const BATCH_INTERVAL_MS = 30_000;

function waitForBatch(delay: number, signal: AbortSignal): Promise<void> {
  if (delay <= 0 || signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function hasCachedLocalizedName(instrument: StoredInstrument) {
  return Boolean(instrument.localizedName ?? instrument.metadata?.localizedName);
}

/**
 * Selects only legacy US/HK rows that still need a Chinese display overlay.
 * A Chinese original name is already user-facing and does not need a lookup.
 */
export function missingLocalizedMetadataLookups(
  instruments: StoredInstrument[],
): InstrumentLookup[] {
  const seen = new Set<string>();
  return instruments.flatMap((instrument) => {
    if (
      (instrument.market !== "US" && instrument.market !== "HK") ||
      hasCachedLocalizedName(instrument) ||
      instrumentPresentation(instrument).hasChineseName
    ) {
      return [];
    }
    const id = canonicalInstrumentId(instrument.symbol, instrument.market);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ market: instrument.market, symbol: instrument.symbol }];
  });
}

export function chunkLocalizedMetadataLookups(
  lookups: InstrumentLookup[],
  size = LOCALIZED_METADATA_HYDRATION_BATCH_SIZE,
): InstrumentLookup[][] {
  const chunkSize = Math.max(1, Math.floor(size));
  const chunks: InstrumentLookup[][] = [];
  for (let index = 0; index < lookups.length; index += chunkSize) {
    chunks.push(lookups.slice(index, index + chunkSize));
  }
  return chunks;
}

type HydrationRunOptions = {
  repository: InstrumentMetadataRepository;
  fetcher?: typeof fetch;
  signal: AbortSignal;
  reload: () => Promise<StoredInstrument[]>;
  onProgress: (instruments: StoredInstrument[]) => void;
  resolver?: (
    lookups: InstrumentLookup[],
    options: {
      repository: InstrumentMetadataRepository;
      fetcher: typeof fetch;
      signal: AbortSignal;
      concurrency: number;
      forceRefresh: true;
    },
  ) => Promise<ResolveBatchResult>;
};

/**
 * Persistent, sequential hydration queue. Only the batch removed from the
 * queue is marked attempted. An aborted batch is put back so effect cleanup
 * cannot silently lose the remainder of a legacy inventory.
 */
export class LocalizedMetadataHydrationQueue {
  private readonly queue = new Map<string, InstrumentLookup>();
  private running?: Promise<void>;
  private runningSignal?: AbortSignal;
  private runnerOptions?: HydrationRunOptions;
  private restart?: Promise<void>;
  private nextBatchAt = 0;
  private readonly retriedRateLimits = new Set<string>();

  constructor(private readonly attempted: Set<string>) {}

  enqueue(instruments: StoredInstrument[]) {
    let added = 0;
    for (const lookup of missingLocalizedMetadataLookups(instruments)) {
      const id = canonicalInstrumentId(lookup.symbol, lookup.market);
      if (this.attempted.has(id) || this.queue.has(id)) continue;
      this.queue.set(id, lookup);
      added += 1;
    }
    const runnerOptions = this.runnerOptions;
    if (added > 0 && !this.running && runnerOptions && !runnerOptions.signal.aborted) {
      void this.run(runnerOptions);
    }
    return added;
  }

  get pendingCount() {
    return this.queue.size;
  }

  run(options: HydrationRunOptions): Promise<void> {
    if (!options.signal.aborted) this.runnerOptions = options;
    if (this.running) {
      if (!this.runningSignal?.aborted) return this.running;
      if (this.restart) return this.restart;
      const restart: Promise<void> = this.running.then(async () => {
        this.restart = undefined;
        const next = this.runnerOptions;
        if (next && !next.signal.aborted) await this.run(next);
      });
      this.restart = restart;
      return restart;
    }
    return this.start(options);
  }

  private start(options: HydrationRunOptions): Promise<void> {
    let operation: Promise<void>;
    operation = this.runLoop(options).finally(() => {
      if (this.running === operation) {
        this.running = undefined;
        this.runningSignal = undefined;
        const next = this.runnerOptions;
        if (this.queue.size > 0 && next && !next.signal.aborted) {
          void this.run(next);
        }
      }
    });
    this.running = operation;
    this.runningSignal = options.signal;
    return operation;
  }

  private async runLoop(options: HydrationRunOptions) {
    const resolver = options.resolver ?? resolveInstrumentMetadataBatch;
    const fetcher = options.fetcher ?? fetch;
    while (this.queue.size > 0 && !options.signal.aborted) {
      if (Date.now() < this.nextBatchAt) {
        await waitForBatch(this.nextBatchAt - Date.now(), options.signal);
      }
      if (options.signal.aborted) return;
      const batch = [...this.queue.values()].slice(0, LOCALIZED_METADATA_HYDRATION_BATCH_SIZE);
      this.nextBatchAt = Date.now() + BATCH_INTERVAL_MS;
      for (const lookup of batch) {
        const id = canonicalInstrumentId(lookup.symbol, lookup.market);
        this.queue.delete(id);
        this.attempted.add(id);
      }
      try {
        const result = await resolver(batch, {
          repository: options.repository,
          fetcher,
          signal: options.signal,
          concurrency: 3,
          forceRefresh: true,
        });
        await result.backgroundRefresh;
        // Space completed batches too: slow requests must not bunch up with
        // the next batch near a server rate-limit window boundary.
        this.nextBatchAt = Date.now() + BATCH_INTERVAL_MS;
        if (options.signal.aborted) {
          this.requeue(batch);
          return;
        }
        for (const lookup of batch) {
          const id = canonicalInstrumentId(lookup.symbol, lookup.market);
          const failure = result.unresolved.get(id);
          if (failure?.attempts.some(attempt => attempt.code === "rate-limited" || attempt.code === "source-rate-limited")
            && !this.retriedRateLimits.has(id)) {
            this.retriedRateLimits.add(id);
            this.queue.set(id, lookup);
          }
        }
        options.onProgress(await options.reload());
      } catch {
        this.nextBatchAt = Date.now() + BATCH_INTERVAL_MS;
        if (options.signal.aborted) {
          this.requeue(batch);
          return;
        }
        // A failed lookup is considered attempted; it must not retry forever.
      }
    }
  }

  private requeue(batch: InstrumentLookup[]) {
    const next = new Map<string, InstrumentLookup>();
    for (const lookup of batch) {
      const id = canonicalInstrumentId(lookup.symbol, lookup.market);
      this.attempted.delete(id);
      next.set(id, lookup);
    }
    for (const [id, lookup] of this.queue) next.set(id, lookup);
    this.queue.clear();
    for (const [id, lookup] of next) this.queue.set(id, lookup);
  }
}
