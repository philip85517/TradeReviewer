# 策略台 V1.2 公共组合层

本目录是 V1.2 策略画板的公共配套页，记录 SW01–SW08 的策略组合。基础八态、颜色、字级、焦点环和默认尺寸以
[V2.5 公共控件手册](../../baselines/2026-10-22-homepage-v2.5/source/component-manual.html)为准，策略业务规则以
[V1.2 视觉设计正文](../../baselines/2026-10-24-strategy-workbench-v1.2/source/visual-design.candidate.md)为准。

打开 [`manual.html`](manual.html) 可浏览样例。SVG 画板保持小而可组合，用于说明状态契约，不替代完整产品页面；生成器复用
`source/shared-primitives.py` 的公共原子片段。

| Extension | Example | Key acceptance state |
| --- | --- | --- |
| SW01 | `sw01-navigation.svg` | 54px rail, 200px rail, 48px top bar, selected strategy |
| SW02 | `sw02-date-time.svg` | calendar action, business timezone, preserved error value |
| SW03 | `sw03-steps.svg` | current/completed/future/submit loading |
| SW04 | `sw04-package-slots.svg` | empty, selected, locked, incompatible |
| SW05 | `sw05-multi-select.svg` | two-line row, selection, disabled reason, sort boundary |
| SW06 | `sw06-summary-detail.svg` | 88px metric band, 480px detail, 320px check rail |
| SW07 | `sw07-replay.svg` | play/pause, next bar, lookback, terminal disabled |
| SW08 | `sw08-recovery.svg` | local error, retained input, retry, conflict recovery |

Static boards cannot prove browser behavior, touch hit areas, persistence, or
real replay data. Those remain integration responsibilities recorded in the
V1.2 coverage and acceptance records.
