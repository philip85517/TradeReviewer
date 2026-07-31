# Task 11 report: responsive polish, documentation, and verification

## Implementation

Task 11 keeps the unified replay architecture unchanged and adds the final
responsive, interaction-state, smoke-test, and documentation polish.

- The three-column desktop workspace and fixed review panel remain active at
  `1260px` and above.
- At `1259px` and below, the fixed review panel is hidden and the focus-
  restoring `打开复盘面板` drawer trigger is shown.
- At `1060px`, the two-column layout remains. At `1059px` and below, the
  instrument sidebar is hidden and the chart becomes the only workspace
  column.
- The narrow search popover is pinned to `9px` from both chart-toolbar edges
  with automatic width rather than retaining its desktop `left: 180px`
  offset.
- The drawer is right-aligned and animated, while reduced-motion preferences
  disable drawer/backdrop, spinner, and playing-indicator animation.
- Selected, hover, disabled, focus, saving, stale-data, and error states have
  distinct visible treatments. Existing selected-drawing anchor handles
  remain rendered as high-contrast white canvas squares.
- The statistics heading now uses the brief's exact `持仓统计` label, making it
  present in the server-rendered unified shell.
- README now documents shared imported/demo replay, drawings, statistics, and
  notes; real `15m` caching when providers cover the interval; real-`15m`
  derived `1H`/`4H`; daily-derived `1W`; disabled unavailable periods with a
  reason; older intraday provider limitations; local-only settings, drawings,
  cursors, and reviews; and the explicit exclusion of “模式洞察”.

## RED / GREEN evidence

The responsive and rendered assertions were added before the stylesheet and
label changes.

### RED 1: narrow popover containment

```text
npm run test:unit -- app/components/trade-review-workspace.test.tsx

Test Files  1 failed (1)
Tests       1 failed | 20 passed (21)

expected left at 1059px: 9px
received:                  180px
```

This was the intended failure: the compact layout still inherited the desktop
instrument-search offset.

### GREEN 1

```text
npm run test:unit -- app/components/trade-review-workspace.test.tsx

Test Files  1 passed (1)
Tests       21 passed (21)
```

### RED 2: exact desktop/drawer edge

The breakpoint assertions were then tightened to the brief's exact threshold.

```text
npm run test:unit -- app/components/trade-review-workspace.test.tsx

Test Files  1 failed (1)
Tests       1 failed | 20 passed (21)

expected workspace at 1260px:
  244px minmax(620px, 1fr) 290px
received:
  220px minmax(600px, 1fr)
```

This exposed the prior inclusive `max-width: 1260px` off-by-one. The same
contract was applied at the `1060px` sidebar boundary.

### GREEN 2

```text
npm run test:unit -- app/components/trade-review-workspace.test.tsx

Test Files  1 passed (1)
Tests       21 passed (21)
```

The final test exercises the real workspace drawer: the trigger opens the
modal dialog, Escape removes it, restores the desktop panel state, and returns
focus to the trigger. It also parses the production stylesheet with PostCSS to
verify the responsive cascade rather than duplicating breakpoint constants in
a test-only stylesheet.

The rendered smoke test was expanded to require the unified workspace,
`持仓统计`, and `图表工具栏`. During the first complete `npm test`, it also
exposed the stale pre-unified expectation `未来信息已锁定`; the current unified
shell truthfully renders `游标之后的数据未加载`, so the smoke assertion was
updated to that live wording. The final rendered run passes.

## Final automated verification

Every requested command was run separately against the final implementation
state and its complete output was inspected.

```text
npm run test:unit

Test Files  55 passed (55)
Tests       272 passed (272)
exit 0
```

Vitest emitted Node's dependency/tooling warning:
`[DEP0205] module.register() is deprecated`.

```text
npm run typecheck

> tsc --noEmit
exit 0
```

```text
npm run lint

> eslint . --ignore-pattern dist --ignore-pattern .next
exit 0
```

```text
npm run build

vinext build (Vite 8.0.13)
client references: 149 modules
server references: 179 modules
rsc environment: 155 modules
client environment: 1884 modules
ssr environment: 185 modules
Build complete.
exit 0
```

