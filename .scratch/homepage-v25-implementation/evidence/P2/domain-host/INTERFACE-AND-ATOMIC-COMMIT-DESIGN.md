# Three-domain host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Root has assigned this single worker; no further agents, commits, or integration are authorized.

**Goal:** Add opaque period/history read slots to the existing host, with S-qualified atomic label/data replacement and independent request lifecycles.

**Architecture:** S remains the only date/range normalization and request-acceptance authority. Session helpers return an explicit accepted flag and one complete session object; the hook publishes that object with one `setSession`. The existing global loader and Workspace bootstrap callback remain usable without domain configuration.

**Tech Stack:** Existing React 19 / TypeScript / Vitest, pinned Node 26.0.0. No new dependency, financial computation, service, database, or browser operation.

**Spec:** `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`, HP02:193–252, HP05:349–432, HP06:434–465, HP09:467–515; exact reference set in `ROOT-DISPATCH.md`.

## Status and approval boundary

2026-10-23; owner `/root/metrics_candidate2`, actual gpt-6.1-sol / ultra. This is a design proposal, **not RED, implementation-ready, or acceptance**. Await root's explicit approval before editing the four product/test files or running tests. New host capability 0/3; P1 2/3 FAIL and all old FAIL / NOT VERIFIED / leaf counts remain in force. History stats candidate1 and MetricCards candidate3 remain frozen.

Only the four assigned `session-model.{ts,test.ts}` / `use-homepage-host.{ts,test.tsx}` files and this evidence directory may be written. Workspace, Surface, S, financial code, all leaves, shared tracking, and old evidence remain read-only.

## Read findings and current caller

- S already exposes independent `requests/errors/timeouts` for global/period/history and performs generation, semantic scope key, current dependency, and exact normalized target validation. Independent period/history keys do not depend on each other's ranges. `updateHomepageUi` preserves `startedAt`.
- `session-model.ts` currently stores only `{ui,data}`. `finishHomepageRead` atomically finishes one global read but does not expose S's accepted flag. It has no local slots.
- `use-homepage-host.ts` currently has one global pending owner, loader and timer. `options.data` is intentionally a seed; subsequent ambient publication is not owned acceptance.
- S global identity/navigation starts clear local requests. S global apply/refresh starts do not clear them. The host/session consumer must cancel active local requests through S before **every** global start, including refresh/retry, so local data cannot commit after global read ownership changes. No S edit is required.
- The existing global timer schedules at `startedAt + 15_010`. This is an existing frozen legacy boundary, not a newly reproduced defect. The proposed configured three-domain path uses the specified 15,000 ms absolute deadline (including a response-time check); the unconfigured legacy timer policy is retained. Root must explicitly approve this distinction with this design before implementation; it does not reopen an old host repair round.
- Current sole product caller is `trade-review-workspace.tsx:2182–2250`. `reload(id, context?)` produces a whole owned bootstrap/daily/FX bundle or a collection-only catalog. Its `onReadAccepted(data)` merges inventory and daily data with existing review/drawing CAS. Local payloads must never reach that callback.
- Current `HomeSurface` call at `trade-review-workspace.tsx:6025–6036` consumes only the existing host fields. This package does not add Surface or Workspace consumers. The future caller contract below is explicit; its live wiring remains NOT VERIFIED.

## Exact additive types

Names below are proposed public signatures. Internal helper naming may differ only without changing this interface or its behavior; any substantive deviation goes back to root.

