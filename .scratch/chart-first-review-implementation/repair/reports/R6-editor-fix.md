# R6 Text editor height and style controls

日期：2026-09-26 22:15。负责人：Luna 5.6 max（drawing-canvas owner）。集成负责人：root。

## Scope and approved references

本轮只收口 E08 的实际右下编辑器反例：

- 规格：[chart-first-review-ui.md](../../../../docs/specs/2026-09-25-chart-first-review-ui.md)；[E01–E22 元素规范](../../../../docs/specs/2026-09-25-chart-first-review-ui-elements.md)。
- 画板：[02-chart-workspace.png](../../../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png)；[07-interaction-states.png](../../../../docs/designs/2026-09-25-chart-first-review/07-interaction-states.png)。
- 回归来源：[R5-text-editor-fix.md](R5-text-editor-fix.md)；实际失败图 [R5-editor-116px-height.png](R5-editor-116px-height.png)。
- 覆盖矩阵：[`DESIGN-COVERAGE.md`](../../DESIGN-COVERAGE.md) 的 E08 行。

允许写入范围为 `app/components/chart/drawing-canvas.tsx` 与其已有测试；本轮未修改 `text-geometry.ts` 或其测试，也未修改其他 owner 的文件。

## Root cause

旧编辑器把 shell 高度固定为 116px。右下真实页面中样式栏实际约 42px，提示文字因未禁止换行占约 36px，32px textarea 最终只有约 34px/client 32px，因此中文只显示半行。样式控件默认可 shrink，窄 shell 中“自由/背景”等文字会竖排；编辑器 frame 只按真实 plot bounds 做边界限制，但没有按字号和内容行数给文本区预留高度。

## Implementation frozen

- 编辑器按字号计算 `lineHeight = max(18px, round(fontSize × 1.5))`，textarea 至少保留一整行和 8px 的边框/内边距；可用空间按内容最多预留三行，超出由 textarea 自身 `overflowY: auto` 滚动。
- 仍以实际 plot bounds 计算 `maxTop`，从底部向上收紧；shell 的实际 `height` 仍为 `min(preferredHeight, maxHeight)`，不再用剩余 pane 高度把普通上部编辑器撑满。
- 样式栏桌面高度为 36px；`(pointer: coarse)` 触屏高度为 44px。直接控件 `flex-shrink: 0`、`white-space: nowrap`，样式栏 `overflow-x: auto`，不会把“自由/背景”压成竖排。
- hint 固定 12px、18px 行高并单行显示。编辑器外壳宽度继续是独立的可操作宽度；保存时使用 editor 中原有的 desired `textWidth`，例如 36px 不会被 220px 编辑器 shell 宽度改写。
- 归一化 `canvasX/canvasY`、legacy anchored Text 的缺省坐标、完整 canvas 尺寸和真实 plot 边界语义保持不变。

## TDD evidence

先运行已有基线：`drawing-canvas.recall-review.test.tsx` 与 `drawing-canvas.test.tsx` 为 **2 files / 41 tests passed**。

加入本轮两个行为测试后先运行观察红灯：**18 tests，16 passed / 2 failed**，失败分别为 32px 编辑器仍为 116px、触屏样式栏没有 44px 目标。失败原因与真实截图一致，不是测试配置错误。

最小修复后：

```text
PATH=/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
npx vitest run app/components/chart/drawing-canvas.recall-review.test.tsx \
  app/components/chart/drawing-canvas.test.tsx \
  app/lib/chart/text-geometry.test.ts --maxWorkers=1
```

结果：**3 files / 47 tests passed**。

新增断言覆盖：1440px plot 中 32px/36px desired width 的三行中文、48px line height、56px 最小 textarea 高度、至少三行首选空间、上边界收紧、textarea 自滚、hint 尺寸、样式栏横滚/控件不可 shrink、36px 桌面和 44px coarse pointer 目标，以及 commit 后仍保存 `textWidth: 36`。

其他检查：

- `npx tsc --noEmit --pretty false`：通过。
- `npx eslint app/components/chart/drawing-canvas.tsx app/components/chart/drawing-canvas.recall-review.test.tsx app/components/chart/drawing-canvas.test.tsx`：通过，0 错误。
- `git diff --check`：通过。

本轮按任务要求未运行 full suite、build、浏览器或数据库写入。root 需在产品其他 R6 patch 一起冻结后，统一执行一次 build 与真实 1440/1280/390（含导航展开）复验；真机软件键盘仍按总验收记录为 unverified。

## Freeze status

R6 editor scope 已 `implementation-ready`，可交给 Astra 做独立 review。该状态只冻结本组件的实现与定向证据，不替代 root 对 More、completion bridge、PPTX 和整体验收的结论；E08 的真实浏览器截图仍由 root/Astra 在最终 build 中确认。

## R6 readability follow-up

root 的新 build 已确认原几何预算：1440 截图 [R6-editor-edge-fixed-1440.png](R6-editor-edge-fixed-1440.png) 中 shell 为 220×210，右界 1339 小于 plot 右界 1341；32px textarea 为 152px、client 150px、line-height 48px，三行预算成立。390 截图 [R6-editor-390.png](R6-editor-390.png) 中 shell 为 x75–295、top232、height188，textarea client128px，窄屏边界成立。

该复验又发现 stylebar 透明，OHLC/计划文字会穿透，且 ReplayChart 的计划价格按钮 z8 会盖过 textarea。最小 follow-up 仍只修改 `drawing-canvas.tsx` 及其测试：

- 编辑器打开时把 drawing-canvas stacking context 临时提到 z9，shell 提到 z10，压过 chart-stage 内 z8 计划价格按钮；没有触碰 `ReplayChart`。
- shell 使用 `var(--surface-elevated)` 不透明背景、6px 圆角和不改变布局尺寸的 `var(--line-soft)` 外圈；stylebar 使用 `var(--surface)`、4px 圆角和 inset 线框。
- button/select/number 控件使用现有 `--text`、`--surface`、`--line-soft`；color input 使用同一 surface、4px 圆角与暗色外圈，避免浅色原生控件突兀。

follow-up 定向行为测试为 **18 tests passed**；定向 ESLint、`tsc --noEmit --pretty false` 和 `git diff --check` 均通过。未运行 full suite、build 或数据库写入；样式 follow-up 的最终截图仍由 root/Astra 在统一 build 后复验。
