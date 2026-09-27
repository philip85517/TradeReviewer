# R7 isolated UI fixtures

Created by [prepare-fault-fixtures.py](./prepare-fault-fixtures.py) on 2026-09-27. The script opened the source database read-only and used Python `sqlite3.Connection.backup()` to create both files. It did not modify `.scratch/chart-first-review-implementation/repair/acceptance.sqlite`, product code, or tests.

The source execution table contained 25 rows before and after fixture creation. Its canonical execution-table SHA-256 was unchanged:

```text
1fe6b60a3a2a878858172cf48fbf7cb01cbe6659ec7db6bc59471fb8724f94e2
```

Both fixture files retain 25 executions with the same SHA-256, `PRAGMA integrity_check` returns `ok`, and `PRAGMA foreign_key_check` returns no rows. The machine-readable details are in [fixtures-report.json](./fixtures-report.json).

## Missing Text revision fixture

`legacy-fixture.sqlite` preserves the 999996 document at revision 33 and the formal revision 24. The manual evidence pointer keeps the original `drawingId` and owner:

```text
drawingId = drawing-1790426055724-hn3sy
ownerId   = synthetic-repair-fresh-replay-partial
```

The fixture changes only the pointer's `textRevision` from 1 to 2 in draft/formal JSON and the corresponding six rows in `recall_manual_evaluation_evidence`. The current drawing remains revision 1, so `getRecallManualEvaluationEvidenceStatus` must return `text-revision-or-owner-missing` and the UI can show the original pointer. Snapshot contents and retained bundle digests remain unchanged.

Start this fixture on port 3052:

```sh
cd /Users/zhoulin/.codex/worktrees/f7a5/TradeReview
TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/f7a5/TradeReview/.scratch/chart-first-review-implementation/repair/fault-acceptance/legacy-fixture.sqlite npm run dev -- --hostname 127.0.0.1 --port 3052
```

Open `http://127.0.0.1:3052`, enter 999996's post-review plan/More panel, and expand `关联图上证据`. The expected message contains `关联证据已缺失或修订变化，原引用保留：Text drawing-1790426055724-hn3sy · 修订 2 · 归属 synthetic-repair-fresh-replay-partial`.

## Manual `needs-confirmation` fixture

`needs-confirmation-fixture.sqlite` keeps the same three current executions and formal revision 24 intact. Its draft revision 33 is an explicit stale UI state:

- draft document status: `needs-confirmation`;
- manual association: `needs-confirmation`, `decisionId=null`;
- draft association execution IDs: entry + partial, with close omitted;
- stale execution marker: `synthetic-repair-fresh-replay-close`;
- formal document remains `completed`, linked, and associated with all three executions.

The draft JSON and `recall_manual_evaluation_association_executions` projection agree. This lets the workspace render the pending action without relying on a write or an import during setup.

Start it on the same port after stopping the other fixture service:

```sh
cd /Users/zhoulin/.codex/worktrees/f7a5/TradeReview
TRADEREVIEW_DB_PATH=/Users/zhoulin/.codex/worktrees/f7a5/TradeReview/.scratch/chart-first-review-implementation/repair/fault-acceptance/needs-confirmation-fixture.sqlite npm run dev -- --hostname 127.0.0.1 --port 3052
```

Open 999996's post-review plan/More panel. The expected alert is `成交集合已变化，当前标签需要确认归属。` with the button `确认使用当前回合成交`. Clicking it is a UI-only confirmation check; any resulting save writes only this fixture.

These are isolated historical/UI fixtures. They prove the two consumers can render preserved missing evidence and a pending association; they do not claim that a real PDF/XLSX reimport produced either state. The synthetic state was prepared because the existing backup has no `import_batches` source identity and TradingView CSVs create a separate simulation scope.

Validation performed without starting a service or browser: Python syntax compilation, SQLite backup and integrity checks, source/fixture execution count and SHA checks, and Node `node:sqlite` read-only checks of both documents and foreign-key state.
