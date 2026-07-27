# Episode Reviews and Confirmed Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user persist a structured plan, post-trade review, and explicitly confirmed tags for each imported position episode, then show its review status, confirmed tags, and R result throughout the two-level trade library.

**Architecture:** Add a versioned episode-review domain record and a focused IndexedDB repository beside the market-data repository. The workspace hydrates review records once and passes immutable review maps into the replay and library components; pure projection functions calculate review status and R without reading storage. A dedicated episode-review editor owns validation and explicit tag confirmation, and never infers psychology from free text.

**Tech Stack:** TypeScript, React 19, Decimal.js, IndexedDB, Vitest, Testing Library, fake-indexeddb.

## Global Constraints

- Records are keyed by stable derived `episode.id`; imported executions remain immutable.
- All user review data remains in the current browser and no save action calls `fetch`.
- Decimal facts are persisted as decimal strings and calculated with Decimal.js.
- R is `netPnl / plannedRiskAmount` only when a positive user-entered plan risk exists; it is never inferred from future prices.
- Only tags explicitly selected by the user are persisted as confirmed tags.
- Psychology tags are never inferred from free text.
- Phase 3A does not generate aggregate pattern insights; it produces the stable facts Phase 3B will consume.

---

### Task 1: Versioned Episode Review Domain

**Files:**
- Create: `app/lib/reviews/types.ts`
- Create: `app/lib/reviews/review-metrics.ts`
- Test: `app/lib/reviews/review-metrics.test.ts`

**Interfaces:**
- Consumes: `TradeEpisodeMetrics` and user form fields.
- Produces: `EpisodeReviewRecord`, `EpisodeReviewDraft`, `episodeReviewStatus(record?)`, and `calculateRMultiple(metrics, plannedRiskAmount)`.

- [ ] **Step 1: Write failing domain tests**

Test that an absent/draft record is `pending`, a completed post-review record is `completed`, positive planned risk returns an exact Decimal R string, and empty/zero/negative risk returns `null`.

- [ ] **Step 2: Run the tests and verify RED**

Run `pnpm exec vitest run app/lib/reviews/review-metrics.test.ts`. Expect module resolution to fail because the domain does not exist.

- [ ] **Step 3: Implement the minimal domain**

Define:

```ts
type EpisodeReviewRecord = {
  version: 1;
  episodeId: string;
  instrumentId: string;
  updatedAt: string;
  plan: {
    thesis: string;
    expectedPath: string;
    invalidationCondition: string;
    targetRange: string;
    plannedRiskAmount: string;
    confidence: 1 | 2 | 3 | 4 | 5 | null;
  };
  review: {
    decisionQuality: 1 | 2 | 3 | 4 | 5 | null;
    executionQuality: 1 | 2 | 3 | 4 | 5 | null;
    riskManagement: string;
    psychology: string;
    reusableRule: string;
    completed: boolean;
  };
  confirmedTagIds: string[];
};
```

Normalize whitespace, deduplicate tags, and use Decimal.js for R.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Task 1 test command and expect all tests to pass.

### Task 2: IndexedDB Episode Review Repository

**Files:**
- Create: `app/lib/storage/episode-review-repository.ts`
- Create: `app/lib/storage/indexeddb-episode-review-repository.ts`
- Test: `app/lib/storage/indexeddb-episode-review-repository.test.ts`
- Modify: `app/lib/storage/indexeddb-market-data-repository.ts`

**Interfaces:**
- Consumes: validated `EpisodeReviewRecord`.
- Produces: `getAll(): Promise<EpisodeReviewRecord[]>`, `get(episodeId)`, and `put(record)` through `EpisodeReviewRepository`.

- [ ] **Step 1: Write failing repository tests**

Using a unique fake-indexeddb database, prove an upgrade from the existing version-1 market database preserves candles, creates `reviews`, round-trips a record, and overwrites the same episode atomically.

- [ ] **Step 2: Run repository tests and verify RED**

Run `pnpm exec vitest run app/lib/storage/indexeddb-episode-review-repository.test.ts`. Expect missing repository modules.

