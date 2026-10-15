# TradeReview 视觉规范与版本

## 长期使用的文档标准

新建/更新视觉设计资料先读[图文视觉设计文档标准 VDF 1.0](documentation-standard.md)，复制[设计文档模板](templates/visual-design.template.md)。固定采用“图片 → 普通中文说明 → 具体规则与验收”，登记图片的来源、场景、版本和批准状态；按范围增补，局部修改不强制重建整页图册。

标准已接入 [AGENTS](../../AGENTS.md)、[开发流程](../agents/development-workflow.md)、[拆票标准](../agents/task-decomposition.md)、[UI验收模板](../agents/ui-task-templates.md)及[控件审计](../agents/frontend-control-audit.md)。文档格式不替代产品设计契约、实际功能或数据库验收。整理结果见[格式与项目集成接受记录](reports/2026-10-11-documentation-standard.md)。

## 设计资料与证据状态

| 入口 | 角色与状态 | 使用方法 |
| --- | --- | --- |
| [已确认锁定的复盘r1图文基线](baselines/2026-10-11-clean-review-r1-locked/RELEASE.md) | 当前批准版本`TR-REVIEW-CLEAN-R1-20261011`；13专题、15图及文件/图片指纹；候选参数仍需校准，产品未验收 | 先看RELEASE批准边界，再看图片/规范；历史“待确认”文案按RELEASE解释，示意图不当运行金图 |
| [复盘r1决策、开发与验收任务](../../.scratch/review-clean-r1-implementation-plan-20261011/README.md) | 3个未解决决策、8条未执行开发/验收旅程；逐状态覆盖、状态合同、控件范围；产品均NOT VERIFIED | 先真实图表最小完整旅程，再展开依赖任务；root独立集成接受，旧PASS不继承 |
| [复盘位置与主页兼容](baselines/2026-10-11-clean-review-r1-locked/entry-compatibility.md) | 锁定版同一应用壳、正式回合入口、来源返回及AC27；运行未验收 | 与CB01/02/26及IMG-14一起读，不迁移首页B布局或新增业务路由 |
| [批准前r1修订来源](baselines/2026-10-11-clean-review/README.md) | 锁定快照的原始来源；保留修订时的状态用语和指纹，当前批准状态见RELEASE | 历史追溯和图文形式示范；新任务使用锁定版 |
| [r1修订与文档接受记录](reports/2026-10-11-plan-axis-tool-state-entry.md) | 三项用户要求、修订图和独立文档检查；保留首次图版FAIL与修复 | 文档接受不能替代未来真实页面验收 |
| [2026-10-10 实现与视觉归档](versions/2026-10-10/README.md) | 实际组件、截图、契约、源码指纹和有限验收；保留未验证项 | 作为已记录范围的历史实现对照，不冒称整页全部通过 |
| [复盘工作区规范草案与历史调整](review-workspace-draft-2026-10-06.md) | 方向、文字角色与历次调整；含候选值 | 按最新用户决定和适用契约读取，不把全部数值升级为批准 |
| [选中反馈与盈亏比默认值](drawing-selection-feedback.md) | 选择/拖动反馈、几何与新RR默认规则 | 与对应页面的状态、图版及验收一起使用 |

历史记录中的本地 `.scratch` 路径用于追溯，不是远端可用附件。可随分支查看的画面与报告集中在版本目录；未验证事项不会因归档而改为通过。

## 更新规则

每次更新保留规则ID、图片状态与决定来源，只替换本次受影响的解释/图版并记录修订；同步图片登记、图文/可选网页和本索引。已确认基线或接受证据保留可恢复版本；新图未确认、产品未验收时如实列出，不覆盖历史状态。锁定目录不原地更新，变更建新版本并登记批准、参数校准与证据；具体检查与例外统一见VDF标准。
