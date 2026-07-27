# Rule-Based Pattern Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn closed, locally cached trade episodes and user-confirmed tags into deterministic tag suggestions and explainable pattern insights with evidence, counterexamples, exclusions, and exact episode drill-down.

**Architecture:** Pure domain modules generate versioned tag suggestions and insight candidates from `TradeLibraryEntry` values; they never read storage or call the network. IndexedDB schema version 3 persists suggestion decisions, while confirmed tags remain authoritative in `EpisodeReviewRecord`. The workspace hydrates local facts, derives insights in memory, renders a dedicated insights view, and routes evidence links into the existing two-level trade library.

**Tech Stack:** TypeScript, React 19, Decimal.js, IndexedDB, Vitest, Testing Library, fake-indexeddb.

## Global Constraints

- Phase 3B is deterministic and rule-based; it does not call AI or infer psychology from free text.
- Formal statistics use only closed episodes with complete local market data, the fields required by the selected metric, confirmed tags when the candidate depends on a tag, and compatible calculation versions.
- A suggestion never enters statistics until the user explicitly confirms or edits it.
- A rejected suggestion remains rejected for the same `ruleId + ruleVersion + episodeId`; a new rule version may suggest again.
- R is the comparison metric only when at least 80% of all eligible comparable episodes have a valid planned-risk R; otherwise use fee-after return percent and label the basis.
- Tag groups with 3–4 samples are early signals; 5–9 are usable; 10 or more are high confidence only when at least 3 baseline episodes exist.
- Every formal insight exposes the tagged group, baseline, sample range, basis, evidence, counterexamples, exclusions, tag/rule/calculation versions, and exact episode links.
- Viewing insights, switching insight categories, and drilling into cached episodes must not call `fetch`.
- All user executions, reviews, suggestion decisions, and derived insights stay in the current browser.

---

### Task 1: Versioned Suggestion Domain and Deterministic Rules

**Files:**
- Create: `app/lib/insights/types.ts`
- Create: `app/lib/insights/tag-suggestions.ts`
- Test: `app/lib/insights/tag-suggestions.test.ts`
- Modify: `app/lib/reviews/review-tags.ts`

**Interfaces:**
- Consumes: `TradeLibraryEntry[]`, daily candles keyed by instrument, prior `TagSuggestionRecord[]`, and an explicit generation timestamp.
- Produces: `TagSuggestionRecord`, `SuggestionEvidence`, `buildTagSuggestions(entries, candlesByInstrument, priorSuggestions, generatedAt)`.

- [ ] **Step 1: Write failing rule tests**

Create literal fixtures proving:

```ts
buildTagSuggestions(
  entries,
  candles,
  [],
  "2026-07-27T00:00:00.000Z",
).map(({ tagId }) => tagId)
```

returns `["breakout"]` when the first opening execution is above the prior 20 completed-session high, returns `["pullback"]` when a prior five-session breakout is followed by an entry within 3% of its breakout level, and returns `["scale-in"]` when an episode has at least two opening-side executions. Assert each record contains `ruleId`, `ruleVersion`, candle/execution evidence, and `status: "suggested"`.

Also prove an existing `rejected` record with the same episode/rule/version suppresses a repeat, an already confirmed tag is not suggested again, and no psychology tag is created from `review.psychology`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run app/lib/insights/tag-suggestions.test.ts
```

Expected: module resolution fails because the suggestion engine does not exist.

- [ ] **Step 3: Implement the minimal rule engine**

Define:

```ts
type TagSuggestionStatus = "suggested" | "confirmed" | "rejected" | "edited";

