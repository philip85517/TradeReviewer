# Task 8 report: functional chart toolbar controls

## Implementation

Activated the chart toolbar's previously inert controls with local instrument
search, market-data details and refresh, chart settings, layer/fullscreen
triggers, disabled-period explanations, and accessible popover state.

The new orchestration props are additive and optional. Existing consumers keep
their prior symbol, timeframe, and `supportedTimeframes` behavior until Task 10
wires the workspace-owned inputs and removes the compatibility path.

## Files

- `app/components/chart/chart-toolbar.tsx`
- `app/components/chart/chart-toolbar.test.tsx`
- `app/components/chart/instrument-search-popover.tsx`
- `app/components/chart/instrument-search-popover.test.tsx`
- `app/components/chart/market-data-popover.tsx`
- `app/components/chart/market-data-popover.test.tsx`
- `app/components/chart/chart-settings-popover.tsx`
- `app/components/chart/chart-settings-popover.test.tsx`
- `app/components/chart/use-fullscreen.ts`
- `app/components/chart/use-fullscreen.test.tsx`
- `app/globals.css`

## RED evidence

1. Added the initial toolbar interaction test, then ran:

   ```sh
   npm run test:unit -- app/components/chart/chart-toolbar.test.tsx
   ```

   Result: 1 failed / 1 passed. The expected failure was that clicking
   `搜索标的` did not expose the labelled searchbox.

2. Added the new search, market-data, settings, and fullscreen test suites,
   then ran the focused command from the brief.

   Result: all four new suites failed to resolve their absent modules and the
   toolbar interaction still failed. This established that the failures were
   due to the unimplemented controls, not test setup.

3. Added the repeated-popover-trigger accessibility test after identifying a
   batching edge case, then ran:

   ```sh
   npm run test:unit -- app/components/chart/chart-toolbar.test.tsx
   ```

   Result: 1 failed / 4 passed. The trigger remained
   `aria-expanded="true"` after a second click, as expected before the
   minimal toggle-handler correction.

## GREEN and verification evidence

```sh
npm run test:unit -- app/components/chart/chart-toolbar.test.tsx app/components/chart/instrument-search-popover.test.tsx app/components/chart/market-data-popover.test.tsx app/components/chart/chart-settings-popover.test.tsx app/components/chart/use-fullscreen.test.tsx
# 5 files passed, 15 tests passed

npm run lint
# exit 0

npm run test:unit
# 50 files passed, 232 tests passed

npm run typecheck
# exit 0

git diff --check
# exit 0
```

## Commit

Implementation commit: `e3e706db21f5b9223daf9ae02483e6c924bb42df`
(`feat: activate chart toolbar controls`).

## Concerns / follow-up

- `aria-description` is required by the Task 8 contract for disabled period
  and layer explanations. The repository's a11y lint rule does not yet
  recognise that ARIA attribute for buttons, so its narrowly scoped lint
  suppression documents the intentional compatibility choice.
- Fullscreen is injected as an optional hook result; the workspace element and
  persisted chart/data inputs intentionally remain unwired until Task 10, per
  the approved migration constraint.

## Remediation round 1

### Scope addressed

- Status-aware market-data fallback copy: only `not-requested` says no request
  was made; partial, empty, syncing, and failed states each report their real
  condition while retaining the limitation reason.
- Fullscreen request and exit failures are caught by the hook and returned as a
  safe `false` result with recoverable error state. The toolbar also catches an
  injected rejected toggle and announces it with a live status message.
- Unsupported fullscreen controls now expose a concise title and accessible
  disabled reason.
- Search listens for Escape at the dialog/document level, so closing works from
  result options as well as the search field and restores trigger focus.
- Fullscreen state initializes from an already-fullscreen target.
- The first-run test now proves a non-demo imported instrument excludes both
  the bundled demo result and its selectable ID.

### RED evidence

```sh
npm run test:unit -- app/components/chart/chart-toolbar.test.tsx app/components/chart/instrument-search-popover.test.tsx app/components/chart/market-data-popover.test.tsx app/components/chart/chart-settings-popover.test.tsx app/components/chart/use-fullscreen.test.tsx
```

Result before the remediation implementation: 4 files failed, 8 tests failed.
The failures covered status-matrix copy, Escape from a focused result,
fullscreen request rejection, initial fullscreen synchronization, and missing
toolbar feedback for a rejected injected toggle.

### GREEN and verification evidence

```sh
# focused Task 8 suite
# 5 files passed, 23 tests passed

npm run typecheck
# exit 0

npm run lint
# exit 0

npm run test:unit
# 50 files passed, 240 tests passed

git diff --check
# exit 0
```

Remediation implementation commit:
`c49bd0085b650d6b49c4618aa914ea7c024383d6`
(`fix: harden chart toolbar feedback`).