- [ ] **Step 3: Implement schema version 2 and repository**

Create the `reviews` object store with `episodeId` keyPath. Share the database version constant and upgrade callback so opening either repository creates all version-2 stores without deleting version-1 data.

- [ ] **Step 4: Run storage and market repository tests**

Run the new test plus `app/lib/storage/indexeddb-market-data-repository.test.ts`; expect both to pass.

### Task 3: Structured Episode Review Editor

**Files:**
- Create: `app/components/review/episode-review-editor.tsx`
- Test: `app/components/review/episode-review-editor.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: one episode, its metrics, an optional saved record, and `onSave(record)`.
- Produces: an accessible plan/review form with explicit tags and save feedback.

- [ ] **Step 1: Write failing component tests**

Prove the editor loads an existing record; blocks a negative planned risk; saves trimmed structured fields; toggles only explicit tags (`breakout`, `pullback`, `bull-flag`, `trading-range`, `planned`, `fomo`, `fear`); and calls no network APIs.

- [ ] **Step 2: Run component tests and verify RED**

Run `pnpm exec vitest run app/components/review/episode-review-editor.test.tsx`. Expect the component module to be missing.

- [ ] **Step 3: Implement the editor**

Render separate “事前计划” and “事后复盘” sections, numeric/select validation, explicit tag checkboxes, calculated R preview, and a single “保存当前回合复盘” action. Do not auto-select tags from any text field.

- [ ] **Step 4: Run component tests and verify GREEN**

Run the Task 3 test command and expect all tests to pass.

### Task 4: Workspace and Library Integration

**Files:**
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`
- Modify: `app/components/library/trade-library.tsx`
- Modify: `app/components/library/trade-library.test.tsx`
- Modify: `app/lib/trades/library.ts`
- Modify: `app/lib/trades/library.test.ts`

**Interfaces:**
- Consumes: `Record<episodeId, EpisodeReviewRecord>`.
- Produces: hydrated review data, episode editor routing, saved review status/tags/R in library projections, and zero-network library navigation.

- [ ] **Step 1: Write failing integration tests**

Persist records for two episodes, reload the workspace, open the relevant stock/episode, and assert the correct record appears. Save a review and assert the selected episode changes from `待复盘` to `已复盘`, displays confirmed tags and R, survives rerender, and never calls `fetch`.

- [ ] **Step 2: Run integration tests and verify RED**

Run the workspace, library, and library projection tests. Expect missing review inputs and status output.

- [ ] **Step 3: Integrate hydration and projection**

Hydrate all records after browser storage initialization, update the map after repository writes, pass review records into `buildTradeLibraryEntries`, and add nullable `reviewStatus`, `confirmedTagIds`, and `rMultiple` fields to each episode and stock rollup.

- [ ] **Step 4: Replace Phase 2 placeholders**

Show confirmed tags and cumulative R only when they exist; keep `标签待确认` and `R —` otherwise. Open the editor for the currently selected imported episode and preserve the existing future-information guard.

- [ ] **Step 5: Run integration tests and verify GREEN**

Run all Task 4 focused tests and expect them to pass without network calls.

### Task 5: Verification and Public Release

**Files:**
- Modify only files required by verified defects.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: reviewed, committed, pushed, and publicly deployed Phase 3A.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
pnpm run test:unit
pnpm run typecheck
pnpm run lint
git diff --check
pnpm run build
node --test tests/rendered-html.test.mjs
```

- [ ] **Step 2: Independently review standards and spec**

Reject any Critical or Important finding involving record isolation, schema migration, decimal R, implicit tag inference, future-data leakage, or network access.

- [ ] **Step 3: Perform browser acceptance**

Import a stock, open a concrete episode, save its plan/review/tags, reload, and verify the same episode displays the saved record, status, tags, and R. Confirm zero browser errors and no review-data request leaves the browser.

- [ ] **Step 4: Commit, push, and deploy the exact source**

Commit as `feat: add structured episode reviews`, push the current feature branch, save the exact Sites commit as a new version, deploy publicly, and poll to success.
