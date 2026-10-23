# Automated manual and manifest anchor verification

Source manual: `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html`; source manifest: `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/boards-index.json`. The script checked each component anchor by exact HTML id and each mapped manifest frame by exact frame id/path.

| Result | Component | Manual anchor | Manifest frame | Manifest states |
|---|---|---|---|---|
| PASS | IconButton | component-manual.html#图标按钮iconbutton | manifest atom-iconbutton (images/atom-iconbutton.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | SegmentedTabs | component-manual.html#分段标签segmentedtabs | manifest atom-segmentedtabs (images/atom-segmentedtabs.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | Select | component-manual.html#账户选择器select | manifest atom-select (images/atom-select.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | Popover | component-manual.html#搜索浮层popover | manifest atom-popover (images/atom-popover.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | FilterPopover | component-manual.html#筛选浮层filterpopover | manifest filter (images/filter.svg) | manifest states: normal |
| PASS | Token | component-manual.html#筛选条件标签token | manifest atom-token (images/atom-token.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | Metric | component-manual.html#指标卡metric | manifest atom-metric (images/atom-metric.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | StatusBadge | component-manual.html#状态徽章statusbadge | manifest atom-statusbadge (images/atom-statusbadge.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | DataTable | component-manual.html#持仓数据表datatable | manifest atom-datatable (images/atom-datatable.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | ChartTooltip | component-manual.html#图表点提示charttooltip | manifest atom-charttooltip (images/atom-charttooltip.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | EmptyState | component-manual.html#空结果状态emptystate | manifest atom-emptystate (images/atom-emptystate.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |
| PASS | RetryAction | component-manual.html#重试动作retryaction | manifest atom-retryaction (images/atom-retryaction.svg) | manifest states: default, hover, focus, pressed, disabled, loading, empty, error |

All 12 component anchors and manifest frames must remain PASS before implementation. State-level location is the manifest frame state label; the actual state names are retained in the table rather than implying a single generic screenshot.
