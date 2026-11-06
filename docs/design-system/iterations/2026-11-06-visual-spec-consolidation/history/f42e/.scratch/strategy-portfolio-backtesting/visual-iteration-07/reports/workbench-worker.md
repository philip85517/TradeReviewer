# Workbench visual worker report

Model: `gpt-5.6-luna`  
Effort: `medium`

## Current bounded iteration

The prototype-only frame in `workbench-design/index.html` now carries three fixed business-context fields (`当前查看日`, `已运行至`, `结果截止`) and keeps the result cutoff marker explicit across the result/compare return path. Compare chart subtitle copy is `共同截止` and remains independent from the source result cutoff. The read-only replay frame exposes the blocking reason beside the disabled playback controls, with `只读，返回观察后推进` and an explicit `返回观察` action.

The implementation preserves the existing Lightweight Charts series/generator, cutoff calculations, effective limit, compare cutoff, viewport restoration, and in-memory state engine. The custom long-name trigger, event-detail close wording, and conditional detail scroll cue are present in the same prototype file.

After the compare-frame gate was accepted, the bounded DR05/DR08 follow-up added the in-memory `运行配置 → 策略包历史 → 返回锁定配置` path, source-aware event close focus restoration, Escape focus return for the custom long-name popover, and a post-source-return scroll-cue refresh. The `已运行至` field remains the market M (`state.m`); selected failed Mi remains represented in failure/detail copy.

The final atomic-render adjustment removes the polling interval and synchronizes the context/name repair during the render path, preventing a stale first-frame identity tail after reload.

Nested Escape now returns from `策略包历史` to the same-layer locked configuration before the next Escape closes configuration and the following Escape closes event detail, preserving the event-day focus return chain.

The DR08 identity slot now measures actual rendered overflow and replaces the slot itself with a full-width, 36px-focusable truncated name button when needed. Short names retain the original non-tab-stop identity content; long-name focus/hover opens the full-name popover without moving the identity container horizontally.

The conditional scroll cue is now contained by the 320px inspection panel (`.inspect`) and remains tied to the inspection body's scroll metrics; its text is 12px.

The prototype scenario switch resets the explicit result-viewed marker, so switching from a viewed result into another demo scenario correctly returns to `尚未查看结果`.

The A workspace and replay row now apply explicit zero-width grid/flex constraints to the workspace descendants, hide the return-observe button while hidden, and preserve fixed control/button slots while allowing the reason text to ellipsize within the 44px row.

Event close and source return now capture the event id before DOM replacement, then restore focus to the matching `[data-event]` entry after rerender, falling back to the source header action when needed; source scroll restoration remains unchanged.

The retained source snapshot carries that event id through event close, so a later return restores the original event entry. The package-history mouse return path removes any duplicate restored `packageHistoryBtn` and focuses the single existing entry; the layered Escape path uses the same snapshot without appending another button.

The first viewport-only fix was disproved by a stable compare-to-event blank frame; opening configuration and triggering a second render restored the chart without changing state. The minimal lifecycle fix now updates candle/net/compare data while series remain attached, then detaches only inactive series and reattaches the active series to the right scale. This avoids the first-frame price-scale invalidation seen when two compare lines become one event net line. The source viewport remains preserved for return navigation.

## Verification run

Commands run from the repository root:

```sh
node -e 'const fs=require("fs"),s=fs.readFileSync(".scratch/strategy-portfolio-backtesting/workbench-design/index.html","utf8"),js=s.match(/<script>([\\s\\S]*?)<\\/script>/)[1];fs.writeFileSync("/tmp/tr-workbench-check.js",js)'
node --check /tmp/tr-workbench-check.js
git diff --check -- .scratch/strategy-portfolio-backtesting/workbench-design/index.html
```

These static checks passed. The real-browser compare/read-only screenshot and whole-frame visual acceptance remain **NOT VERIFIED** by this worker; the coordinator owns that browser comparison and budget gate.

## Risks / follow-up

The context marker uses an explicit `state.resultViewed` flag because `state.r === 0` is ambiguous at T0. Scenario changes reset that marker. Browser review should check the 1280px replay row for reason text fit and verify that returning from compare/event preserves the source R context while the chart header continues to show the independent C cutoff.

## Coordinator final correction (2026-10-06)

The viewport-only and series-reordering proposals above failed first-render acceptance; retained screenshots and runtime probes disprove them. The final source is `d12096e92a19cc944205a445ba366dec9634ee16a961b263bcc0827e42a8acea`. Root traced the blank event graph to the actual Lightweight Charts 5.2.0 DataLayer retaining stale mappings after same-date `setData` operations. An independent source reviewer executed that vendor DataLayer directly and reproduced the failure. See `chart-data-layer-reproduction.py` and its output.

The final prototype adapter clones input and caches complete payloads, skips identical data, and uses `series.update(item,true)` for changed values on an unchanged timeline. It uses `setData` when the timeline changes. This prevents the stale timepoint loss, preserves original ISO-date fixtures, and passes event/candle/compare changes without a delayed second render. Net/candle value updates and earlier/later ranges were independently exercised. Root directly verified the first visible event chart and actual added bars in the browser.

The 1280 replay reason now wraps two complete short phrases inside its existing44px slot; zero-min-width grid constraints prevent chart children spilling into the320px inspector. Both1299×800 and1301×800 pressure frames were recaptured. Final browser and independent visual conclusions are separately recorded; the worker report alone never signs feature acceptance.