```ts
// session-model.ts — values are opaque, complete caller-prepared packages.
export type HomepageDomainData<TP, TH> = { period: TP; history: TH };
export type HomepageSession<T, TP = never, TH = never> = {
  ui: HomepageState;
  data: T; // complete accepted global/current source; never overwritten by P/H
  domainData: HomepageDomainData<TP, TH> | null;
};
export type HomepageSessionCompletion<T, TP = never, TH = never> = {
  session: HomepageSession<T, TP, TH>;
  accepted: boolean;
};

export function createHomepageSession<T, TP = never, TH = never>(
  ui: HomepageState, data: T, domainData?: HomepageDomainData<TP, TH>
): HomepageSession<T, TP, TH>;
export function startHomepageRead<T, TP = never, TH = never>(
  model: HomepageSession<T, TP, TH>, intent: HomepageReadIntent, now?: number
): HomepageSession<T, TP, TH>;

export function completeHomepageGlobalRead<T, TP = never, TH = never>(
  model: HomepageSession<T, TP, TH>, request: HomepageRequest, data: T,
  options?: {
    sourceBytes?: string;
    // A pure extractor invoked only after S accepts and source UI is restored.
    // Required at runtime if model.domainData is configured; never merge slots.
    domainData?: (accepted: HomepageSnapshot) => HomepageDomainData<TP, TH>;
  }
): HomepageSessionCompletion<T, TP, TH>;
export function completeHomepagePeriodRead<T, TP, TH>(
  model: HomepageSession<T, TP, TH>,
  request: HomepageRequest<HomepagePeriod, "period">, data: TP
): HomepageSessionCompletion<T, TP, TH>;
export function completeHomepageHistoryRead<T, TP, TH>(
  model: HomepageSession<T, TP, TH>,
  request: HomepageRequest<HomepageHistoryRange, "history">, data: TH
): HomepageSessionCompletion<T, TP, TH>;

// Existing four-argument API stays available for legacy, unconfigured sessions.
export function finishHomepageRead<T>(
  model: HomepageSession<T>, request: HomepageRequest,
  data: T, sourceBytes?: string
): HomepageSession<T>;
```

`finishHomepageRead` becomes a compatibility wrapper over the explicit completion helper. Configured sessions cannot use this legacy helper to replace only global data. A configured global completion without its complete local-slot extractor fails without changing the old label or any data. Extractor failure is handled as that owned global read's error; there is no intermediate commit.

```ts
// use-homepage-host.ts — existing destination/request/readTarget retained.
export type HomepageHostReadContext = {
  destination: "home" | "trades";
  request: HomepageRequest;
  readTarget: HomepageDraft;
  ranges: { period: HomepagePeriod; historyRange: HomepageHistoryRange };
};
export type HomepageHostDomainSource<T> = {
  data: T;
  // Only global identity/attachments; no period dates masquerading as H input.
  applied: Pick<HomepageApplied,
    "live" | "market" | "accounts" | "symbolIdentity" | "attachments">;
};
export type HomepageHostPeriodReadContext<T> = {
  domain: "period"; destination: "home";
  request: HomepageRequest<HomepagePeriod, "period">;
  source: HomepageHostDomainSource<T>;
};
export type HomepageHostHistoryReadContext<T> = {
  domain: "history"; destination: "home";
  request: HomepageRequest<HomepageHistoryRange, "history">;
  source: HomepageHostDomainSource<T>;
};
export type HomepageHostPeriodReadResult<TP> = {
  request: HomepageRequest<HomepagePeriod, "period">; data: TP;
};
export type HomepageHostHistoryReadResult<TH> = {
  request: HomepageRequest<HomepageHistoryRange, "history">; data: TH;
};
export type HomepageHostDomainAccepted<T, TP, TH> =
  | { domain: "period"; data: TP; context: HomepageHostPeriodReadContext<T> }
  | { domain: "history"; data: TH; context: HomepageHostHistoryReadContext<T> };
export type HomepageHostDomains<T, TP, TH> = {
  seed: HomepageDomainData<TP, TH>;
  fromGlobal: (data: T, context: HomepageHostReadContext,
    accepted: HomepageSnapshot) => HomepageDomainData<TP, TH>;
  reloadPeriod: (context: HomepageHostPeriodReadContext<T>) =>
    Promise<HomepageHostPeriodReadResult<TP>>;
  reloadHistory: (context: HomepageHostHistoryReadContext<T>) =>
    Promise<HomepageHostHistoryReadResult<TH>>;
  onReadAccepted?: (event: HomepageHostDomainAccepted<T, TP, TH>) => void;
};

export type HomepageHostOptions<T, TP = never, TH = never> = {
  enabled: boolean; ready: boolean;
  readOnInitialize?: boolean; readCollections?: boolean;
  revision: number; data: T;
  accounts: readonly { id: string; label: string }[];
  identities: Readonly<Record<string, string | readonly string[]>>;
  catalogFor?: (data: T) => {
    accounts: readonly { id: string; label: string }[];
    identities: Readonly<Record<string, string | readonly string[]>>;
  };
  reload: (requestId: number, context?: HomepageHostReadContext) =>
    Promise<{ requestId: number; data: T; kind?: "collection" }>;
  onReadAccepted?: (data: T) => void;
  guard: (page: "home" | "trades") => Promise<boolean>;
  domains?: HomepageHostDomains<T, TP, TH>;
};
export type HomepageHostDomainActions = {
  onPeriodDraft: (period: HomepagePeriod) => void;
  applyPeriod: (period: HomepagePeriod) => boolean;
  retryPeriodRead: () => boolean;
  cancelPeriodRead: () => void;
  onHistoryDraft: (range: HomepageHistoryRange) => void;
  applyHistory: (range: HomepageHistoryRange) => boolean;
  retryHistoryRead: () => boolean;
  cancelHistoryRead: () => void;
};
// useHomepageHost<T,TP=never,TH=never>(options: HomepageHostOptions<T,TP,TH>)
// keeps its inferred return. Existing return fields retain their types;
// its session is HomepageSession<T,TP,TH> and it adds the actions above.
```

