# V2.1 journey revision report

Status: `implementation-ready` for the journey-worker scope. This report records generated design artifacts only; it does not claim that the runtime homepage implements or passes these journeys.

## Scope

Owned files are `build-journey-revision.py`, `images/journey-*.svg`, `journey-contract.md`, and this report. The original V2 generators, V2.1 shared visual-design files, atom worker files, product code, database, and browser state were not changed.

实现前已读取 `PLAN.md`、`DESIGN-COVERAGE.md`、V2 原始 `visual-design.md` 的 HP02–HP06 章节，以及 F02、F03、F04、F05、F06、F08、F09 原始问题。分镜遵循 PLAN 共同选择；其中 F08 明确：选择候选只打开标的详情，不改变首页全局已提交 scope。

## Generated journey sheets

| Requirement | Artifact | Coverage |
|---|---|---|
| F02 contribution before/during/after, expand/reverse/collapse/focus | `images/journey-contribution.svg` | Four large frames; 32px rows, 200ms, reduced-motion 0ms, retained viewport and keyboard focus labels |
| F03 library market handoff | `images/journey-library.svg` | Direct URL, refresh, browser return, invalid market fallback with explicit URL fields |
| F04 scope A/B/C race | `images/journey-scope.svg` | Committed A, draft B, C superseding B, late-response ignore, atomic fail/retry/success |
| F05 gap reason | `images/journey-gap.svg` | Default gap, hover/focus popover, keyboard close and returned focus |
| F06 history | `images/journey-history.svg` | Year, empty year, zero pending review, market sync, historical contribution entry and return |
| F08 search/detail | `images/journey-search.svg` | Open, clear, miss, candidate detail, Esc/× close, focus trap and return target |
| F09 dates | `images/journey-date.svg` | Quick picks, draft/apply, success/fail/retry, non-endpoint 10-14 tooltip example |

共享合同和图片嵌入见 [`journey-contract.md`](../../docs/design-system/baselines/2026-10-17-homepage-v2.1/journey-contract.md)。

## Checks performed

- `python3 docs/design-system/baselines/2026-10-17-homepage-v2.1/build-journey-revision.py` completed successfully and regenerated all seven SVGs.
- All seven outputs parse as one SVG document and include visible frame titles and state labels; the SVGs retain large viewBoxes rather than shrinking states into text-only cards.
- The generator's outputs were inspected for the required state strings, URL schema, timing values, scope generations, F08 detail semantics, F09 middle-date values, and explicit F05/F08 keyboard exits.
- 运行时浏览器、数据库和产品控件验收由本 worker 标记为 `NOT VERIFIED`，仍由协调者和独立审查者负责。

## Known acceptance boundary

These artifacts describe the approved design contract and are suitable for independent visual review. They do not prove actual URL navigation, scroll retention, focus behavior, request cancellation, persistence, or chart rendering in the product.
