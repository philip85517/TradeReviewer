# 真实浏览器矩阵 · 2026-10-11

## 环境

- Worktree: `/Users/zhoulin/.codex/worktrees/f922/TradeReview`
- Branch: `codex/strategy-visual-implementation-20261011`
- Base commit before this slice: `a09c21ccc90f9a21c707a0bc91af3b2259c4aaeb`
- Service: `npm run dev -- --hostname 127.0.0.1 --port 3070`
- Route: [推荐复盘样板](http://127.0.0.1:3070/?prototype=review-design&mode=recommended)
- Browser: Codex In-app Browser, fresh visible tab, device scale factor 1
- Data: read-only fixture route; no business database write
- Checked: 2026-10-11 01:15–01:18 Asia/Shanghai

## Layout and scrolling

| Viewport | Before symptom | Current computed evidence | Visual check |
| --- | --- | --- | --- |
| 1440×900 | page fits; body was locked by native shell | `overflow-y:auto`, document `scrollHeight=900`, chart `832×698` at `(260,138)`, plan `320×698` at `(1106,138)` | chart, drawing toolbar, Chinese annotations, plan sidebar and replay footer remain in one desktop frame |
| 1280×800 | `overflow:hidden`, document content `~1500px`, lower plan unreachable | `overflow-y:auto`, `overflow-x:hidden`, `scrollHeight=1500`, root height `1500.59`; programmatic page scroll reached `scrollY=600` | screenshot after scroll shows lower chart edge and full plan fields; no horizontal page movement |
| 390×844 | narrow flow already existed but inherited global lock | `overflow-y:auto`, `scrollHeight=2006`, chart shell `374×889`, chart stage `328×720`, plan `374×534` | top screenshot keeps stage/cutoff, price roles, chart and long text reachable by page scroll |

The 1280 screenshot before the fix stopped at the chart/upper half because the
global `body { overflow:hidden }` rule won while the prototype's natural flow
was taller than the viewport. The fix is scoped to `body:has(.recall-design-prototype)`;
native workspaces keep their existing scroll ownership.

## State visuals

- Stage selected: `持仓过程`, `aria-pressed="true"`, background
  `rgba(47, 128, 237, 0.16)`, border `rgb(47, 128, 237)`, text
  `rgb(195, 219, 255)`, hit height `44px` at 390px.
- Drawing tool selected: `文字标注`, `aria-pressed="true"`, background
  `rgb(33, 50, 73)`, white border/text, `36×36px` at desktop. The same frame
  visibly contains the two multiline Chinese annotation overlays and plan
  markers.
- Keyboard focus: after keyboard navigation to `播放`, computed focus ring was
  `rgb(140, 189, 255) solid 2px`, `outline-offset: 2px`; mouse-only focus was
  intentionally not counted as the keyboard-focus result.
- At S1 the adjacent status reads the market cutoff, execution cutoff and
  `复盘补记`; the chart visibly contains the newly revealed candle and entry
  marker after `下一根 K 线`.
- Clicking `重新读取本地样板` restored the S1 stage/cutoff status and the two
  accessible `收起文字 prototype-*` annotation controls. This is evidence for
  the prototype's browser-local round trip only; it does not close the SQL
  persistence gate.

## Limits

This matrix does not claim a physical touch screen, soft keyboard/IME, export
font rendering, SQL save/reopen, or the entire strategy Workbench scene matrix.
Those remain `NOT VERIFIED` in the implementation coverage.
