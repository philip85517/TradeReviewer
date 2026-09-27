# R5 read-only data audit: fresh replay 999996

Audit target: `acceptance.sqlite`, episode `episode:%5B%22SYNTHETIC-REPAIR-fresh-replay%3ACN%3A999996%3Alive%22%2C%222026-08-10T02%3A00%3A00.000Z%22%2C%22buy%22%2C%221000%22%2C%2256%22%5D:1`.

The audit used the bundled Python runtime and SQLite URI `mode=ro`; no database write was performed. The latest read saw `recall_documents.revision=19`, `updated_at=2026-09-26T12:39:44.358Z`, `status=completed`, and a non-null finalized document. The first read at revision 16 was before the later post-review and completion captures; the findings below include both the earlier retained bundles and the current final revision.

## Integrity and raw fills

- `PRAGMA quick_check` returned `ok`.
- The database has 21 execution rows. Hashing all rows with the same sorted JSON procedure as the repair fixture produced `24a9793c206dbea76d03211a18d387ea89f6acfc999b5845857f9abdae64384d`, matching the required baseline.
- The three 999996 fills are unchanged and carry the same synthetic source fingerprint. The source has no `positionEffect` on any fill:

| execution | side | time | quantity | price | fee | source `positionEffect` |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `synthetic-repair-fresh-replay-entry` | buy | 2026-08-10T02:00:00.000Z | 1000 | 56 | 20 | missing |
| `synthetic-repair-fresh-replay-partial` | sell | 2026-08-14T02:00:00.000Z | 600 | 64 | 12 | missing |
| `synthetic-repair-fresh-replay-close` | sell | 2026-08-20T02:00:00.000Z | 400 | 61 | 8 | missing |

The episode builder still infers `direction=long`, opening quantity 1000, and closed status from signed side/quantity. The chart marker path deliberately keeps source-level direction uncertain when `positionEffect` is absent: `markerDelta` applies buy/sell quantity but sets `directionKnown=false`, the state is then marked `directionUnknown`, and the generic sell branch returns `卖出` until an explicit effect or a known direction is available (`app/components/chart/replay-chart.tsx:393-421, 647-661`). The 999997 contrast fixture has `open-long`, `close-long`, `close-long` and therefore can show `减仓`/`清仓`. The 999996 `卖出` labels are a conservative fallback for this source data, not a position ledger wiring error; changing them would be a product behavior change outside this audit.

## Retained snapshots and evidence

All exported captures are PNGs at 2560×1440 and were opened with `view_image`. The files are in this report directory:

| capture | snapshot phase | cursor / execution cursor | retained bundle | image |
| --- | --- | --- | --- | --- |
| pre | `pre-entry` | `2026-08-10T01:59:59.999Z` / `__recall_before_first_execution__` | `bundle-b82ac763-5190-48f7-ada4-4bd1c2377882` | [R5-stored-999996-pre.png](R5-stored-999996-pre.png) |
| entry | `holding` | `2026-08-10T16:00:00.000Z` / `synthetic-repair-fresh-replay-entry` | `bundle-091276e9-d9b3-41b7-92d4-e2602f1e27c8` | [R5-stored-999996-entry.png](R5-stored-999996-entry.png) |
| partial | `holding` | `2026-08-14T16:00:00.000Z` / `synthetic-repair-fresh-replay-partial` | `bundle-aa704b2c-c412-4595-95b9-3ff0afe20738` | [R5-stored-999996-partial.png](R5-stored-999996-partial.png) |
| close | `holding` | `2026-08-20T16:00:00.000Z` / `synthetic-repair-fresh-replay-close` | `bundle-84ac0074-72da-4dbe-9d98-ee9547b778a4` | [R5-stored-999996-close.png](R5-stored-999996-close.png) |
| post | `post-review` | `2026-09-24T16:00:00.000Z` / `synthetic-repair-fresh-replay-close` | `bundle-9d44182b-8166-4cce-b88b-b0061f4c9892` | [R5-stored-999996-post.png](R5-stored-999996-post.png) |
| global | `null` | `2026-08-10T01:59:59.999Z` / `__recall_before_first_execution__` | `bundle-224ad642-e723-43df-9995-6c6bf08713fb` | [R5-stored-999996-global.png](R5-stored-999996-global.png) |

