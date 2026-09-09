# 截图交易校对确认阈值与单行放弃实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让高置信度成交时间自动通过校对，并为无法确认的截图成交提供明确的单行放弃入口。

**Architecture:** 保留现有截图校对状态模型。`reviewBlockers` 统一使用字段证据规则；证据面板复用 `delete-draft` action，把放弃行加入现有 `deletedDraftIds`，因此后续统计、reconciliation 和导入转换自然排除该行。

**Tech Stack:** TypeScript, React 19, Vitest 4, Testing Library, lucide-react。

## Global Constraints

- `executedAt` 使用现有 `SCREENSHOT_REVIEW_CONFIDENCE = 0.85`，不得新增独立时间戳阈值。
- 自动修复、低置信、缺少证据或无效字段仍必须确认、修改或放弃。
- 放弃只影响当前 draft，不新增持久化字段、导入协议字段或诊断记录。
- 所有成交 draft 都被放弃时仍阻止空批次导入。
- 每个生产改动先写一个会失败的行为测试，再写最小实现并验证全套相关测试。

---

### Task 1: 统一成交时间字段的确认规则

**Files:**
- Modify: `app/lib/import/screenshot/review-state.test.ts:331-405`
- Modify: `app/lib/import/screenshot/review-state.ts:374-381`

**Interfaces:**
- Consumes: `ScreenshotFieldEvidence`, `SCREENSHOT_REVIEW_CONFIDENCE`, `reviewBlockers`, existing `draft()` and `state()` test helpers.
- Produces: unchanged `reviewBlockers(state)` API; `executedAt` follows the same unconfirmed-field predicate as price and other fields.

- [ ] **Step 1: Replace the timestamp regression with the desired boundary behavior**

Change the existing test named `requires explicit confirmation for an exact-second timestamp at any score` to two cases: one with `confidence: 0.8499` that expects an `unconfirmed-field` blocker for `executedAt`, and one with `confidence: 0.85` that expects no blocker. Keep `repaired: false`, `confirmedByUser: false`, and the valid timestamp text `2024/06/05 14:39:25` so the test isolates the confidence rule.

- [ ] **Step 2: Run the focused test and verify it fails for the old special case**

Run:

```bash
npm run test:unit -- app/lib/import/screenshot/review-state.test.ts
```

Expected: FAIL because the current `reviewBlockers` condition contains `field === "executedAt"`, so the `0.85` timestamp still produces an `unconfirmed-field` blocker.

- [ ] **Step 3: Remove only the timestamp special case**

In `review-state.ts`, change:

```ts
(!evidence.confirmedByUser &&
  (field === "executedAt" ||
    !Number.isFinite(evidence.confidence) ||
    evidence.confidence < SCREENSHOT_REVIEW_CONFIDENCE ||
    evidence.repaired))
```

to:

```ts
(!evidence.confirmedByUser &&
  (!Number.isFinite(evidence.confidence) ||
    evidence.confidence < SCREENSHOT_REVIEW_CONFIDENCE ||
    evidence.repaired))
```

Do not alter the separate `wallClockToInstant` validation below it.

- [ ] **Step 4: Run the focused test and the screenshot state tests**

Run:

```bash
npm run test:unit -- app/lib/import/screenshot/review-state.test.ts
```

Expected: all tests in the file pass, including the existing repaired-evidence, invalid-confidence, missing-timezone, missing-account, and ambiguous-time cases.

- [ ] **Step 5: Commit the isolated behavior change**

```bash
git add app/lib/import/screenshot/review-state.ts app/lib/import/screenshot/review-state.test.ts
git commit -m "fix: relax screenshot timestamp confirmation"
```

### Task 2: Add an explicit evidence-panel action to abandon one row

**Files:**
- Modify: `app/components/import/screenshot-evidence-panel.tsx:181-284`
- Modify: `app/components/import/screenshot-review-dialog.test.tsx` (field evidence interaction tests)
- Modify: `app/lib/import/screenshot/review-state.test.ts` (reducer/filtered import behavior if no existing test covers it)
- Verify: `app/lib/import/screenshot/to-statement-result.ts:24-40`