The build emitted the same Node `[DEP0205]` warning and Vite's existing
`Some chunks are larger than 500 kB after minification` advisory. There were
no build errors.

```text
npm test

Build complete.
server-renders the historical trade review workspace: pass
client bundle contains no unrevealed demo executions: pass
tests 2, pass 2, fail 0
exit 0
```

The nested build emitted the same dependency deprecation and chunk-size
advisories.

```text
git diff --check

exit 0
```

## Development server and browser checklist

`npm run dev` started at `http://localhost:3000/`. A live request returned:

```text
status=200 content_type=text/html; charset=utf-8
GET / 200
```

The development server was stopped with Ctrl-C after the check.

Interactive inspection could not be performed: the browser-control runtime
reported `No browser is available`, and its one allowed availability check
returned an empty browser list. Therefore no visual/manual pass is claimed
for:

- seeded imported instruments with intraday or daily-only caches;
- replay controls and knowledge-boundary preservation;
- search, data details, layers, fullscreen, or settings interactions;
- drawing creation, movement, visibility, locking, history, or reload;
- cursor-driven MFE/MAE/drawdown/giveback;
- note autosave;
- the visually rendered drawer at compact widths;
- the browser console.

The available local server data also contained only the server-rendered demo
on a fresh request, so imported-instrument scenarios could not have been
verified without creating data that the brief did not supply.

Server startup emitted:

```text
[DEP0205] module.register() is deprecated
Unable to fetch the Request.cf object! Falling back to a default placeholder
Error: unable to get local issuer certificate
```

Despite these development-tool/network diagnostics, the application served
the page with HTTP 200. Because no browser backend was connected, application
browser-console errors or warnings remain unverified rather than assumed
clean.

## Files

Implementation commit files:

- `app/globals.css`
- `README.md`
- `tests/rendered-html.test.mjs`
- `app/components/trade-review-workspace.test.tsx`
- `app/components/review/position-stats-panel.tsx`

The statistics panel is the only adjacent file beyond the four named Task 11
files. Its one-word heading correction was essential to satisfy the brief's
exact server-rendered `持仓统计` requirement; no behavior or architecture was
changed.

Report:

- `.superpowers/sdd/2026-07-30-unified-replay-chart-tools-stats/task-11-report.md`

## Commit

Implementation commit:
`d0b2249c21f91873abb87d4b76dad832a3c214ae`
(`docs: describe unified replay capabilities`).

## Concerns

- The Task 11 interactive browser checklist and browser-console inspection
  remain unverified because this session exposed no controllable browser.
- The build's existing large-chunk advisory is unchanged and outside this
  responsive/documentation task.
- The development server's local-certificate diagnostic prevented a clean
  warning-free startup log, although the page still served successfully.

---

## Fix round 1

### Scope

The first Task 11 review identified two responsive invariants and two related
maintenance issues. Commit `a2b2b4debde5dcfa7abf5a96c4ab7e06db0f454c`
addresses all four without changing replay or storage architecture.

1. `ReviewSidePanel` now observes `(min-width: 1260px)`. If a compact drawer
   is open when the query becomes true, it requests the controlled drawer
   state to close. The persistent aside returns to desktop classes without
   dialog/`aria-modal` semantics or a backdrop.
2. The desktop transition focuses the selected panel tab after the modal
   focus hook restores its prior target, avoiding focus on the drawer trigger
   that CSS has just hidden. The media-query listener is removed on cleanup.
3. Below `1060px`, `.trade-review-app` now has `min-width: 0`. Below `760px`,
   the heading and chart toolbar wrap, header/footer controls remain locally
   scrollable, and all `.chart-popover` variants use viewport-fixed `12px`
   left/right bounds, an automatic width, a viewport-derived maximum height,
   and internal vertical scrolling.
4. The test's direct PostCSS import is now backed by an explicit exact
   `postcss: 8.5.23` dev dependency in both `package.json` and the root
   package-lock entry. `npm ls postcss --depth=0` reports
   `postcss@8.5.23 overridden`.
