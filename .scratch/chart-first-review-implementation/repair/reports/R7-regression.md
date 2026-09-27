# R7 workspace regression

Date: 2026-09-27

Scope: `app/components/trade-review-workspace.test.tsx` and `app/components/recall/recall-workspace.test.tsx` only. The interrupted R6 log remains unchanged; the R7 logs below are additive evidence.

## Verification command

The required run used one Vitest worker, disabled file parallelism, the verbose reporter, and the isolated repair database:

```sh
TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/f7a5/TradeReview/.scratch/chart-first-review-implementation/repair/r7-unit.sqlite \
PATH=/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
./node_modules/vitest/vitest.mjs run \
app/components/trade-review-workspace.test.tsx \
app/components/recall/recall-workspace.test.tsx \
--pool=threads --maxWorkers=1 --no-file-parallelism --reporter=verbose
```

## Findings and repairs

The first complete R7 run produced `14 failed | 114 passed (128)` across both files. Its failures fell into three causes:

1. Ten TradeReview tests queried `完整历史` or `保存并完成回合复盘` while the new `更多 / 记录` control was collapsed. The tests now open that real control before querying its actions.
2. The Recall conflict test queried `编辑决策 1快照` while the nested `全部记录与快照` disclosure was closed. It now opens both disclosures before querying the edit action.
3. Three Recall completion-cancellation cases queried the completion action while the More panel was collapsed. They now open the panel for the `complete` case.

After those interaction corrections, one TradeReview test still failed: `retains a Recall drawing draft per episode and gates completion until a snapshot exists`. The remaining assertion polled the repository with the default 1-second `waitFor` window, while Recall deliberately debounces autosave for 1 second. This was a boundary race, not a missing persisted drawing. The test now waits for the existing visible `自动保存将在 1 秒后执行` state and then `已保存` before checking the repository, matching the adjacent passing test and preserving the persistence assertion.

No production file, CSS, schema, projection, timeout configuration, or business database was changed for this regression repair.

## Results

The final required run completed successfully:

```text
Test Files  2 passed (2)
Tests       128 passed (128)
```

Focused reproduction and verification of the formerly flaky drawing test also passed (`1 passed | 75 skipped`) after the save-state assertion was corrected.

Preserved logs:

- `R7-workspace-regression.txt` — initial complete red run (`14 failed | 114 passed`).
- `R7-workspace-regression-green.txt` — interaction repairs before the autosave race repair (`1 failed | 127 passed`).
- `R7-drawing-red.txt` — isolated reproduction of the original drawing assertion.
- `R7-drawing-green.txt` — isolated verification after the save-state assertion repair.
- `R7-workspace-regression-final.txt` — final required green run (`128 passed`).

## Narrow plan-panel follow-up

The coordinator's post-panel-state run is preserved in `R7-coordinator-tests.txt` (`82 passed | 2 failed` across its three files). Both failures were test interaction assumptions under jsdom's zero-width narrow layout:

- `keeps a plan edit made during the final save dirty and saves it after the frozen formal candidate` opened More to start completion, then tried to edit a plan field while More had correctly yielded and closed the plan panel.
- `cancels complete when evaluation changes after the chart scene was frozen` had the same hidden plan-panel state; its evaluation radio was therefore not accessible.

The tests now reopen the visible `计划侧栏` control before editing. The final-save case opens More first, starts the completion capture, then opens the plan panel and edits while the frozen candidate is pending. The parameterized plan/evaluation branches use the same visible toggle; all original capture-freeze, dirty-state, and deferred-save assertions remain intact.

Verification:

```text
Test Files  1 passed (1)
Tests       52 passed (52)
```

The full verbose output is preserved in `R7-recall-workspace-final.txt`; the focused four-case confirmation is in `R7-plan-panel-targeted-green.txt`. Only `app/components/recall/recall-workspace.test.tsx` was changed for this follow-up; no product code or timeout was changed.
