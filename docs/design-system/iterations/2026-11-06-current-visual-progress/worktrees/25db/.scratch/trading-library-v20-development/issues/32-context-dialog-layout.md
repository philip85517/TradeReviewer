# 确认证券时各字段在桌面与窄屏清晰可用

ID: TL20-I10-CONTEXT-LAYOUT
State: open
Status: acceptance-failed
Assignee: practice_persistence_ui_sol
集成负责人: root
Owner role: UI
Priority: P1

## Scope / What to build

修复 `I10-PERSIST-UI-CONTEXT-LAYOUT-001`：交易所、六位证券代码、提示及动作在真实证券确认框有明确字段分组、间距和边界。现有字段、默认上海、六位校验、取消/Escape/焦点循环和继续到完整练习预览的行为保持合同。只改 CSS 局部样式，必要时同组件 className；不增加业务决定。发现为 round 0，第一次修复复验为 round 1，最多 5 轮。

## Refs

- [独立 Luna 的原 FAIL](../evidence/I10-practice-persistence/ui-reviewer/report.md)及 root `visual-context-{1440,1280,759,760}.png`。
- [Task31](31-practice-persistence-journey.md)局部证券确认旅程及[已冻结 UI 合同](../evidence/dispatch/practice-persistence-ui-requirements.md)。
- [业务规范](../../../docs/design-system/trading-library-design-spec.md)、[V2 正文](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)；该技术确认框没有独立批准画板，以现有 import-dialog、modal-header/file-summary/actions 的层级、颜色、间距及可读性规范为依据，不宣称最终 E 页面还原。
- `app/components/import/tradingview-context-dialog.tsx:51–85`；`app/globals.css:1575–1590` 现有 dialog 宽度/高度；[覆盖矩阵](../DESIGN-COVERAGE.md) 的 PERSIST-CONTEXT-LAYOUT 行。
- 当前 development-workflow、frontend-control-audit、task-decomposition、ui-task-templates，读取原文。

## Blocked by

None。修复现有实际入口，不依赖新领域政策。用户范围纠偏后，内部资料审计不作为本产品票的放行条件。

## 验收标准与反例

- [x] 文件名缺证券 → 确认框 → 上海/深圳选择及代码输入 → 正确完整两原行预览；取消/X/Escape 无写入。 证据：[root实际状态](../evidence/I10-context-layout/root/verification.json)与[Luna直接图像](../evidence/I10-context-layout/reviewer/report.md)。
- [x] 空值/两位代码时继续 disabled；六位有效后可继续。键盘循环、关闭和重新打开初值正确。 证据：[root实际状态](../evidence/I10-context-layout/root/verification.json)与[Luna直接图像](../evidence/I10-context-layout/reviewer/report.md)。
- [x] 1440×1000、1280×800、759×800、760×800、390×844，100% 缩放，字段/提示/动作无压叠；窄屏按空间改为单列，不缩字隐藏字段。 证据：[root实际状态](../evidence/I10-context-layout/root/verification.json)与[Luna直接图像](../evidence/I10-context-layout/reviewer/report.md)。
- [x] 独立非实现 Luna 直接查看新真实渲染图（实际 JPEG） 与现有约定；root 另验真实上下游/零写/五视口。图像像素与 viewport 不一致的采集物保留 NOT VERIFIED，重采不覆盖旧图。 证据：[root实际状态](../evidence/I10-context-layout/root/verification.json)与[Luna直接图像](../evidence/I10-context-layout/reviewer/report.md)。

补充必需门（不得被上述有限通过抵消）：

- [ ] 原生select选项弹层直接视觉证据。
- [N/A 本轮] 触控、真机软件键盘和窄屏：用户已明确短期不开发、不验证；既有历史证据保留，不作为本轮放行门。
- 内部资料结构检查不属于本票产品验收；ROOT-AUDIT-002 的 STOPPED 5/5 仅留作独立历史记录。

## 派发说明

唯一允许产品写入：`app/globals.css` 中 `.tradingview-context-dialog` 及其后代专用规则，必要时 `app/components/import/tradingview-context-dialog.tsx` 的样式 className。禁止改变任何行为、API、其他全局选择器，禁止改 Task31 冻结文件、冻结包、validator、DB、服务及 Git。证据只写 `evidence/I10-context-layout/worker/`。不要覆盖旧包；报告前后 SHA、精确 diff、验证、限制。无需为纯局部 CSS 写镜像测试；若改行为应停止并交回 root。

实现者：原 Sol 6.1 Ultra；专属审查者：原独立 UI Luna 5.6 Max；整页视觉与持久化 owner：root。不得再派 Agent。root 独占服务重启/截图和验收库。先交最小字段布局候选，不扩充页面。

## 验收证据

2026-10-27 范围纠偏：内部资料/harness 问题不再阻止本票产品关闭。历史所述“最终归档门未过”保留，不再作为本票放行条件；下拉弹层、触控及真机键盘等尚未验证的产品项不因此自动通过。

当前局部字段重叠 **round1/5 RESOLVED**：[独立Luna20图SPEC/QUALITY与渲染PASS](../evidence/I10-context-layout/reviewer/report.md)，[root上下游/53表零写与冻结核验](../evidence/I10-context-layout/root/verification.json)，[协调者验收](../evidence/I10-context-layout/root-acceptance.md)。五强制视口及559/561、长名均真实JPEG像素匹配；实际上海/深圳、无效/有效、Continue完整两行、X/Cancel/Escape/焦点循环/重开默认值已操作。

原FAIL与错尺寸采集保留。原生下拉展开图仅有焦点环，popup像素仍NV；emulated/physical touch和真机软件键盘未验证。ROOT-AUDIT-002第5轮STOP，最终归档门未过。**整票保持open/acceptance-failed**，不能以局部字段缺陷解决关闭全部验收。

2026-10-28 当前范围纠偏：用户明确触屏和窄屏短期不开发、不验证，本轮触控、真机软件键盘及窄屏验收 N/A；历史结果不抹去。原生 select 选项弹层桌面视觉仍未验证，整票维持 open；项目资料管理不属于产品放行条件。