type TagSuggestionRecord = {
  version: 1;
  id: string;
  episodeId: string;
  instrumentId: string;
  tagId: string;
  finalTagId: string | null;
  ruleId: "entry-20d-breakout" | "first-pullback-after-breakout" | "scale-in";
  ruleVersion: 1;
  status: TagSuggestionStatus;
  suggestedAt: string;
  decidedAt: string | null;
  evidence: SuggestionEvidence[];
};
```

Use market-local trading dates and Decimal.js comparisons. Read only candles before the opening execution when evaluating breakout/pullback rules. Generate stable IDs from episode, rule, and version. Use the caller-supplied timestamp for new suggestions, preserve prior decisions, and never inspect free-text fields.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 command and expect all suggestion tests to pass.

### Task 2: IndexedDB Suggestion Decision Repository

**Files:**
- Modify: `app/lib/storage/indexeddb-schema.ts`
- Create: `app/lib/storage/tag-suggestion-repository.ts`
- Create: `app/lib/storage/indexeddb-tag-suggestion-repository.ts`
- Test: `app/lib/storage/indexeddb-tag-suggestion-repository.test.ts`

**Interfaces:**
- Consumes: normalized `TagSuggestionRecord`.
- Produces: `getAll()`, `put(record)`, and version-3 schema migration preserving candles and reviews.

- [ ] **Step 1: Write failing migration and round-trip tests**

Using fake-indexeddb, open a handcrafted version-2 database containing one candle and one review, then open the suggestion repository. Assert both old records remain, the `tagSuggestions` store exists, `put/getAll` round-trip a rejected decision, and a later `put` overwrites the same stable suggestion ID.

- [ ] **Step 2: Run repository tests and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run app/lib/storage/indexeddb-tag-suggestion-repository.test.ts
```

Expected: missing repository modules.

- [ ] **Step 3: Implement schema version 3 and repository**

Add `TAG_SUGGESTIONS_STORE = "tagSuggestions"` with `id` key path to the shared upgrade callback. Normalize IDs, tag IDs, timestamps, status, and evidence before writes. Do not delete or rewrite version-2 stores.

- [ ] **Step 4: Run storage regression tests**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  app/lib/storage/indexeddb-tag-suggestion-repository.test.ts \
  app/lib/storage/indexeddb-episode-review-repository.test.ts \
  app/lib/storage/indexeddb-market-data-repository.test.ts
```

Expected: all tests pass and existing schema migrations remain intact.

### Task 3: Insight Episode Facts and Excursion Metrics

**Files:**
- Create: `app/lib/insights/episode-facts.ts`
- Test: `app/lib/insights/episode-facts.test.ts`

**Interfaces:**
- Consumes: `TradeLibraryEntry[]`, local daily candles, and market-data statuses.
- Produces: `InsightEpisodeFact[]` plus excluded episode records.

- [ ] **Step 1: Write failing eligibility and metric tests**

Use literal episodes and candles to prove the projection excludes open episodes as `open-episode`, incomplete market data as `incomplete-market-data`, and closed episodes whose candle window does not cover both opening and closing dates as `missing-episode-candles`.

For eligible long and short episodes, assert hand-calculated:

- fee-after net PnL and return percent;
- R when planned risk is present;
- holding milliseconds and calendar days;
- opening-side execution count and add-on count;
- direction-aware MFE percent, MAE percent, and profit-giveback percent from the cached candle path.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run app/lib/insights/episode-facts.test.ts
```

Expected: module resolution fails because the fact projection does not exist.

- [ ] **Step 3: Implement the pure fact projection**

Define `InsightEpisodeFact` with instrument/episode identity, market, direction, dates, confirmed tags, metric strings, and calculation version `1`. Derive an average entry basis from opening-side execution value divided by opening-side quantity. Slice candles using market-local dates, calculate long/short excursions with Decimal.js, and return explicit exclusions rather than partial facts.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 3 command and expect all fact and exclusion tests to pass.

### Task 4: Insight Eligibility, Comparison, Confidence, and Ranking

**Files:**
- Create: `app/lib/insights/insight-engine.ts`
- Test: `app/lib/insights/insight-engine.test.ts`

**Interfaces:**
- Consumes: `InsightEpisodeFact[]` and projection exclusions.
- Produces: `PatternInsightReport` with ranked formal insights, early signals, excluded episodes, and calculation version.

- [ ] **Step 1: Write failing eligibility tests**

Use literal facts to prove tag candidates exclude episodes without that confirmed tag from the tagged group without marking them globally invalid, while records missing the selected metric are listed as `missing-comparison-metric`. Assert upstream exclusions retain instrument/episode IDs and a Chinese reason label for UI display.

- [ ] **Step 2: Write failing metric-basis and confidence tests**

Prove:

- 8 of 10 comparable episodes with R select `r-multiple`;
- 7 of 10 select `return-percent`;
- 3–4 tagged samples create `early-signal`;
- 5–9 tagged samples plus at least 3 baselines create `usable`;
- 10 tagged samples plus at least 3 baselines create `high-confidence`;
- fewer than 3 baselines produce descriptive statistics but no baseline-difference claim.

