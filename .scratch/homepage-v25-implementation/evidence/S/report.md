# Homepage V2.5 state contract — implementation-ready

## Scope

Pure homepage state and navigation contract only. No product component, workspace/shared type, database, service, or business-row cache was changed.

## Exported contract

- `HomepageScope`, `HomepageDraft`, `HomepageApplied`, `HomepageSnapshot`, `HomepageState`, `HomepageRequest`, `HomepageApplyResult` — typed boundaries for live scope, draft/applied groups, UI-only return snapshot, and request identity.
- `createHomepageState` — creates a state with one authoritative applied group and a UI-only snapshot.
- `beginHomepageApply` / `applyHomepageResult` / `retryHomepageApply` — atomic group commit; a result is accepted only when both `generation` and `scopeKey` match. Failure preserves applied and draft; retry allocates a new generation. `homepageRequestTimedOut` marks the 15-second manual-recovery boundary.
- `cancelHomepageDraft`, `changeHomepageIdentity`, `clearHomepageAttachments`, `resetHomepageDefaults` — cancel preserves draft; identity change discards old attachments; clear/reset preserve dates.
- `encodeHomepageSnapshot` / `decodeHomepageSnapshot` — versioned UI-only snapshot round-trip with malformed/version validation.
- `parseHomepageNavigation` / `serializeHomepageNavigation` — `/home` and `/trades` scope parameters (`scope=live`, market, explicit accounts, range/date/symbol identity), no `queue`; optional allowed account/symbol sets reject unknown values without broadening.

## Snapshot contract

`HomepageSnapshot` stores only `scope`, holdings query/sort/page, contribution mode and per-mode local category/sort/page plus selected market/symbol, scroll position, focus, and future-disclosure source IDs. It does not store business objects or computed totals. Consumers can restore this snapshot after reload/navigation and fall back focus to `title` when an object no longer exists.

## TDD evidence

- RED: targeted Vitest initially failed because `homepage-v25-state.ts` did not exist; failure was the unresolved import from the new test.
- GREEN: fixed Node 26 targeted run passed 6 tests.
- Typecheck: fixed Node 26 `tsc --noEmit --pretty false` passed.

Commands:

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node ./node_modules/vitest/vitest.mjs run app/lib/reviews/homepage-v25-state.test.ts
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node ./node_modules/typescript/bin/tsc --noEmit --pretty false
```

UI/browser/database/visual gates are not applicable to this pure module and remain for coordinator integration acceptance.

## Round 2 revision notes

The contract now keeps a monotonic `requestCounter` across success, cancel, retry, and identity changes. Each request carries its target draft; acceptance requires generation, scope key (including sorted attachments), and the returned payload to match. A stale response after timeout therefore cannot commit.

Dates use calendar validation and ordered inclusive ranges. Date-only trade URLs infer `rangeMode=date`; `rangeMode=all` rejects date bounds. Invalid market values normalize to `all` with a warning, while explicit empty/unknown accounts remain errors. `*` is the explicit all-accounts URL representation.

The snapshot is a strict UI-only whitelist: independent history range, attachment filters, global search state, return/detail state, per-contribution-mode drilldown, and existing holdings/contribution navigation are represented. Decoder validation rejects unknown top-level/nested fields and business-row payloads. Snapshot scope changes only after a successful atomic apply.

`markHomepageRequestTimedOut` marks a request as manual recovery; `applyHomepageResult` refuses every later response until a new retry is started. Cancel and identity transitions advance the persistent counter, so every future request remains monotonic.

Final revision: `*` is the sole explicit all-accounts URL value and is accepted by both serializer and parser. Draft/applied/snapshot all use the typed `HomepageAttachments` object. Scope keys normalize only scope fields plus sorted attachment categories, without duplicating attachments into scope. Calendar validation catches malformed dates without throwing; range modes enforce their allowed fields. Encoding projects to an explicit UI-only whitelist before serialization, and decoding applies nested whitelist validation. The snapshot now carries period preset/actual dates, independent history range, per-mode market/symbol/drilldown state, search result scroll/selection/trigger focus, and exact return focus plus missing-container-title fallback through `restoreHomepageFocus`.

Workspace adapter note: P1 should map `HomepageState.applied` to the page's single range/filter query, use `beginHomepageApply` for edits, pass the request's generation/scope key and complete target draft to the loader, and call `applyHomepageResult` only with the complete returned draft. Persist `encodeHomepageSnapshot(state.snapshot)` separately from business data; restore with `decodeHomepageSnapshot`, then rehydrate rows from the applied scope. This preserves one scope authority and avoids caching business objects in the snapshot.