There is no implicit cast between `T`, `TP`, and `TH`. Local results echo the complete original typed token, including its domain/generation/scopeKey/startedAt/target. Host and session helpers require the active token's domain/generation/scopeKey/startedAt to match, not object reference: S clones requests during UI-only updates. The echoed result target is submitted to S, so a same-generation result with a different range cannot relabel data. Source/revisions/asOf/currency/policy qualification is carried in the opaque caller data; this protocol neither invents nor certifies financial evidence.

`ranges` is produced by projecting S's global completion and the existing source-UI restore logic without publishing it; the same pure projection is used for actual completion. It does not implement a second date/range engine. A fresh global loader gets both intended ranges, including source-return history range. `fromGlobal` also receives the actually accepted snapshot after fresh deleted-account fallback. The host never computes dates, currency, money, chart points, or contributions.

## Compatibility and future caller migration

Existing Workspace keeps `reload`, `data`, `catalogFor`, `onReadAccepted(data)`, `guard` and all existing host calls unchanged. Extra read-context fields are additive: its current optional-context function continues to accept them. No Workspace edit is authorized. Without `domains`, `domainData` is null and the new read methods return false / do nothing; no new reads occur. `options.data` and `domains.seed` seed this mount only; rerendering either cannot overwrite an accepted package. Domain capability presence is fixed for a hook mount; a caller changing the capability must remount rather than partially enabling slots.

Future integration owner must provide **both** seeds, the pure complete `fromGlobal` extractor, both loaders, and optionally the typed domain notification. `T` owns accepted source/current MV/holdings; `TP` owns all three period cards + period series + current contribution; `TH` owns all four history cards + history series/buckets + history contribution. Neither local loader returns partial patches. Period/history notifications are observations after acceptance, never bootstrap inventory publication; current Workspace review/drawing CAS and daily-only merge remain unchanged.

Future Surface props must read labels from `session.ui.snapshot` and all corresponding package fields from that same `session`, without independent setData effects. Existing `onUi({historyChartMode})`, contribution views, holdings query/sort/page, focus and drill remain UI-only. The period leaf's raw invalid/empty date draft stays caller-local; `onPeriodDraft` accepts only an S-valid `HomepagePeriod`, not invalid text. Existing controlled leaf signatures do not change.

## Atomic transition design

