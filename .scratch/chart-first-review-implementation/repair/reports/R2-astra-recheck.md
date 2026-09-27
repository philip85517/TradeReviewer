# R2 Text 返修独立复审

2026-09-26，Astra scoped review。**结论：R2-1 / R2-2 已修复；R2-3 部分修复，仍不能接受整个 R2。** 未改产品、未操作浏览器、未跑全量；真实视觉由 root 验收。本报告保留初轮报告的历史结论。

## 依据与独立验证

已读当前 AGENTS、development-workflow/task-decomposition、主规格 US8–12 与 §2、元素规范 E03/E08/字体/长文；实际 view_image 查看 `docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png` 与 `05-final-review.png`。读初轮 `R2-astra-review.md`、最新 `R2-text.md` 及实际 drawing-canvas/text-geometry/canonical-chart-capture/replay-chart consumer/drawing-toolbar。

独立运行：

```text
npx vitest run app/lib/chart/text-geometry.test.ts app/components/chart/canonical-chart-capture.test.ts app/components/chart/drawing-canvas.recall-review.test.tsx app/components/chart/replay-chart.recall-review.test.tsx app/components/chart/drawing-toolbar.test.tsx
5 files / 46 tests passed (6.95s)
```

另用 TypeScript transpile 实际 text-geometry 模块并 Node 执行：四行中文新卡 compact → expanded → compact 返回行数 2 → 4 → 2、高度 68 → 110 → 68；60 行长文在 640×200 plot、maxHeight192 下返回7行/173px/truncated=true，卡底196，不超plot。该证据独立于 worker 的97pass声明。

## 已解除问题

- **R2-1 pass（代码/定向测试）**：live painter、hit geometry、capture painter/warnings 均使用 `!hasCardPosition || expanded`；新卡不再恒展开，legacy 无坐标默认全文。DrawingCanvas handle 提供当前 Set 副本；ReplayChart 在 flushSync(commitText) 后、首个 await 前取 getExpandedTextIds 写入实际 CanonicalCaptureScene；capture consumer 转 Set 交给共享 painter。单独 helper 与最终 consumer 均已核对。
- **R2-2 pass（代码/定向测试）**：legacy defaults 直接保留原 canvasX/Y，commit 条件加入坐标并删除不完整字段，不再自动写 .08/.12。color 来自 drawing.style.color 并原样合并；id/revision/owner、字号/宽度/背景保留。raw editor.value 不 trim、不摘要化保存。显式切换位置语义才新增坐标。
- **R2-3 partial**：CJK 双侧4px padding和右侧18px编号区进入预算；长卡最大行数及底部控制区已参与高度计算。新文14px、#e7edf6正文、蓝辅助；legacy自选颜色保留。真实字体宽度与匹配参考图视觉仍未验。
- toolbar 所有13种旧工具仍存在一次，compact优先工具与More互补；撤销/重做/锁定/清空已从More重复项移除，现仅各一次。响应式36/44px实际命中由root/R3验证。
- ReplayChart本轮capture接线未增加async边界，也未更改已存在的flushSync→viewport/scene freeze→fonts await顺序；本次定向replay-chart套件通过。该有限审查不替代R1真实回放/resize时序验收。

## 仍需处理

### R2-3a · P2 · 编辑器只钳 shell，真实 textarea 最小宽度仍可能越界

`drawing-canvas.tsx:559–569,1210–1218,1336` 允许编辑宽度最小36；shell按该宽度钳到plot右边。实际 textarea 仅设置width100%，没有覆盖 `app/globals.css:1283` 的 `min-width:120px`。例如plot640、右边缘、textWidth36：shell left602/width36，但textarea最少120，子控件无法按36收缩。overflowY:auto可能将其变为shell横向滚动/裁切，而不是使实际输入布局满足宽度；它不能证明编辑器可用且避轴。需为真实子控件建立可用最小宽度与相应shell边界，或正确收缩子控件，并在真实浏览器测rect/scrollWidth及可操作性。现有edge测试只看shell inline left+width，完全漏掉子控件。

### R2-3b · P2 · 底边仅假定112px，实际可变高度未参与约束

同处 `textEditorFrame` 用固定112px计算top，shell却用 `maxHeight: size.height - 4`，没有扣除top。字号32、style bar换行、自由定位按钮、窄宽等均能使真实高度超过112；靠底时容许的shell高度会超过plot剩余高度。需按剩余空间约束maxHeight或测量实际高度后定位。当前测试100px plot只断言top>=2/maxHeight<=96，未断言bottom，不能关闭此项。已通知root在右下角180px/32px及36px宽场景实测；真实结果可补充证据，但当前代码未保证边界。

### E08控制尺寸 · P2 · 新展开/收起控制低于规格

`drawing-canvas.tsx:1181–1192` 写死fontSize10、minHeight18、minWidth28；规范辅助最低12px、桌面按钮至少36、触屏命中至少44。该新增控件没有独立扩大命中区（当前仓库无 `.drawing-text-card-control` CSS覆盖）。不能用主toolbar达标替代卡片控制达标。需遵守同一规格并重验正文/控制区间距。

## 未验证范围

真实浏览器：新增Text→展开→收起→编辑→保存capture→重开；中文IME期间暂停/不推进；legacy编辑无跳位；右底editor与32px/窄宽；1440/1280/390及参考图同状态对照。根本数据原文保存路径经源码核对，但跨阶段旧快照独立仍由root/R4端到端验证。上述未验证项不写视觉通过或feature accepted。
