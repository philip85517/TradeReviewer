# Task 1 journey state evidence

Test: `app/components/recall/recall-workspace.test.tsx` — `keeps S0 cutoffs, an anchored Text stage, and the early cursor after save and reopen`

| Checkpoint | Observable state |
| --- | --- |
| S0 initial | `data-revealed-candles=""`; no execution cursor attribute |
| After one bar | `data-revealed-candles="2025-01-02T10:00:00.000Z"` |
| After one decision | execution cursor `fill-2` |
| Text commit | `text-1`, anchor `2025-01-02T10:00:00.000Z @ 10`, stage `during-replay` |
| Early return | active saved context cursor `2025-01-02T10:15:00.000Z`, execution cursor `fill-1` |
| Reopen | same market cursor, execution cursor, and visible `text-1` |

The test uses the explicit isolated path `TRADEREVIEW_DB_PATH=.scratch/review-visual-baseline-plan-20261011/evidence/task-1-journey.sqlite` and an in-memory repository harness, so no shared business database is written.
