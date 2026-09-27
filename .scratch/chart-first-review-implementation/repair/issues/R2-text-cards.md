# R2 — 图上长文收成短卡，仍可编辑和导出全文

ID: chart-first-repair-R2
State: open
Status: integration-pending
Assignee: luna_replay_chart (gpt-5.6-luna / max)
集成负责人: root；独立验收 Astra Light

2026-09-27 R7 当前状态：此前右下编辑器遮轴与样式条滚出已由R6-editor-filled-1440/390真实截图关闭，Astra独立打开；32px正文、220px宽shell与价格轴分離。R5折叠/拖动/留存及R6真实PPTX冻结A证据可复用。旧fail保留为历史；真机IME相关范围仍不冒称通过。 证据：[R7覆盖审计](../reports/R7-coverage-audit.md)、[R7证据定位](../reports/R7-evidence-gaps.md)、[R6集成](../reports/R6-integration.md)。此前段落为历史。

## Scope / What to build

完善 E03/E08：编号、时间价格锚点连线、自由拖移、长文摘要/展开；完整原文、用户样式、历史独立及捕获导出保持正确。不改主题、不另建笔记表单。

## Refs

[覆盖矩阵](../../DESIGN-COVERAGE.md) · [设计07](../../../../docs/designs/2026-09-25-chart-first-review/07-interaction-states.png) · [设计02](../../../../docs/designs/2026-09-25-chart-first-review/02-chart-workspace.png) · 主规格§2/3与元素E08。

## Blocked by

- [R1 首次集成门槛](R1-core-gate.md)（closed / accepted）；R1整票扩展验收后续集成。

## 验收标准与反例

- [ ] T→点击→中文多行→完成：短卡可折叠展开，编号细连线指向原时间价格，原文可编辑。
- [ ] 画布锚定和时间价格锚定可拖移；图文不遮价格轴，长中文不挤满主图。
- [ ] 编辑/IME不推进，14px默认及既有样式保留；旧快照不随新编辑改变。
- [ ] 实际 Canvas 字号与文档值一致：当前 drawing-canvas.tsx 把 `var(--font-geist-sans)` 写入 `context.font`，需验证浏览器是否接受而非回退默认小字号；不能仅断言输入选择器值为14px。新真实图 R1-pre-entry-plan-text-1440.png 的蓝色正文偏小，须检查字体解析、对比度和卡片样式，保留历史用户样式。
- [ ] 保存重开、屏幕截图和PPTX保留正确图形与可读取全文；缺字段旧图兼容。
- [ ] 自动化与真实浏览器/视觉分别有证据，经Astra逐项验收。

## 派发说明与证据

绘图/几何/绘图模型及canonical capture单一owner，与R1结束后交接。root记录允许文件清单。报告 `../reports/R2-text.md`，初始 unverified。

2026-09-26 19:29：实现已冻结；worker 75项定向测试通过，root 独立受影响子集24项通过，见 [协调者日志](../reports/R2-coordinator-tests.txt)。Astra正在独立审查；真实浏览器、留存与导出仍未验证，保持open。

19:34追加：Astra独立发现展开状态、legacy编辑跳位、边界几何三类失败，已交回原owner；见 [R2独立报告](../reports/R2-astra-review.md)。原通过测试不能覆盖新反例。

续验追加：新卡折叠/展开、拖动与保存图已局部验证。实际右下编辑字号32、宽度36时，220px编辑器仍遮盖价格轴，样式栏在小高度shell内被滚出；见 [R5续验](../reports/R5-continuation.md)。保持 acceptance-failed，需真实 plot bounds 和受影响浏览器复验。
