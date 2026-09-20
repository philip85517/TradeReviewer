# Recall Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. User authorized execution with luna/max implementers and a separate luna test agent; scoped file briefs only.

**Goal:** Implement the Recall workspace spec v1.0 in the existing isolated checkout.
**Architecture:** Add a versioned recall aggregate beside legacy review records, reuse existing chart infrastructure with extended drawing contracts, and integrate through a recall controller rather than duplicate broker/data ingestion.
**Tech Stack:** React/TypeScript, Lightweight Charts, Node SQLite, Vitest.
**Spec:** docs/specs/2026-09-19-review-workspace.md

## Global Constraints

- Actual Recall, no simulated orders; one completed record per zero-to-zero episode.
- Per-decision multi-snapshots; retain independently editable image/text/chart state; autosave drafts, explicit episode completion.
- Same worktree, disjoint file ownership; luna/max; no history forks; no subagents from workers; no global git add/reset/checkout.
- Branch codex/recall-workspace. No deployment or push. Spec and user documents must remain intact.
- User has authorized development: engineering decisions are ruled and recorded, not represented as completed HITL wayfinder interviews.

## Review Focus

Conflicting autosaves; snapshots sharing mutable references; same-bar executions leaking future holdings; snapshot PNG and text mismatches; directory partial writes overwriting user artifacts.

## Tasks

### Task 1: Recall aggregate and persistence
- [x] Implement app/lib/recall/{types,decisions,document,repository}.ts and tests; new app/api/storage/recall/route.ts; schema migration in db/sqlite-schema.ts only if needed.
- [x] Preserve decision IDs across reconciliation, group/split, snapshot completeness, finalized revision with expectedRevision conflict.
- [x] Test grouping, mutation isolation, incomplete completion, stale writes, round-trip frozen candles/images.
- [x] Publish compact API contract and file-scoped report.

### Task 2: Chart authoring and capture
- [x] Extend app/lib/chart and app/components/chart only: multiline anchored/free Text, drawing geometry for channel/Fibonacci, styles, view/capture handles.
- [x] Capture base chart + overlays at 2x, stable view across mode changes; expose API via optional onReady handle without disrupting existing callers.
- [x] Test geometry, IME/editing, independent viewport state and capture failure.

### Task 3: Independent validation
- [x] Install dependencies and establish baseline. Own test additions/review reports, not production code. Review Task 1/2 against scoped briefs after reports.
- [x] Run focused checks then typecheck/lint/unit/build; report exact logs and baseline failures separately.

### Task 4: Recall workspace integration and dual cursors
- [x] Add app/components/recall controller/navigation UI and wire app/components/trade-review-workspace.tsx; remove review-mode import clutter and note sidebar.
- [x] Use frozen snapshots/working draft separation, explicit decisions, grouping, replay cursor, modal statistics and autosave.
- [x] Verify end-to-end imported episode with multi-decision and multiple snapshots.

### Task 5: Export pipeline
- [x] Add pure Markdown/image manifest, ZIP and directory adapters, preview sorting and revision dedup, unique YYYYMMDD naming.
- [x] Reuse retained PNG only; export current draft or formal document explicitly; no write to server directory.
- [x] Test offline relative references, same-name collision and interruption handling.

### Task 6: Integration fixes and independent final review
- [x] Resolve scoped findings; whole-worktree independent review and relevant checks; browser smoke where accessible.
- [x] Record implementation limits honestly and update README; do not claim unexecuted native directory tests passed.
