# Screenshot Context Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the screenshot review dialog's timezone and account controls visually consistent, readable, and responsive.

**Architecture:** Keep the existing React markup and interaction handlers. Add a focused `.screenshot-review-context` CSS block in `app/globals.css`, with stacked labels, shared control sizing, and responsive wrapping; test the public dialog controls and CSS contract without changing state behavior.

**Tech Stack:** React, TypeScript, CSS, Testing Library, Vitest.

## Global Constraints

- Labels use `10px` text and controls use `12px` text.
- Controls are `34px` high with `8px` radius and `10px` horizontal padding.
- The context bar uses `16px` field spacing and `12px` vertical padding.
- The timezone field targets `300px`; the account field targets `240px`.
- Narrow layouts wrap fields without changing copy or behavior.

---

### Task 1: Lock the context-bar visual contract in tests

**Files:**
- Modify: `app/components/import/screenshot-review-dialog.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Existing public controls remain accessible as `截图成交时区` and `交易账户`.
- CSS selectors `.screenshot-review-context`, `.screenshot-review-context label`, `.screenshot-review-context select`, and `.screenshot-review-context input` define the visual seam.

- [ ] **Step 1: Add a failing CSS contract test**

Read `app/globals.css` in the test and assert the context selector includes the required layout values: `display: flex`, `gap: 16px`, `padding: 12px`, control height `34px`, label `font-size: 10px`, and control `font-size: 12px`. Keep the existing render assertions for the timezone select and account input.

- [ ] **Step 2: Run the focused test and verify it fails**

```bash
npx vitest run app/components/import/screenshot-review-dialog.test.tsx --reporter=dot -t "context"
```

Expected: FAIL because the context-bar CSS selectors do not exist.

- [ ] **Step 3: Add the focused responsive CSS**

Insert the `.screenshot-review-context` rules beside the screenshot review dialog rules in `app/globals.css`. Use a horizontal flex row with `align-items: flex-end`, `gap: 16px`, `padding: 12px 22px`, and a bottom border. Stack each label with `display: grid; gap: 6px`, set label color/font, and style the select/input with `height: 34px`, `padding: 0 10px`, `border-radius: 8px`, dark background, and a blue focus border. Give the first label `flex: 0 1 300px` and the second `flex: 0 1 240px`; set both controls to `width: 100%` and `min-width: 0`. Add a max-width media rule that allows the bar to wrap and lets labels flex to `min(100%, 300px)`.

- [ ] **Step 4: Run the focused test and verify it passes**

```bash
npx vitest run app/components/import/screenshot-review-dialog.test.tsx --reporter=dot -t "context"
```

Expected: PASS, with the existing accessibility interaction assertions unchanged.

- [ ] **Step 5: Commit the visual change**

```bash
git add app/globals.css app/components/import/screenshot-review-dialog.test.tsx
git commit -m "fix: balance screenshot review context controls"
```

### Task 2: Verify the complete UI change

**Files:**
- Verify: `app/components/import/screenshot-review-dialog.tsx`
- Verify: `app/globals.css`

- [ ] **Step 1: Run the complete component test**

```bash
npx vitest run app/components/import/screenshot-review-dialog.test.tsx --reporter=dot
```

Expected: all screenshot review dialog tests pass.

- [ ] **Step 2: Run repository checks**

```bash
npm run typecheck
npm run lint
git diff --check
```

Expected: all commands exit successfully.

- [ ] **Step 3: Inspect the final diff**

```bash
git status --short --branch
git diff HEAD^ -- app/globals.css app/components/import/screenshot-review-dialog.test.tsx
```

Confirm no component logic, labels, or unrelated styles changed.
