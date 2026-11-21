import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { openSqliteDatabase } from '../../../db/sqlite';
import { SqliteStore } from '../storage/sqlite-store';
import { LocalizedMetadataHydrationQueue, LOCALIZED_LOOKUP_TTL_MS } from './localized-metadata-hydration';
import type { InstrumentMetadataRepository } from '../storage/instrument-metadata-repository';

it('persists a valid no-Chinese lookup across reopen, preserves source time, and retries after TTL', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'localized-ttl-'));
  const path = join(directory, 'test.sqlite');
  let db = openSqliteDatabase(path);
  let store = new SqliteStore(db);
  const initial = { market: 'HK' as const, symbol: '100', name: 'MINIMAX-W', assetType: 'stock' as const, source: 'tencent' as const, confidence: 'portal' as const, resolvedAt: '2026-10-24T00:00:00.000Z' };
  store.mergeTradeData({ instruments: [{ id: 'HK:100', market: 'HK', symbol: '100', name: 'MINIMAX-W', currency: 'HKD', metadata: initial }], executions: [] });
  const repository: InstrumentMetadataRepository = {
    get: async id => store.getInstrumentMetadata([id])[0]?.metadata,
    getMany: async ids => new Map(store.getInstrumentMetadata(ids).flatMap(row => row.metadata ? [[row.id, row.metadata] as const] : [])),
    put: async value => store.putInstrumentMetadata(value),
  };
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(initial));
  const run = async () => {
    const queue = new LocalizedMetadataHydrationQueue(new Set());
    queue.enqueue(store.getInstruments());
    await queue.run({ repository, fetcher, signal: new AbortController().signal, reload: async () => store.getInstruments(), onProgress: () => {} });
  };
  try {
    await run();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.getInstrumentMetadata(['HK:100'])[0].metadata?.resolvedAt).toBe(initial.resolvedAt);
    expect(store.getInstrumentMetadata(['HK:100'])[0].metadata?.localizedNameLookup?.source).toBe('tencent');
    db.close();
    db = new DatabaseSync(path);
    store = new SqliteStore(db);
    await run();
    expect(fetcher).toHaveBeenCalledTimes(1);
    // An ordinary metadata refresh must retain the dedicated successful lookup.
    store.putInstrumentMetadata({ ...initial, resolvedAt: new Date().toISOString() });
    await run();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + LOCALIZED_LOOKUP_TTL_MS + 1_000);
    try { await run(); } finally { clock.mockRestore(); }
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