Use hand-calculated literal medians, win rates, net PnL, sample counts, and date ranges.

- [ ] **Step 3: Write failing evidence and stable-ranking tests**

Assert each candidate includes sample IDs, baseline IDs, winning evidence IDs, losing/underperforming counterexample IDs, metric basis, tag dictionary version when applicable, calculation version, and a neutral Chinese conclusion. Cover all three categories:

- `condition`: market, direction, and holding-period buckets derived from facts;
- `pattern`: confirmed breakout, pullback, Bull Flag, and Trading Range tags;
- `execution-psychology`: confirmed planned, scale-in, FOMO, and fear tags.

Create tied candidates and assert ranking by confidence, absolute median difference, smaller-group sample count, latest sample date, then stable candidate ID.

- [ ] **Step 4: Run insight tests and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run app/lib/insights/insight-engine.test.ts
```

Expected: missing engine module.

- [ ] **Step 5: Implement the pure insight engine**

Define:

```ts
type InsightMetricBasis = "r-multiple" | "return-percent";
type InsightConfidence = "early-signal" | "usable" | "high-confidence";

type PatternInsight = {
  id: string;
  category: "condition" | "pattern" | "execution-psychology";
  dimension: {
    kind: "market" | "direction" | "holding-period" | "confirmed-tag";
    id: string;
    value: string;
    label: string;
  };
  confidence: InsightConfidence;
  metricBasis: InsightMetricBasis;
  sampleCount: number;
  baselineCount: number;
  timeRange: { start: string; end: string };
  medianTagged: string;
  medianBaseline: string | null;
  medianDifference: string | null;
  winRate: string;
  netPnl: string;
  medianMfePercent: string;
  medianMaePercent: string;
  medianGivebackPercent: string;
  planAdherenceRate: string | null;
  evidenceEpisodeIds: string[];
  counterexampleEpisodeIds: string[];
  baselineEpisodeIds: string[];
  conclusion: string;
  tagDictionaryVersion: 1 | null;
  ruleVersions: Array<{ ruleId: string; ruleVersion: number }>;
  calculationVersion: 1;
};
```

Use Decimal.js for sums, comparisons, win rate, medians, MFE, MAE, giveback, and plan-adherence rates. Generate factual condition candidates and map tags to pattern or execution/psychology categories with explicit tables. Keep all output deterministic and do not persist derived reports.

- [ ] **Step 6: Run insight tests and verify GREEN**

Run the Task 4 test command and expect all tests to pass.

### Task 5: Suggestion Confirmation Workflow

**Files:**
- Create: `app/components/insights/tag-suggestion-panel.tsx`
- Test: `app/components/insights/tag-suggestion-panel.test.tsx`
- Create: `app/lib/storage/indexeddb-suggestion-decision.ts`
- Test: `app/lib/storage/indexeddb-suggestion-decision.test.ts`
- Modify: `app/lib/reviews/review-metrics.ts`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`

**Interfaces:**
- Consumes: pending `TagSuggestionRecord[]`, episode labels, `onConfirm`, `onReject`, and `onOpenEpisode`.
- Produces: atomically persisted suggestion decisions and authoritative `EpisodeReviewRecord.confirmedTagIds`.

- [ ] **Step 1: Write failing component behavior tests**

Render a real panel with breakout and scale-in suggestions. Confirm one, reject one, and assert:

- the confirmed tag disappears from pending suggestions and appears in the episode’s confirmed tags;
- the rejected rule disappears but does not enter confirmed tags;
- evidence text identifies the stock and transaction episode;
- “查看回合” calls the exact instrument/episode route;
- none of these actions call `fetch`.

In the transaction test, inject a request failure after the first store write and assert the transaction aborts: neither the suggestion decision nor the review update is observable after reopening the database.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  app/components/insights/tag-suggestion-panel.test.tsx \
  app/components/trade-review-workspace.test.tsx
