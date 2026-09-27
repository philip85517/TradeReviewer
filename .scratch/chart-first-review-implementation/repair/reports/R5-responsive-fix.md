# R5 responsive header CSS patch

日期：2026-09-26

状态：`implementation-ready`；等待 root 在真实 1440/1280/390 视口独立测量。

本次只修改 `app/components/recall/recall.css`，并在文件末尾追加一组冻结的 header/narrow 覆盖规则。未修改 RecallWorkspace JSX、图表、侧栏、workspace 或其他产品 CSS。

## 问题依据

当前证据 `repair/reports/R5-partial-post-390.png`（390×844）显示：

- header 首行的动作组使用 `grid-template-columns: minmax(0, 1fr) auto`，动作组的 intrinsic 宽度挤压标题列；标题发生裁切/重叠。
- 导出按钮和长动作组允许作为 flex item 收缩，中文在窄宽度下按字换行，出现“导 / 出”竖排。
- 1440 证据 `R5-post-empty-1440.png`、`R5-partial-open-1440.png` 也显示导出文字竖排；长回合选项会放大 header 的横向压力。

## 产品 patch

- 桌面 header 继续按“标题 → 图表控制 → 阶段 → 回合/必要动作”排列；chart toolbar 可让出剩余宽度，回合/动作组可横向滚动，不裁切动作文本。
- 导出、返回、数据、检查/修复及统计/导航按钮设为不可收缩的水平 flex item；导出保留至少 64px 内容宽度并明确 `white-space: nowrap` / `writing-mode: horizontal-tb`。
- 触屏/窄屏仍保留所有动作。header 首行改为两个等宽的 flexible track：左侧标题与状态，右侧动作条；动作条横向滚动而不是挤压标题或删除按钮。阶段导航占第二行，chart toolbar 占第三行。
- 桌面命中高度沿用 `--recall-frame-control-height: 36px`；窄屏覆盖为 44px。已有输入 14px、辅助文案不低于 12px 的规则未缩小，也未改 chart 220px 与 sidebar 独立滚动规则。

## 静态验证

已执行：

```text
git diff --check -- app/components/recall/recall.css
```

结果：通过。

另以 Node 做 CSS 结构检查：花括号深度为 0，并确认冻结规则包含窄屏等宽列、44px touch target、导出 nowrap/64px 最小宽度与第三行 chart toolbar。结果：通过（文件 48,684 bytes）。

本轮按任务要求未启动浏览器、未运行全量测试；1440/1280/390 实际截图、图像测量与 chart 220/sidebar 独滚验收由 root 完成。Text 右下编辑器遮挡价格轴不在本文件范围内，保留给对应 chart/canvas 修复负责人。

