# Task 1 report — minimal real review replay journey

## Scope

Added one behavior-first journey test to `app/components/recall/recall-workspace.test.tsx`. It mounts the real `RecallWorkspace` fixture, starts from S0, advances the replay bar and decision, adds an anchored Text drawing, rewinds to the early cursor, saves through the workspace leave guard, unmounts, and reopens from the persisted document.

The test sets `TRADEREVIEW_DB_PATH` to `.scratch/review-visual-baseline-plan-20261011/evidence/task-1-journey.sqlite` while running. The injected repository is an isolated persistence harness owned by the test; no shared business database is touched.

## Red → green evidence

- Red command: `npx vitest run app/components/recall/recall-workspace.test.tsx -t 'keeps S0 cutoffs' --reporter=verbose`
- Red result: failed after the journey because the initial persistence assertion looked only at top-level `working.drawings`; the real decision-owned Text was persisted in `working.editingContext` / phase context. The first run also exposed a test assertion mistake for the intentionally omitted S0 execution attribute, which was corrected before accepting the behavioral red result.
- Green command: `npx vitest run app/components/recall/recall-workspace.test.tsx -t 'keeps S0 cutoffs' --reporter=dot`
- Green result: `1 passed, 73 skipped`.
- Scoped regression command: `npx vitest run app/components/recall/recall-workspace.test.tsx --reporter=dot`
- Scoped regression result: `74 passed`.

## Acceptance evidence

- S0: no revealed candle and no execution attribute are rendered.
- Replay: one bar reveals the first candle; one decision advances the execution cursor to `fill-2`.
- Text: saved drawing keeps tool `text`, anchor `{time: 2025-01-02T10:00:00.000Z, price: 10}`, and stage `during-replay`.
- Return: the early cursor is saved from the active decision context.
- Reopen: repository load is called again; the chart restores the saved market cursor, execution cursor, and `text-1` drawing.

No production component change was required. Visual/browser acceptance and final integration remain coordinator-owned.
