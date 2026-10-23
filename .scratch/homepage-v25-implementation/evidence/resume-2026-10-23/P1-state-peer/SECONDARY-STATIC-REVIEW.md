# P1 metadata / ordinary-library secondary static review

Review captured 2026-10-22T17:49:25.145Z–17:49:25.172Z (2026-10-23 01:49:25 Shanghai). Read-only source review; no DB, browser, service, persistence test, or additional owned-read probe. Exact 18 files and SHA-256 are in `secondary-static-manifest.json`, with immutable copies in `secondary-static-source/`. Workspace SHA `55e40ada6ba54e64fe1e714eeca7af7a267822471fff5169ce1761b6af52db8c`; sqlite-store SHA `878a0b0b21b0324a0219469ea90713238db116e409ab57f416e1a254474cd2ee`. This is scoped peer review, not P1 acceptance.

## M01 — broad trade merge bypasses official-exchange validation

**Confirmed source-level validation gap; persistence/HTTP reproduction NOT VERIFIED.** `/api/storage/trades` accepts the following well-formed JSON shape; its metadata should be rejected by the same contract as the narrow metadata endpoint:

```json
{
  "instruments": [{
    "id": "US:AAPL", "symbol": "AAPL", "name": "Apple Inc.", "market": "US", "currency": "USD",
    "metadata": {
      "market": "US", "symbol": "AAPL", "name": "Apple Inc.", "assetType": "stock",
      "source": "sec", "confidence": "official", "resolvedAt": "2026-10-23T00:00:00Z",
      "exchange": {"code": "US", "source": "nasdaq", "resolvedAt": "2026-10-23T00:00:00Z"}
    }
  }],
  "executions": []
}
```

1. `app/api/storage/trades/route.ts:19–23,37`: `parseMerge` checks arrays and casts their elements; it forwards the instrument to `mergeTradeData`.
2. `app/lib/storage/sqlite-store.ts:411–431,1258,1263`: `validateInstrument` checks metadata required strings, matching market/symbol, localized name, and JSON safety. It never invokes `validateResolvedInstrument`, so `exchange.code/source/resolvedAt` are unchecked.
3. `sqlite-store.ts:1586–1596,1613`: `putInstrument` repeats the same shallow validator, then calls `mergeInstrumentExchange(previous, metadata)` and serializes the result. With no prior evidence, `US` is the sole candidate; with older valid evidence, the later timestamp can replace it. Changing the witness to `code: "NASDAQ", source: "tencent"` similarly introduces nonofficial evidence.
4. `sqlite-store.ts:827–842`: `mapInstrumentRow` parses metadata JSON without applying the metadata validator. `trade-review-workspace.tsx:2168–2171,2197,2202` forwards exchange evidence from bootstrap into the owned catalog. `holdings-model.ts:72–74` treats any truthy `exchange.code` as identity, yielding `US:AAPL` for the first witness or a trusted-looking `NASDAQ:AAPL` for the second.
5. The narrow metadata path **does** reject both: `putInstrumentMetadata` calls `validateResolvedInstrument`; that checks exchange code in NASDAQ/NYSE/ARCA, official source nasdaq/sec, valid timestamp, US market. The boundary inconsistency is the cause; adding a second holdings-specific validator would leave the storage contract split.

Suggested minimal owner test: make the broad merge reject invalid exchange code/source/date and non-US exchange before any transaction write, while preserving valid official exchange through name-only refresh, late conflict, core instrument writes, bootstrap, and owned read. Use the existing shared metadata normalizer at the broad instrument boundary. This report does not authorize or perform that change.

## M02 — normal official persistence / merge chain: NONE found in reviewed static path

NASDAQ and SEC providers attach explicit official evidence; US alone does not invent an exchange. `validateResolvedInstrument` validates and normalizes it. `resolve-service` merges exchange independently of the main record/name clock, preserving it when refreshed metadata lacks the field. API repository and HTTP serialization send the complete record. Narrow metadata API/store revalidate; `putInstrumentMetadata` combines name recency with independent exchange recency, and core writes preserve previous exchange evidence. `mergeInstrumentExchange` selects the newest exchange, with deterministic same-time precedence, so an older conflicting exchange cannot replace a newer one. `getInstruments`/bootstrap retain the field and the current owned bundle's `catalogFor` consumes that same bundle's evidence. Existing focused test assertions cover these pure cases; they were read, not rerun in this secondary review. Actual persistence, return and reload remain root-owned browser/isolated-DB checks.

## L01 — ordinary execution list versus final-close statistics: NONE found in reviewed static scope

`session-model.homepageCollectionState` maps the actual homepage period into execution-date membership, live ordinary stocks, account/market/instrument filters, and leaves selected object empty. It does not force queue. `library-browse-state.ts:349–351,411–430` includes episodes with at least one matching execution, while retaining their complete ledger; stock display separately limits visible executions. Execution date prefers source trading date/market calendar date, with exchange-calendar timestamp fallback (`app/lib/trades/library.ts:78–87`), preserving ordinary-library semantics.

`tradeLibraryPerformanceFilterState` (`library-browse-state.ts:633–637`) clears execution membership only for statistics and maps it to final-close-date bounds, retaining other scope filters. `trade-library.tsx:642–688` recomputes those statistics from the complete `browseEntries` using that state; it does not reuse the execution-filtered list. Open episodes and rounds closed after the period can therefore appear in the execution list without entering period final-close statistics. Full round context remains available to review. Existing `library-browse-state.test.ts:577` directly covers closes-later / closes-inside / open and full-ledger retention; source assertions were reviewed only.

No new scope problem was established in this path. Real collection navigation, data reload, and visual list/statistics behavior remain NOT VERIFIED here. The 15 prepared owned-read probes are unchanged.
