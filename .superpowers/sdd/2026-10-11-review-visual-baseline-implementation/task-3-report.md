# Task 3 report: DrawingCanvas creation and selection feedback

## Scope and contract

This task covered the real `DrawingCanvas` creation contract for staged
single-point tools, risk/reward defaults, and the existing text/selection
feedback paths. The reviewed references were:

- `task-3-brief.md`
- `.scratch/review-visual-baseline-plan-20261011/DESIGN-COVERAGE.md`
- `.scratch/review-visual-baseline-plan-20261011/STATE-TRANSITIONS.md`
- `docs/agents/frontend-control-audit.md`

The implementation scope stayed within `app/components/chart/drawing-canvas.tsx`
and its focused creation test. Existing text price-anchor/edit-card,
selection pulse, drag cursor, and risk/reward handle behavior was preserved;
the new test suite exercises the real component contract rather than mocked
state transitions.

## Changes

- Horizontal line, vertical line, and price label now remain staged after the
  first pointer down and commit only on the confirming pointer release.
- A staged single-point drawing shows the existing first-point status and can
  be cancelled with Escape without emitting an add command.
- New long risk/reward creation is covered by a real component test asserting
  a preserved stop anchor and a default 1:1 target distance. The existing
  `createRiskRewardAnchors` implementation already supplies that default.

## Verification

### Mocked/jsdom evidence

The following commands passed:

```text
npx vitest run app/components/chart/drawing-canvas.creation.test.tsx --reporter=verbose
npx vitest run app/components/chart/drawing-canvas.creation.test.tsx app/components/chart/drawing-canvas.selection.test.tsx app/components/chart/drawing-canvas.labels.test.tsx --reporter=verbose
npx vitest run app/components/chart/drawing-canvas*.test.tsx --reporter=dot
npx tsc --noEmit
npx eslint app/components/chart/drawing-canvas.tsx app/components/chart/drawing-canvas.creation.test.tsx app/components/chart/drawing-canvas.selection.test.tsx app/components/chart/drawing-canvas.labels.test.tsx
git diff --check
```

The scoped suite passed 66 tests and the complete DrawingCanvas test glob
passed 160 tests. The initial scoped red run failed the four new staged-tool
expectations before the implementation was changed; after the change it was
green. jsdom still prints the repository's expected canvas `getContext`
not-implemented noise.

### Real-browser evidence

**NOT VERIFIED.** No real browser session or clickable preview was available
to this subtask. Browser acceptance must independently check the staged
horizontal/vertical/price journeys, Text anchor/card states, selection/drag
pulse and cursor transitions, and risk/reward creation in the integrated
workspace with an isolated write database.

## Acceptance status

The mocked component contract is green. Real-browser visual and persistence
evidence remains unverified and therefore is an explicit open gate for the
coordinator's final acceptance.

## Commit

Commit: `5ee133c0`