| Event | S operation and owned lifetime | Single published session | Other data / notifications |
| --- | --- | --- | --- |
| P apply or P retry | `beginHomepagePeriodApply` / `retryHomepageRequest(...,"period")`; keep H owner, replace P owner | New P pending/draft, old applied P label + old complete TP | T/TH unchanged; no accepted callback |
| H apply or H retry | H equivalents; keep P owner | New H pending/draft, old applied H label + old complete TH | T/TP unchanged; contribution mode/view not forced |
| P response | Check mounted/enabled/home owner, exact token and original deadline; S completion with echoed P target | Only on S accepted: new snapshot.period + entire TP together | T/TH references retained; domain callback once; legacy bootstrap callback zero |
| H response | Same with H token and echoed history range | Only on S accepted: new history.range + entire TH together | T/TP references retained; callback once; chart/contribution UI memories retained |
| Any global start | Cancel each active local via `cancelHomepageRequest` before global begin/retry; clear only corresponding local owner refs | Old applied global/P/H labels + old complete data, new global pending | Even same-scope refresh invalidates old local tokens; no extra IO |
| Matching home-global response | Existing catalog/source handling, S accepted, pure complete `fromGlobal` | Accepted UI + fresh T + complete TP + complete TH in one `update` | Exactly one legacy global callback; no local callbacks |
| Matching collection-only response | Existing route/source validation and S acceptance; keep homepage data and both local slots | Existing UI/source behavior; collection catalog remains route-owned separately | Existing global inventory callback only after acceptance; no financial partial package |
| Local failure / token-target mismatch | S completion false/error for matching request | Error with previous complete label + data; draft retained for explicit retry | Other domain unchanged; zero accepted callbacks |
| Local cancel | Clear matching owner, `cancelHomepageRequest` | Old data/label; local draft restored to applied | No IO/callback; late results ignored |
| Local deadline | `markHomepageRequestTimedOut(...,15_000,domain)` against original `startedAt` | Old data/label, local timeout; no automatic retry | Other domain remains live; late success/error has no effect |
| UI-only patch | `updateHomepageUi` only | Updated allowed UI with unchanged tokens' semantic fields/startedAt | No loader, no data change, no deadline extension |
| Guarded route exit / accepted pop / disable / unmount | Cancel new local owners when the exit actually commits; cancelled guard leaves owners live | Route behavior remains existing; no new home-slot publication after leaving | Late results and callbacks ignored, even when `/trades` does not request collection IO |

S completion and all slot extraction are calculated before `update(next)`. There is no `await`, callback, source persistence, or separately rendered data setter between acceptance and publication. Notification happens after `update`; notification exceptions cannot retroactively turn an accepted read into a read failure or publish another business state. No `data === result.data` inference is used as an acceptance flag in the expanded path.

Local starts require enabled + ready + initialized + home route + configured slots + no global request/source recovery. P and H never block each other. While a global read is pending, its complete package owns the dependency transition, so a new local start returns false. A global start supersedes local owners regardless of whether it was manual refresh, focus refresh, identity, attachment apply, retry, or source navigation. An accepted native route exit also invalidates local owners if the collection route performs no read.

Each new local timer is scheduled from `request.startedAt + 15_000`; effect dependencies use stable token fields, not a cloned token object's identity. Before accepting a response the host also checks the same absolute deadline and asks S to mark timeout if reached. Retry creates a fresh S generation and fresh deadline; UI-only operations never do. Clearing timers/ref owners is local; no AbortController or provider API is introduced in this bounded protocol package.

Persist only `encodeHomepageSnapshot` after a matching accepted home commit or authorized UI-only operation. No TP/TH/T value is placed in source bytes/history/storage. P acceptance updates the native home date projection using the existing serializer; H remains UI-only source state. Source-recovery read-only authority is preserved until matching global acceptance. Route guard, compensating pop, deleted-account fallback, ordinary collection target and no-first-episode behavior remain covered by the original assertions.

## Design coverage and gates

All rows are owned by this worker for protocol implementation and root for independent acceptance. HV25 numbers are existing matrix locators, not newly invented element IDs. Reference paths below are under the original `source/images/` directory.

| Existing IDs / original text block | Exact requirement / reference | Journey and planned evidence | Current status |
| --- | --- | --- | --- |
| HV25-14..22; HOME-HP02-B001/B020/B024; HP02:193–252 | P updates cards/series/current contribution, preserves current MV/holdings/history; `period.svg` | Session and hook concurrent P/H literal complete packages; every render's label/package tuple inspected | NOT VERIFIED |
| HV25-33..35; HOME-HP05-B001; HP05:349–394 | H cards/curve/history contribution share range, failure keeps old; `journeys-year.svg`, `history-stats-error.svg` | H completes before P; H-only failure/retry/cancel; all TH fields change together | NOT VERIFIED |
| HV25-36..43; HOME-HP05-B001 (dispatch locator), HP05:395–432 | Both contribution modes retain independent UI; hidden mode's package still updated | Current-visible H commit and history-visible P commit; UI-only mode/filter/drill/sort/page no IO | NOT VERIFIED |
| HV25-44..46/53/55; HOME-HP06-B018/B016; HP06:434–465 and existing URL/return matrix | UI-only source return, exact ordinary collection and original guards; `library-return.svg` | Preserve every old host/session assertion; new slot-preservation/source-return/collection counterexamples | NOT VERIFIED |
| HV25-47..49; HOME-HP09-B001/B028; HP09:467–502 | Complete old label/currency/data pending/error; dual token ownership, 15s manual recovery; `loading--stale-data.svg`, `error--update-failure.svg` | Wrong domain/key/target/startedAt, older generation, supersession, deadline, fail/cancel/retry, ambient seed ignored, unmount/route exit | NOT VERIFIED |
| HP09:504–515 public motion | No visible UI/CSS in this package | Runtime animation remains owned by accepted controlled leaves; this package commits one terminal complete package, no staged data replacement | Visual / mouse N/A for this pure host package; full UI remains NOT VERIFIED |

