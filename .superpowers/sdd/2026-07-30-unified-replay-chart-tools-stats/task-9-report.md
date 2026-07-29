# Task 9 report: path statistics and autosaved episode notes

## Implementation

Added a cursor-safe right-side review panel composed of:

- `PositionStatsPanel`, a presentation-only formatter for upstream
  `PositionPathMetrics` with Chinese locale currency, signed P&L/path values,
  duration, percentage, planned-risk, and R formatting. Any upstream
  unavailable state renders an em dash plus its supplied reason, including an
  empty ledger carrying numeric zeroes.
- `useEpisodeReviewAutosave`, which owns the episode-scoped draft lifecycle:
  600ms debounce by default, planned-risk validation, normalized/timestamped
  save records, retry after rejection, and valid draft flushing during episode
  changes or unmount.
- `EpisodeNotesPanel`, retaining every existing plan/review field, tags, and
  completion state with announced save/error status.
- `ReviewSidePanel`, with accessible stats/notes tabs and one mounted editable
  form at a time: desktop aside or focus-restoring modal drawer.

The pre-existing `thesis-panel.tsx` and its workspace call site are unchanged,
as required for Task 10 migration compatibility.

## Files

- `app/components/review/position-stats-panel.tsx`
- `app/components/review/position-stats-panel.test.tsx`
- `app/components/review/use-episode-review-autosave.ts`
- `app/components/review/use-episode-review-autosave.test.tsx`
- `app/components/review/episode-notes-panel.tsx`
- `app/components/review/episode-notes-panel.test.tsx`
- `app/components/review/review-side-panel.tsx`
- `app/components/review/review-side-panel.test.tsx`
- `app/globals.css`

## RED evidence

Initial Task 9 behavior suites were added before production modules existed:

```sh
npm run test:unit -- app/components/review/position-stats-panel.test.tsx app/components/review/use-episode-review-autosave.test.tsx app/components/review/episode-notes-panel.test.tsx app/components/review/review-side-panel.test.tsx
```

Result: all four suites failed to resolve their absent modules.

An additional cursor-safety regression test then required an unavailable
metrics object with a zero-valued empty ledger to show no `+HK$0.00` value:

```sh
npm run test:unit -- app/components/review/position-stats-panel.test.tsx
# 1 failed / 1 passed: rendered +HK$0.00 before the presentation correction
```

## GREEN and verification evidence

```sh
# focused Task 9 suite
npm run test:unit -- app/components/review/position-stats-panel.test.tsx app/components/review/use-episode-review-autosave.test.tsx app/components/review/episode-notes-panel.test.tsx app/components/review/review-side-panel.test.tsx app/components/review/episode-review-editor.test.tsx
# 5 files passed, 12 tests passed

npm run test:unit
# 54 files passed, 247 tests passed

npm run typecheck
# exit 0

npm run lint
# exit 0

git diff --check
# exit 0
```

## Commit

Implementation commit: `1ceb194c9ca026a32ce231045be6194ad9ac6a95`
(`feat: add path statistics and autosaved notes`).

## Concerns / follow-up

- Task 9 deliberately exports additive, standalone panel APIs only. Task 10
  must own workspace wiring, replacement of the legacy thesis panel, and any
  final responsive integration.
- The autosave hook flushes valid pending records on identity transitions and
  unmount; invalid planned-risk drafts remain local with a visible correction
  error rather than being persisted.

## Remediation round 1

### Scope addressed

- A single stable `PanelContent` now remains mounted across stats/notes tab
  changes and desktop/drawer presentation changes. Its one notes form and
  autosave hook therefore retain dirty and failed drafts even when a pending
  repository rejection settles after the visible surface changes.
- Both tabpanels now remain mounted and have stable, matching `aria-controls`
  targets. The inactive panel uses `hidden`, while the notes form exists only
  once.
- The notes footer announces `等待自动保存` for the debounce/dirty interval,
  in addition to existing saving, saved, and error messages.
- `useModalFocus` received one backward-compatible optional `active` argument.
  The review panel enables it only in drawer mode, preserving focus restoration
  without activating modal keyboard behavior for the desktop aside. Existing
  import dialogs retain their default active behavior unchanged.

### RED evidence

New regression coverage failed before the remediation implementation:

```sh
npm run test:unit -- app/components/review/episode-notes-panel.test.tsx app/components/review/review-side-panel.test.tsx
```

Result: 3 failures. They showed the absent dirty status announcement, a missing
inactive tabpanel target, and loss of the notes form/draft after switching to
the drawer while a save was pending.

### GREEN and verification evidence

```sh
# focused Task 9 suite
npm run test:unit -- app/components/review/position-stats-panel.test.tsx app/components/review/use-episode-review-autosave.test.tsx app/components/review/episode-notes-panel.test.tsx app/components/review/review-side-panel.test.tsx app/components/review/episode-review-editor.test.tsx
# 5 files passed, 15 tests passed

npm run test:unit
# 54 files passed, 250 tests passed

npm run typecheck
# exit 0

npm run lint
# exit 0

git diff --check
# exit 0
```

Remediation implementation commit:
`6b0fb9bb7635d7375e3d1d5196d95e64d23cf97a`
(`fix: preserve autosave drafts across panel views`).