**Interfaces:**
- Consumes: existing `ScreenshotReviewAction` union member `{ type: "delete-draft"; draftId: string }`, `FieldSelection.draft.id`, and the existing `onAction` callback.
- Produces: a visible button named `放弃这条记录` that dispatches exactly `{ type: "delete-draft", draftId: draft.id }`; no new action type.

- [ ] **Step 1: Add the failing UI test for the abandon action**

In `screenshot-review-dialog.test.tsx`, open the existing low-confidence NVDA price cell, click the evidence-panel button named `放弃这条记录`, and assert:

```ts
expect(onAction).toHaveBeenCalledWith({
  type: "delete-draft",
  draftId: "draft-nvda",
});
```

Keep the component test focused on the dispatched action; cover filtering in the reducer test below.

- [ ] **Step 2: Run the focused dialog test and verify it fails because the button is absent**

Run:

```bash
npm run test:unit -- app/components/import/screenshot-review-dialog.test.tsx
```

Expected: FAIL with Testing Library unable to find a button named `放弃这条记录`.

- [ ] **Step 3: Render the button in `FieldEvidence`**

Add a secondary action next to the existing `确认识别值` and `保存修改` buttons:

```tsx
<button
  className="secondary-button screenshot-abandon-button"
  type="button"
  onClick={() =>
    onAction({ type: "delete-draft", draftId: draft.id })
  }
>
  放弃这条记录
</button>
```

Keep the existing buttons and callbacks unchanged. The action must be present for every field evidence panel, including missing/invalid fields where `evidence` is absent.

- [ ] **Step 4: Run the dialog test and verify the action dispatch passes**

Run:

```bash
npm run test:unit -- app/components/import/screenshot-review-dialog.test.tsx
```

Expected: all dialog tests pass and the new assertion receives the exact draft ID.

- [ ] **Step 5: Add a reducer/import regression for the abandoned row**

Using the existing `state()` helper in `review-state.test.ts`, dispatch:

```ts
const next = screenshotReviewReducer(state(), {
  type: "delete-draft",
  draftId: "image-1:tiger:0",
});
```

Assert that `reviewBlockers(next)` has no blocker whose `draftId` is the deleted draft, that `next.deletedDraftIds` contains the ID, and that `toStatementParseResult(next).records` is an empty array for the one-row state. This proves the deleted draft is excluded from the import conversion while the reducer keeps the state valid for the existing empty-batch completion guard.

- [ ] **Step 6: Run the focused screenshot test set**

Run:

```bash
npm run test:unit -- app/lib/import/screenshot/review-state.test.ts app/lib/import/screenshot/to-statement-result.test.ts app/components/import/screenshot-review-dialog.test.tsx
```

Expected: all focused screenshot review tests pass with no warnings or unhandled errors.

- [ ] **Step 7: Commit the abandon-row interaction**

```bash
git add app/components/import/screenshot-evidence-panel.tsx app/components/import/screenshot-review-dialog.test.tsx app/lib/import/screenshot/review-state.test.ts
git commit -m "feat: allow abandoning uncertain screenshot rows"
```

### Task 3: Full verification and handoff

**Files:**
- Verify: all files changed by Tasks 1–2.

- [ ] **Step 1: Run TypeScript validation**

```bash
npm run typecheck
```

Expected: exit code 0 and no TypeScript errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exit code 0 and no ESLint errors.

- [ ] **Step 3: Run the full unit suite**

```bash
npm run test:unit
```

Expected: all Vitest tests pass.

- [ ] **Step 4: Inspect the final diff and working tree**

```bash
git diff HEAD~2..HEAD --stat
git status --short
```

Expected: only the confirmed design, timestamp rule, abandon action, and their tests are changed; no unrelated files are modified.

- [ ] **Step 5: Commit any required formatting-only correction**

If lint or formatting requires a correction, make the smallest edit in the affected implementation or test file, rerun the failed verification command, and stage the known screenshot-review files before committing:

```bash
git add app/lib/import/screenshot/review-state.ts app/lib/import/screenshot/review-state.test.ts app/components/import/screenshot-evidence-panel.tsx app/components/import/screenshot-review-dialog.test.tsx
git commit -m "chore: format screenshot review changes"
```