UI audit trigger is data/state wiring development. The scoped inventory here is request intents, state transitions, callbacks and source/route boundaries, exercised by real hook/session tests with synthetic events. There is no rendered product control, no new dimensions, and no UI write in this package: visual, mouse, physical/emulated touch and database-write gates are N/A **for this package only**. Functional protocol is NOT VERIFIED until implementation/tests and independent root acceptance. Full Surface controls, actual financial reads/curves, real persistence-return-reload and visual comparison remain integration NOT VERIFIED; callbacks cannot satisfy those gates.

## Review focus / required counterexamples

1. H then P completion must preserve the other slot even when React/UI cloning happens between them; both success orders will be tested.
2. A same-scope global refresh or attachment apply must invalidate both local owners at start, including a local response arriving before global success; callbacks remain zero for old responses.
3. Wrong echoed domain/key/target/startedAt and same-data-reference results must not bypass S acceptance or call the legacy bootstrap callback.
4. At 14,999 ms UI-only state changes cannot move the original 15,000 ms deadline; each domain can independently time out/retry while the other succeeds.
5. Source return, collection-only reads, disable/unmount and cancelled/accepted navigation must preserve existing inventory isolation and read-only source authority.

## Bounded execution after root approval

### Task 1: Pure session atomic package protocol

Files: assigned session source/test only.

- [ ] Add behavior tests for literal T/TP/TH complete packages, H→P and P→H acceptance, rejection of stale/wrong target, and all-data global replacement. Assert original object identity of unaffected slots plus visible labels; retain all 4 old tests.
- [ ] Run exact session test file and save real RED log before source implementation. Missing export/behavior is a valid first RED; no null stub is needed.
- [ ] Implement the exact additive types/helpers above; S performs all normalized target/key acceptance. No S changes.
- [ ] Run the session file to GREEN and retain the first RED evidence.

### Task 2: Actual hook ownership and lifecycle

Files: assigned host source/test only.

- [ ] Add actual renderHook deferred-loader tests for both cross-domain orders, same-domain replacement, global-start supersession, typed callbacks, all-data global bundle, collection/source preservation, seed-only ambient data and no partial-render tuples.
- [ ] Add failure/cancel/timeout/retry/UI-only-deadline, wrong token envelope, disable/unmount and guarded route-exit counterexamples. Preserve every existing host test/business assertion.
- [ ] Run exact new hook scenarios to real RED before adding hook product behavior; save raw log with command/exit/count.
- [ ] Implement optional configuration, domain methods, independent owner refs/timers, accepted-only callbacks and single-session publication. Keep existing catalog/source/collection/guard/pop logic; only add local-owner invalidation at their accepted boundaries.
- [ ] Run both assigned test files together, one worker, to GREEN. No full Workspace, browser, finance or performance suite.

### Task 3: Scoped verification and freeze

- [ ] Create evidence-local strict tsc config extending project config with `incremental:false`, exact four-file include (transitive imported dependencies remain checked), no emitted files; log its exact include, command and result.
- [ ] Run eslint only the four assigned source/test files with the existing repo config; do not change config or exempt diagnostics.
- [ ] Inspect the bounded diff, source/UI-only serialization and owned callback paths. Record unresolved existing failures and finite test scope.
- [ ] Freeze `IMPLEMENTATION-READY.md`, original/final SHA256, logs, exact test counts, limitations and acceptance checklist in this evidence directory. Do not commit or alter frozen leaves. Root independently accepts, at most three formal rounds.

Planned commands use the pinned native Node binary plus local `vitest.mjs run <session-test> <host-test> --maxWorkers=1`, `typescript/bin/tsc --project <evidence-local-config> --pretty false`, and `eslint/bin/eslint.js <exact-four-files>`. Actual argv, exit code and counts will be recorded at execution, not preclaimed here. No test, typecheck, lint, build, service, database or browser was run for this design proposal.
