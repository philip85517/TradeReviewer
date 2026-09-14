# Simulated import reconciliation implementation plan

**Goal:** Complete Issue #17: four CSVs imported through the browser and independently reconciled after reload.
**Architecture:** Extend the existing market context and reuse import/storage paths. Keep independent reference parsing and reports local.
**Tech Stack:** TypeScript, React, Vitest, SQLite, browser UI, Python decimal/csv for independent audit.
**Spec:** docs/specs/2026-09-13-simulated-replay-import-reconciliation.md

- [x] Task 1: Add failing dispatcher and dialog tests for Shenzhen, extend market context through parser and confirmation, verify Shanghai compatibility and four opt-in samples. Owned by shenzhen agent; production changes restricted to necessary import seams.
- [x] Task 2: Independently read all CSV fields, compute source totals and episodes without production helpers, preserve local baseline and environment identity. Root owns local reports; no raw CSV committed.
- [x] Task 3: Review Task 1 changes, run relevant regression/typecheck/lint/build. Use isolated test storage for startup validation; actual destination must be identified before real import.
- [x] Task 4: Through browser select each file, confirm and save, reload, verify matching persisted executions and source report data, repeat import to verify deduplication. Never substitute a POST or direct database write for browser import.
- [x] Task 5: Produce local row/field reconciliation report, preserve known source internal differences, verify baseline unrelated records unchanged and record unresolved limits. Final evidence must distinguish automated tests from actual UI import.

## Execution evidence

- Task 1 review: no actionable findings (independent review_import agent). Parser/dialog/sample suite 14 passed; dispatcher/workspace import 25 passed; SQLite/API + parser/dialog suite 50 passed. Typecheck passed. Lint passed with 3 pre-existing warnings; build passed with dependency/chunk warnings.
- Independent reference: 82 rows, 41 pairs, 32 closed episodes; per-file episodes 12/6/10/4.
- Browser acceptance currently uses isolated SQLite on 127.0.0.1:3017; production DB destination remains unconfirmed. Original deployed database was read-only backed up; not mutated.

- Final: user selected existing formal SQLite. Four CSVs imported via browser at 4317; original 35 + new 82 =117, 17 instruments, 6 batches. Formal reconciliation 2341/2341 passes, original executions/history/reviews preserved, integrity and FK checks pass. Real/simulated filtering and restart/reimport verified. Stable native production runtime under deployment directory; Docker unavailable, no auto-start configured.