```

Expected: panel module and workspace handlers are missing.

- [ ] **Step 3: Implement authoritative confirmation**

Export `createEmptyEpisodeReviewRecord(episodeId, instrumentId)` from the review domain. Hydrate suggestion decisions after IndexedDB initialization. Derive current suggestions from library entries, candles, and persisted decisions. Add one shared IndexedDB transaction that writes the suggestion and review stores together: confirmation writes `status: "confirmed"` and merges `finalTagId` into the episode review; rejection writes only `status: "rejected"`. Abort the transaction on any write failure. Show an accessible error and leave the pending item visible when the transaction rejects.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 5 command and expect all tests to pass.

### Task 6: Insights Page and Exact Episode Drill-Down

**Files:**
- Create: `app/components/insights/pattern-insights.tsx`
- Test: `app/components/insights/pattern-insights.test.tsx`
- Modify: `app/components/library/trade-library.tsx`
- Modify: `app/components/library/trade-library.test.tsx`
- Modify: `app/components/trade-review-workspace.tsx`
- Modify: `app/components/trade-review-workspace.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `PatternInsightReport`, library entries, suggestions, and exact episode routing callback.
- Produces: enabled “模式洞察” navigation, category filters, 3–5 ranked formal insight cards, early-signal section, exclusions, evidence/counterexample lists, and trade-library drill-down.

- [ ] **Step 1: Write failing page tests**

Render a literal report and assert:

- formal cards display neutral conclusion, confidence, sample/baseline sizes, time range, basis, median comparison, win rate, net PnL, and versions;
- category selection filters cards without recomputation or network access;
- evidence and counterexample sections display stock name and episode dates;
- exclusions display the exact reason;
- empty and early-only datasets use honest copy and do not manufacture a formal conclusion.

- [ ] **Step 2: Write failing navigation integration tests**

From the workspace, click “模式洞察”, open an evidence item, and assert the app switches to “交易库”, opens the right stock, and selects the exact episode. Repeat for a counterexample. Assert `fetch` is unchanged after the initial test setup.

- [ ] **Step 3: Run UI tests and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run \
  app/components/insights/pattern-insights.test.tsx \
  app/components/library/trade-library.test.tsx \
  app/components/trade-review-workspace.test.tsx
```

Expected: insights page and deep-link props are missing.

- [ ] **Step 4: Implement the insights page**

Enable the navigation and add `activeView: "review" | "library" | "insights"`. Render no more than five ranked formal cards on the overview. Use expandable evidence, counterexample, and exclusion sections with explicit Chinese copy. Render early signals separately and label them “样本不足，仅供观察”.

- [ ] **Step 5: Implement exact library targeting**

Add:

```ts
type TradeLibraryTarget = {
  requestId: number;
  instrumentId: string;
  episodeId: string;
};
```

to `TradeLibrary` props. When `requestId` changes, select the exact stock and episode. Insight links set a new target and switch views. Do not fetch or mutate market data during routing.

- [ ] **Step 6: Style and run UI tests**

Add responsive dark-theme insight cards, metric grids, evidence rows, reason chips, and honest empty states. Run the Task 6 command and expect all tests to pass.

### Task 7: Verification, Review, Browser Acceptance, and Public Release

**Files:**
- Modify only files required by verified defects.

**Interfaces:**
- Consumes: completed Tasks 1–6.
- Produces: reviewed, committed, pushed, and publicly deployed Phase 3B.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next
git diff --check
pnpm run build
node --test tests/rendered-html.test.mjs
```

- [ ] **Step 2: Independently review standards and spec**

Reject any Critical or Important finding involving suggestion leakage into formal tags, psychology inference, sample thresholds, baseline size, 80% R selection, unstable ranking, missing evidence/exclusions, IndexedDB migration, exact episode routing, or network access.

- [ ] **Step 3: Perform browser acceptance**

Import a fixture with at least ten closed episodes across tagged and untagged groups, complete local candles, confirm/reject suggestions, and verify:

- rejected suggestions stay out of confirmed tags and insights;
- 3–4 samples show only an early signal;
- 5 or more tagged samples with 3 baselines create a formal insight;
- evidence and counterexample links open the exact trade episode;
- reload preserves decisions and reconstructs the same insight;
- viewing and drilling down issue no market-data requests when cache is complete.

- [ ] **Step 4: Commit, push, and deploy the exact source**

Commit as `feat: add rule-based pattern insights`, push `feature/trade-reviewer-mvp`, package the exact committed build, save a new Sites version, deploy it publicly, and poll the deployment to success.