The original pre-entry drawing remains stable across the first four captures: `drawing-1790425345593-uvz6e`, `textRevision=1`, owner `synthetic-repair-fresh-replay-entry`, anchor time `2026-07-20T00:00:00.000Z`, price `53.82`, canvas position `(0.16033755274261605, 0.26662465229485394)`, width 300, font 14, with the four original text lines. The partial and later captures also retain `drawing-1790426055724-hn3sy`, `textRevision=1`, owner `synthetic-repair-fresh-replay-partial`, anchor `2026-07-30T00:00:00.000Z` / `57.71`, width 280, font 14, containing “减仓600后仍持有400” and the review note. The post capture adds `drawing-1790426380329-3t0cx`, `textRevision=1`, owner `synthetic-repair-fresh-replay-close`, with “理性复盘 A：净收益6760，实际1.69R” and its decision note; its capture boundary is complete history as expected.

## Plans, risk, and metrics

The pre-entry retained initial plan is long, raw CNY, entry 56, initial stop 52, target 68, quantity 1000, with capital 200000 CNY as of 2026-08-07 and quantity step 1/floor/rounding delta 0. The holding adjustment preserves the same entry and quantity, changes stop to 54 and target to 72, and records the reason “上升结构继续成立，将保护位提高到54，目标修订为72；不更改初始风险基准。” The initial risk baseline remains frozen at 4000 CNY, `planned-price-risk`, `risk-v1`, with no correcting baseline. Plan and baseline references are present on each retained bundle through the close/post captures.

The actual metrics projection is consistent through the decision and post bundles:

| bundle state | remaining | weighted exit | realized gross / net | unrealized gross | fees | episode net / R |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| pre-entry | null (`pre-entry`) | null | null / null | null | null | null / null |
| after entry | 1000 | null (`no-exits`) | 0 / 0 | -370 | 20 | null (`episode-open`) / null |
| after partial 600 | 400 | 64 | 4800 / 4776 | 2400 | 32 | null (`episode-open`) / null |
| closed / post-review | 0 | 62.8 | 6800 / 6760 | 0 | 40 | 6760 / 1.69 |

The final target realization is `0.5633333333333333333333333333333333333333` (56.3%). Exit allocation rows preserve 600 at 64 and 400 at 61, with entry fee allocation 12 and 8, and net exit PnL 4776 and 1984. Unknown values remain null with reasons rather than being coerced to zero.

## Post evaluation retention

The correct post-review bundle (`bundle-9d44182b-8166-4cce-b88b-b0061f4c9892`) retains both exit evaluation revisions and the episode manual evaluation revision. Its source is `actual-v1`, capture revision 19, and its metrics are the closed values above. The post evaluation data is retained in both draft and formal projections; the document remains available for the final read-only audit.

The current global completion bundle (`bundle-224ad642-e723-43df-9995-6c6bf08713fb`) is materially wrong for a global+post summary. It has `capture_phase=null`, the pre-entry cursor and no revealed execution cursor, even though `capture_has_seen_future=1`. Its image is the pre-entry chart without execution markers. Its actual metrics are all null with reason `no-visible-executions`. It carries the two exit evaluation revision links copied from the post bundle but has `manualEvaluationRevisionIds=[]`; the correct post bundle remains intact and was not overwritten.

This mismatch is reproducible from the current owner path. During completion, `recall-workspace.tsx:2271-2305` first captures the selected decision context and then swaps to `globalWorkingContextRef`; `:2341-2345` uses that global graph's replay for the final capture, and `:2379` clears the snapshot phase when completion came from a decision. `retained-bundles.ts:18-21, 128-133` freezes the snapshot context verbatim, while `metric-retention.ts:30-40` computes metrics from that phase/cursor/execution cursor. A global snapshot with the pre-entry cursor consequently produces `no-visible-executions` despite the document being finalized and `hasSeenFuture=true`.

There is no reliable real UI sequence that produces a correct global+post capture with the current context owner: selecting 全局总结 while in post-review first persists the post decision context and moves the phase to holding (`recall-workspace.tsx:1506-1510`), and re-entering 事后复盘 restores that saved decision context (`:1633-1655`), which is why the UI returns to decision 3. The shortest valid acceptance path after the owner fix is to stay in 事后复盘, let completion build the global snapshot from the active full-history replay, and verify the new global bundle has `capture_phase=post-review` (or an equivalent explicit full-history context), execution cursor `synthetic-repair-fresh-replay-close`, retained manual evaluation IDs, and the closed metrics. No direct state injection was used here.

## Commands and limits

Read-only commands used:

```sh
/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3  # SQLite URI mode=ro queries, hash, PNG export
```

No tests, browser actions, product edits, or database writes were performed for this audit. The global capture defect is reported for the Recall workspace owner to fix; the pre/holding/partial/close/post evidence and PNGs remain available for comparison. The global completion happened after the earlier revision-16 audit, so its revision-19 findings are explicitly separated above.
