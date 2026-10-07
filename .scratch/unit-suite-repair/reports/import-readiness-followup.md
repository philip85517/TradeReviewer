# R01 import readiness follow-up

## Observed boundary

The original HEAD test is `keeps library context through a confirmed import with
failed market refresh` in `app/components/trade-review-workspace.test.tsx`. The
failure log `workspace-three-green-one.log` shows that the pre-import assertion at
line 3647 had already passed:

```ts
await screen.findByLabelText("图表工具栏");
```

The failing assertion is the second lookup at line 3647, after the confirm action and
after `merge.mock.calls` has observed a payload whose `executions.length === 3`.
The DOM remains `is-review` without the chart toolbar, which is consistent with the
workspace's `review-workspace-loading` branch. This is a post-merge readiness problem;
it does not show that import confirmation failed to save the three records.

## Exact state and await chain

The confirmation handler computes the three-record `mergedExecutions`, then awaits:

```ts
await storageClient.mergeExecutions({ executions: mergedExecutions, ... });
```

Only after that await it calls `setImportedExecutions(mergedExecutions)` and selects the
first imported summary/episode. In the test's `createLegacySqliteClient`, `mergeExecutions`
is synchronous apart from its `Promise.resolve` return: it writes import history and
the three executions to localStorage, but it does not write market candles. The client
keeps `state` null in this path, so later bootstrap reads use
`exportLegacyBrowserState()`; `getMarketData` reads the fake IndexedDB market repository.
There is no real SQLite request or network wait in this fixture.

The state update changes the selected instrument's hydration key because the existing
XPEV summary changes from two to three trades (the imported execution is a new date).
That causes the inventory effect to abandon the old key and start a fresh read:

1. `rawImportedInstrumentHydrationKey` changes.
2. The inventory effect creates an `AbortController`, calls
   `readInstrumentMarketState(summary, repository, { signal, scheduler })`, and waits
   for `getDailyMarketData`.
3. A successful result sets `marketHydrationKeys`, `marketStates`, and
   `hydratedMarketIds`.
4. Because the active view is still `review` and the instrument is now hydrated, the
   intraday effect starts a second `readInstrumentMarketState` with
   `{ includeDaily: false, includeIntraday: true, priority: "interactive" }`.
5. That read awaits 1h first; because the fake repository is empty, it then awaits 15m.
   Its completion sets both `marketIntradayKeys` and `marketIntradayReadyKeys`.
6. Only when `hydratedMarketIds.has(id)` and `selectedIntradayReady` are both true does
   the render leave the loading branch and mount `RecallWorkspace`/the chart toolbar.

The two required gates are explicit in the render condition:

```tsx
!hydratedMarketIds.has(selectedImportedInstrument.instrument.id) ||
!selectedIntradayReady
```

## What the source supports

The strongest supported explanation is a post-import hydration window, with the
one-second `findByLabelText` budget as the immediate observed boundary. The import
fixture's `mergeExecutions` write itself is synchronous and resolved before the spy
assertion, so a pending three-record write is not the cause.

There is a real cancellation interaction, but no evidence of a permanently unresolved
promise. On the key change, the previous inventory/intraday effects abort their
controllers and the scheduler releases their subscribers. The legacy fixture's
`getMarketData` signature ignores the optional AbortSignal, so an already-started fake
IndexedDB request can remain active until its transaction settles. The scheduler
deliberately keeps such an active slot occupied, and the new read may queue behind it.
This can add latency when the import lands while the initial daily/intraday reads are
still active. The scheduler's normal timeout is 10 seconds, but the test's
`findByLabelText` waits only 1 second; this is a bounded contention/ordering candidate,
not proof of a leaked promise.

The fake IndexedDB path is therefore involved in the readiness chain, but the source
does not show a missing `await` in the fixture or a SQLite transport deadlock. The
production effects also have ownership checks (`active`, run IDs, and key checks), so a
late pre-import result is prevented from publishing. A pure timeout explanation is
insufficient by itself: the changed hydration key necessarily requires daily plus
intraday reads again, and cancellation may leave already-started fake-IDB tasks active
briefly.

## Narrow conclusion and follow-up

The minimal evidence-backed diagnosis is: import confirmation completes with three
executions, then changes the summary key and re-enters the daily/intraday local-market
hydration pipeline; the chart remains gated until both reads complete. The failure
occurs at the first post-import toolbar lookup, so it cannot be attributed to the later
return-to-library assertion.

The next diagnostic should capture the timing of the two gates around the existing
post-import assertion (without changing the default timeout): inspect the loading
section's `aria-busy`, and instrument/spy the fixture client's `getMarketData` calls to
record daily, 1h, and 15m completion order. If all three calls complete after the
one-second lookup, the smallest repair is an awaited readiness seam in this test. If an
old request remains active across the key change, the fixture client should expose the
signal to its IDB reads or the component should avoid restarting a still-valid read;
that decision requires timing evidence. No product or test change is justified by the
current log alone.
