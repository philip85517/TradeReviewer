# R9 conflict reload

## Scope

The real-browser path was A3049/B3051 on plan `999999`: B saved quantity `1200`; A edited `1300`, received the expected revision conflict, then clicked `重新载入`. The conflict banner cleared, but A still rendered `1300` (risk `5200`) while a fresh server load contained `1200`.

Only these product/test files were changed for R9:

- `app/components/recall/recall-workspace.tsx`
- `app/components/recall/recall-workspace.test.tsx`

## Diagnosis

`planEdits` is a field-level local overlay keyed by decision id. Plan rendering prefers that overlay over `document.plans.drafts`. The explicit conflict reload called the repository load path, which replaced `document` but only cleared `planEdits` on an episode change. Consequently the newly loaded server draft was immediately shadowed by the stale `1300` overlay.

The component has a separate `currentDraft` path for market-data hydration. That path intentionally retains mounted controls and unsaved local plan input, so the fix must apply only to a full repository reload. The full reload also refreshed the latest-saved document/generation refs, but an accepted queued-save entry for the episode could still be reused; that entry is now removed at the same discard boundary.

## Red reproduction

After adding the conflict reload test, before the product change:

```text
npx vitest run app/components/recall/recall-workspace.test.tsx --maxWorkers=1 --reporter=dot -t 'reloads server plan input'

Test Files 1 failed (1)
Tests 1 failed | 52 skipped (53)
Expected the element to have value: 1200
Received: 1300
```

The test fixture models a server draft at `1100`, a conflicting server revision at `1200`, and a local edit to `1300` before the 409 response.

## Fix

Immediately before committing a successfully loaded document in the full repository-load branch, `loadEpisode` now:

1. clears `planEdits`, so the loaded `plans.drafts` value is authoritative after an explicit reload;
2. deletes the episode's accepted queued-save/CAS overlay;
3. keeps the existing latest-saved document and generation reset.

The market hydration branch is unchanged and continues to retain local unsaved plan input. No global error filtering or exception swallowing was added.

## Green verification

The focused reproduction, including a second edit/save after reload, passes:

```text
npx vitest run app/components/recall/recall-workspace.test.tsx --maxWorkers=1 --reporter=dot -t 'reloads server plan input'

Test Files 1 passed (1)
Tests 1 passed | 52 skipped (53)
```

The complete workspace test file passes:

```text
npx vitest run app/components/recall/recall-workspace.test.tsx --maxWorkers=1 --reporter=dot

Test Files 1 passed (1)
Tests 53 passed (53)
```

The post-reload assertions verify server `1200`, then a new local `1300` plus entry `11` is saved with `resolvedQuantity: "1300"`; this guards against stale overlay reuse and accidental loss of another edited field. `git diff --check` passes for both scoped files. Build, full suite, browser, and database checks were intentionally left to the coordinator.
