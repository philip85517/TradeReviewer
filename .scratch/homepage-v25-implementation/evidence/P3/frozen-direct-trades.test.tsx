import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSqliteHttpClient } from "../../../../app/lib/storage/sqlite-http-client";
import type { StorageBootstrap } from "../../../../app/lib/storage/sqlite-contracts";
import { buildInstrumentTradeSummaries } from "../../../../app/lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../../../app/lib/trades/library";
import { filterEntriesBySharedScope } from "../../../../app/lib/reviews/shared-scope";
import { buildHomepageCatalog } from "../../../../app/components/homepage-v25/catalog-model";
import { explicitLiveEntries } from "../../../../app/components/homepage-v25/holdings-model";
import { homepageCollectionState } from "../../../../app/components/homepage-v25/session-model";
import { useHomepageHost } from "../../../../app/components/homepage-v25/use-homepage-host";

// Matches the real seed script's CN instrument/source shape. It is not a DB
// snapshot: the frozen production client and entry/catalog builders are used,
// but HTTP is answered in memory and no service or database is accessed.
const instrument = { id: "CN-SH:600100", market: "CN-SH", symbol: "600100", name: "P1 持仓 01", currency: "CNY" };
const bootstrap: StorageBootstrap = {
  schemaVersion: 1, migration: null, importHistory: [], instruments: [instrument],
  reviews: [], reviewStates: [], tagSuggestions: [], marketDataJobs: [], settings: {},
  executions: [{
    id: "homepage-p1-acceptance-v1:p1-count-09:CN-SH:600100:buy",
    accountId: "p1-count-09", accountLabel: "P1 09 行", instrument,
    source: { platform: "homepage-p1-acceptance-v1", fileName: "ISOLATED_ACCEPTANCE_ONLY", row: 1, tradeNature: "live", positionEffect: "open-long" },
    side: "buy", quantity: "20.125", price: "100", fee: "1", executedAt: "2026-10-20T16:05:00.000Z",
  }],
};
const empty = { entries: buildTradeLibraryEntries([], {}, {}), storedInstruments: [] as StorageBootstrap["instruments"] };
const accounts = [{ id: "p1-count-09", label: "P1 09 行" }];
const strictUrl = "/trades?scope=live&market=a&accounts=p1-count-09&rangeMode=all&symbol=SSE%3A600100";
async function readBundle() {
  const client = createSqliteHttpClient(async () => Response.json(bootstrap));
  const loaded = await client.getBootstrap();
  return { entries: buildTradeLibraryEntries(buildInstrumentTradeSummaries(loaded.executions), {}, {}), storedInstruments: loaded.instruments };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); history.replaceState(null, "", "/home"); });

describe("frozen P3 direct ordinary collection diagnosis", () => {
  it("retains the real seed-shaped two-part CN alias and its exact live collection without inventing a class", async () => {
    const data = await readBundle();
    const catalog = buildHomepageCatalog(data.entries, data.storedInstruments);
    expect(catalog.identities["SSE:600100"]).toEqual(["CN-SH:600100"]);
    expect(catalog.items[0]).toMatchObject({ identity: null, assetType: "unknown", exchange: "SSE" });
    const state = homepageCollectionState({ live: true, market: "a", accounts: ["p1-count-09"], rangeMode: "all", symbolIdentity: "SSE:600100" }, catalog.identities["SSE:600100"]);
    expect(state.collectionInstrumentId).toBe("CN-SH:600100");
    expect(filterEntriesBySharedScope(explicitLiveEntries(data.entries), { nature: "live", accountIds: ["p1-count-09"], simulationRunId: null, reportCurrency: "original" })).toHaveLength(1);
  });

  it("RED: a cold direct scoped /trades must publish ready bootstrap entries rather than the first empty bundle", async () => {
    history.replaceState(null, "", strictUrl);
    const loaded = await readBundle();
    const reload = vi.fn(async (requestId: number) => ({ requestId, data: await readBundle() }));
    const { result, rerender } = renderHook(({ ready, data }) => useHomepageHost({
      enabled: true, ready, readOnInitialize: true, revision: ready ? 1 : 0, data,
      accounts: ready ? accounts : [], identities: buildHomepageCatalog(data.entries, data.storedInstruments).identities,
      catalogFor: current => ({ accounts, identities: buildHomepageCatalog(current.entries, current.storedInstruments).identities }),
      reload, guard: async () => true,
    }), { initialProps: { ready: false, data: empty } });
    expect(result.current.initialized).toBe(false);
    rerender({ ready: true, data: loaded });
    await waitFor(() => expect(result.current.initialized).toBe(true));
    await act(async () => {});
    expect(result.current.route).toMatchObject({ page: "trades", collectionOrigin: "homepage", error: null });
    // This is the same source used by Workspace ordinaryEntries at line 2240.
    const collection = filterEntriesBySharedScope(explicitLiveEntries(result.current.data.entries), { nature: "live", accountIds: ["p1-count-09"], reportCurrency: "original", simulationRunId: null });
    expect({ entryCount: result.current.data.entries.length, collectionCount: collection.length, ownedReads: reload.mock.calls.length }).toEqual({ entryCount: 1, collectionCount: 1, ownedReads: 1 });
  });

  it("control: cold /home accepts the same ready bootstrap through one owned read", async () => {
    history.replaceState(null, "", "/home?scope=live&market=a&accounts=p1-count-09&rangeMode=all");
    const loaded = await readBundle();
    const reload = vi.fn(async (requestId: number) => ({ requestId, data: await readBundle() }));
    const { result, rerender } = renderHook(({ ready, data }) => useHomepageHost({
      enabled: true, ready, readOnInitialize: true, revision: ready ? 1 : 0, data,
      accounts: ready ? accounts : [], identities: buildHomepageCatalog(data.entries, data.storedInstruments).identities,
      catalogFor: current => ({ accounts, identities: buildHomepageCatalog(current.entries, current.storedInstruments).identities }),
      reload, guard: async () => true,
    }), { initialProps: { ready: false, data: empty } });
    rerender({ ready: true, data: loaded });
    await waitFor(() => expect(result.current.ui.requests.global).toBeNull());
    expect(result.current.data.entries).toHaveLength(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