5. The identical icon-button and timeframe-button transition declarations
   were combined into one selector block. The drawer/tab transitions differ
   in properties and remain separate.

### RED / GREEN evidence

#### RED 1: drawer remains modal after live resize

The component regression represents a `1259px` viewport with
`(min-width: 1260px)` initially false, opens the real controlled drawer, then
dispatches the query crossing to true.

```text
npm run test:unit -- app/components/review/review-side-panel.test.tsx

Test Files  1 failed (1)
Tests       1 failed | 3 passed (4)

Expected no dialog after the query crossed to desktop.
Received the existing review-side-panel-drawer with role="dialog" and
aria-modal="true".
```

After the component fix, the same test verifies that the dialog and backdrop
are gone, the desktop aside has no modal semantics, the selected `路径统计`
tab owns focus, and query changes after unmount do not invoke the controlled
callback.

```text
npm run test:unit -- app/components/review/review-side-panel.test.tsx

Test Files  1 passed (1)
Tests       4 passed (4)
```

#### RED 2: 390px viewport inherits the 760px minimum

```text
npm run test:unit -- app/components/trade-review-workspace.test.tsx

Test Files  1 failed (1)
Tests       1 failed | 21 passed (22)

expected .trade-review-app min-width at 390px: 0
received:                                    760px
```

After the CSS fix, the 390px assertions verify the zero application minimum,
wrapping toolbar, and the full generic/search popover cascade in source order.
The existing exact `1059`/`1060` and `1259`/`1260` assertions remain in the
same passing suite.

```text
npm run test:unit -- app/components/trade-review-workspace.test.tsx

Test Files  1 passed (1)
Tests       22 passed (22)
```

After dependency and transition cleanup, both focused suites were rerun:

```text
npm run test:unit -- app/components/review/review-side-panel.test.tsx app/components/trade-review-workspace.test.tsx

Test Files  2 passed (2)
Tests       26 passed (26)
```

### Final automated verification

Every required command was run separately after the final source change and
its complete output was inspected.

```text
npm run test:unit

Test Files  55 passed (55)
Tests       274 passed (274)
exit 0
```

Vitest emitted the existing Node `[DEP0205] module.register() is deprecated`
dependency/tooling warning.

```text
npm run typecheck

> tsc --noEmit
exit 0
```

```text
npm run lint

> eslint . --ignore-pattern dist --ignore-pattern .next
exit 0, no findings
```

An earlier lint run exposed one new `react-hooks/exhaustive-deps` warning for
effect fields accessed through `props`. The component now destructures the
two controlled drawer fields, and the final lint output above is clean.

```text
npm run build

vinext build (Vite 8.0.13)
client references: 149 modules
server references: 179 modules
rsc environment: 155 modules
client environment: 1884 modules
ssr environment: 185 modules
Build complete.
exit 0
```

The build emitted the existing Node `[DEP0205]` warning and Vite's existing
large-chunk advisory; it reported no build errors.

```text
npm test

Build complete.
server-renders the historical trade review workspace: pass
client bundle contains no unrevealed demo executions: pass
tests 2, pass 2, fail 0
exit 0
```

```text
git diff --check

exit 0
```

### Development server

`npm run dev` again started at `http://localhost:3000/`. The live request
returned:

```text
status=200 content_type=text/html; charset=utf-8
GET / 200
```

The server was stopped with Ctrl-C. Startup again emitted the existing
`[DEP0205]`, `Request.cf` fallback, and local issuer certificate diagnostics.
The browser-control backend remains unavailable from the original Task 11
inspection, so no new visual or browser-console pass is claimed.

### Files and commit

Implementation files:

- `app/components/review/review-side-panel.tsx`
- `app/components/review/review-side-panel.test.tsx`
- `app/components/trade-review-workspace.test.tsx`
- `app/globals.css`
- `package.json`
- `package-lock.json`

Implementation commit:
`a2b2b4debde5dcfa7abf5a96c4ab7e06db0f454c`
(`fix: harden responsive review layout`).
