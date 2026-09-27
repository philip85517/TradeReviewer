# R5 chart pane-boundary repair (2026-09-26)

本批产品冻结了 chart 内同一 pane boundary 权威的四个可观察反例，并补查了新 Text 卡片。实现保持完整 canvas 尺寸、归一化 `canvasX/canvasY`、时间/价格 anchors、存储 desired `textWidth`、历史 legacy anchored Text 语义和 capture 像素构图；真实 plot bounds 只约束新位置卡片的屏幕几何、编辑器控件和 marker 文本避让。

## 原始反例

- `R5-text-edge-editor-1440.png`：1440 桌面右下点击 Text，字号 32px、保存宽 36px、三行中文时，旧编辑器右界 1423 越过实际绘图区右界 1341，覆盖价格轴；shell 的垂直滚动还会把样式栏滚出可见区。
- `R5-stored-manual-window.png`：999992 手动价格窗口的 retained capture 中，最右“卖出”仍向右绘入价格轴；对应 `R5-manual-price-after.png` 的 live marker 已能向左放置。capture consumer 没把实际 plot width 传给共享 painter。
- `R5-low-price-after.png`：999990 低价首买的菱形可见，但“买入”右置文本与黄色成本 30 标签相交，右字符被压住。仅限制价格轴边界不足以避开向 plot 内伸出的价格标签。
- `R5-storyboard-1440.png`：新位置长 Text 卡片在压缩图右侧进入价格标签区；旧 legacy anchored 卡仍按无 `canvasX/canvasY` 的兼容路径绘制。

## 最小实现

- `ReplayChart` 通过 `chart.timeScale().width()` 与 `chart.panes()[0].getHeight()` 形成 `plotBounds`，随 chart resize/coordinate version 更新，再传给 `DrawingCanvas`。完整 canvas 仍按原 `chartSizeRef` 尺寸创建。
- `DrawingCanvas` 用 `plotBounds` 约束带归一化位置的新 Text 卡片、44px 展开控件和 editor frame；存储坐标不被改写。编辑器 shell 保留样式栏、可用 textarea 和 12px hint，textarea 自身滚动；shell 高度取紧凑的首选编辑高度与剩余 pane 高度的较小值，空间不足时 frame 向上收紧。旧无归一化坐标的 anchored Text 继续沿用兼容几何。
- capture projection 以实际 time scale plot width（并按 DPR 还原）和 pane height 绘制 Text；capture marker painter 现在收到真实 `maxX`。
- live/capture 共享 marker painter 使用 `markerRightLabelBoundary(plotWidth, priceScale.width())` 保留价格标签伸入 plot 的右侧区域，必要时把 action text 左置；diamond 仍使用原 time/price anchor，只对 lane offset 后的显示 x 做既有 plot clamp。

## TDD 与验证

先加入观察性回归并运行：

```text
npx vitest run app/components/chart/drawing-canvas.recall-review.test.tsx app/components/chart/replay-chart.recall-review.test.tsx app/components/chart/canonical-chart-capture.test.ts --maxWorkers=1
```

红灯结果：3 个文件中 4 个新增边界断言失败（editor plot bounds、Text card control bounds、ReplayChart bounds 传递、capture marker plot boundary）；原有 40 项通过。

修复后同一命令：**3 files / 45 tests passed**。再加同模块既有覆盖：

```text
npx vitest run app/components/chart/drawing-canvas.test.tsx app/components/chart/replay-chart.test.tsx app/components/chart/drawing-canvas.recall-review.test.tsx app/components/chart/replay-chart.recall-review.test.tsx app/components/chart/canonical-chart-capture.test.ts --maxWorkers=1
```

结果：**5 files / 91 tests passed**。随后针对中上部点击时 editor shell 误用 `maxHeight` 撑满 pane 的回归先红（`height === maxHeight`），改为首选高度与剩余空间取小值后，定向回归为 **5 files / 92 tests passed**。定向 ESLint（7 个 chart source/test 文件）和 `git diff --check` 通过。

`npx tsc --noEmit --pretty false` 已运行；本批 chart 文件没有类型诊断，命令仍被当前 workspace WIP 的两个既有错误阻断：`app/components/recall/recall-workspace.tsx:2368`、`:2374` 的 `RecallDocument.working.phase` 推断为 `string`。

本批未运行浏览器、数据库写入或全量测试。root 负责真实 1440/1280/390 截图与最终 build/整体验收；本报告的定向测试通过不替代该验收。
