# Screenshot OCR Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent screenshot-review table text overlap and make local OCR resilient to long, dark, or low-contrast screenshots.

**Architecture:** Keep the existing screenshot OCR and parser boundaries. Tighten row grouping in `layout-detector`, add a bounded timestamp selector in both broker parsers, add a per-tile original-color fallback and cleanup in `image-pipeline`, and make the table render values inside an explicitly shrinkable wrapper while preserving full evidence text in ARIA labels and the evidence drawer.

**Tech Stack:** TypeScript, React 19, Vitest, Testing Library, CSS in `app/globals.css`, PaddleOCR.js local WASM.

## Global Constraints

- OCR and image previews remain browser-local; no image is uploaded or persisted.
- Keep the existing JPG, PNG, and WebP validation limits and same-origin OCR assets.
- Preserve the existing Futu/Tiger fail-closed layout detection contract.
- Use decimal strings for parsed quantities and prices; do not introduce floating-point conversion.
- Use `apply_patch` for source edits and run focused tests before the broader suite.

### Task 1: Bound OCR row grouping and timestamp extraction

**Files:**
- Modify: `app/lib/import/screenshot/layout-detector.ts`
- Modify: `app/lib/import/screenshot/futu-screenshot.ts`
- Modify: `app/lib/import/screenshot/tiger-screenshot.ts`
- Test: `app/lib/import/screenshot/layout-detector.test.ts`
- Test: `app/lib/import/screenshot/futu-screenshot.test.ts`
- Test: `app/lib/import/screenshot/tiger-screenshot.test.ts`

**Interfaces:**
- `anchorTradeRows(image, options)` continues returning `AnchoredTradeRow[]`, but its corroboration window is derived from OCR line heights and capped independently of `image.height`.
- `timestampValue(lines)` continues returning `{ value?: string; evidence?: ScreenshotFieldEvidence }`, selecting at most one date/time pair from the provided row band.

- [ ] **Step 1: Write failing tests**

Add a long-image fixture with two side anchors separated by one normal row height while `image.height` is at least 13,000. Assert both anchors are retained and each row contains only its own corroborating lines. Add Futu and Tiger parser cases with two date/time pairs in one broad candidate band and assert the draft timestamp is a single pair rather than a concatenated string.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm run test:unit -- app/lib/import/screenshot/layout-detector.test.ts app/lib/import/screenshot/futu-screenshot.test.ts app/lib/import/screenshot/tiger-screenshot.test.ts`

Expected: the new long-image test groups unrelated lines or the timestamp assertion receives a multi-date string.

- [ ] **Step 3: Implement the minimal parser fix**

Compute a robust OCR line-height statistic from positive `sourceBounds.height` values, use a small multiple of that statistic as the local corroboration window, and cap it so a long image cannot expand the window. In each broker’s timestamp helper, normalize line text, identify date-like and time-like lines, pair the closest date and time in the current band, and fall back to the existing ordered join only when no date/time pair can be identified. Keep the original selected lines as evidence bounds.

- [ ] **Step 4: Run focused tests to verify they pass**

Run the same Vitest command. Expected: all layout and parser tests pass, including existing fixture behavior and the new long-image cases.

- [ ] **Step 5: Commit the parser fix**

Run: `git add app/lib/import/screenshot/layout-detector.ts app/lib/import/screenshot/futu-screenshot.ts app/lib/import/screenshot/tiger-screenshot.ts app/lib/import/screenshot/layout-detector.test.ts app/lib/import/screenshot/futu-screenshot.test.ts app/lib/import/screenshot/tiger-screenshot.test.ts && git commit -m "fix: keep screenshot OCR rows isolated"`

### Task 2: Add per-tile OCR fallback and resource cleanup

**Files:**
- Modify: `app/lib/import/screenshot/image-pipeline.ts`
- Test: `app/lib/import/screenshot/image-pipeline.test.ts`

**Interfaces:**
- `recognizeScreenshot(input, engine, options)` continues returning `OcrImageResult` with source coordinates in the original image.
- The local engine is called once with the enhanced tile and only when that result contains no lines, once more with the original-color tile.

- [ ] **Step 1: Write the failing tests**

Add a test where the mocked engine returns no lines for the enhanced Blob and one OCR line for the raw-color Blob; assert both calls occur and the returned line is remapped to source coordinates. Add a test that asserts each processed tile canvas is reset after recognition, including when recognition rejects.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm run test:unit -- app/lib/import/screenshot/image-pipeline.test.ts`

Expected: the fallback call count is one and tile canvas dimensions remain nonzero because the current implementation has only one pass and no per-tile cleanup.

- [ ] **Step 3: Implement the minimal OCR fallback**

Keep the drawn source tile before preprocessing, encode the enhanced tile, call the engine, and if the result has no lines encode the untouched source tile and call the engine again. Merge fallback lines with the primary result, preserving the first successful result when both contain text. Put per-tile canvas reset in a `finally` block so cleanup occurs on success, fallback, cancellation, and engine error. Preserve abort checks before each engine call and after each promise.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm run test:unit -- app/lib/import/screenshot/image-pipeline.test.ts`. Expected: all pipeline tests pass.

- [ ] **Step 5: Commit the OCR pipeline fix**

Run: `git add app/lib/import/screenshot/image-pipeline.ts app/lib/import/screenshot/image-pipeline.test.ts && git commit -m "fix: retry screenshot OCR with raw tiles"`

### Task 3: Prevent table value overlap while preserving evidence

**Files:**
- Modify: `app/components/import/screenshot-trade-table.tsx`
- Modify: `app/globals.css`
- Test: `app/components/import/screenshot-review-dialog.test.tsx`

**Interfaces:**
- `ScreenshotTradeTable` keeps the existing field click/keyboard behavior and labels.
- Visible values are rendered as `.screenshot-field-value` inside `.screenshot-field-content`; full values remain in the cell `aria-label`.

- [ ] **Step 1: Write the failing test**

Render a draft with a long timestamp and a pending field. Assert the selected cell exposes the complete accessible name, contains a `.screenshot-field-value` node for the full value, and contains a separate pending marker so CSS can shrink only the value.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:unit -- app/components/import/screenshot-review-dialog.test.tsx`

Expected: the new selector cannot find `.screenshot-field-value` because the current markup renders a bare span.

- [ ] **Step 3: Implement the minimal visual fix**

Wrap field content in a shrinkable span, mark the value span with `screenshot-field-value`, keep the pending marker as a non-shrinking sibling, and set table data cells to `overflow: hidden; text-overflow: ellipsis`. Avoid changing evidence text or the cell’s click/keyboard handlers.

- [ ] **Step 4: Run the focused test to verify it passes**

Run the same Vitest command. Expected: the dialog tests pass and the accessible cell name still includes the complete OCR value.

- [ ] **Step 5: Commit the table fix**

Run: `git add app/components/import/screenshot-trade-table.tsx app/globals.css app/components/import/screenshot-review-dialog.test.tsx && git commit -m "fix: contain screenshot review table text"`

### Task 4: Verify the complete change

**Files:**
- Test: existing project test suites only.

- [ ] **Step 1: Run focused OCR and UI suites**

Run: `npm run test:unit -- app/lib/import/screenshot app/components/import/screenshot-review-dialog.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run type checking and lint**

Run: `npm run typecheck && npm run lint`

Expected: exit code 0 with no new diagnostics.

- [ ] **Step 3: Run the project verification command**

Run: `npm test`

Expected: production build and rendered HTML test pass.
