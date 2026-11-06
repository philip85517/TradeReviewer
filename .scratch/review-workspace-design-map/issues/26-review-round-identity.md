# 26 — 侧栏收起时保持当前交易回合可识别

ID: I11-identity
State: open
Status: candidate-ready-for-user-review; actual-input breakpoint gates NOT VERIFIED
Assignee: identity-prototype implementer
集成负责人：coordinator（整页视觉与跨区域状态链）

## 触发、证据与根因

用户要求左侧列出当前股票的历次交易，并授权在独立审核后依次修复发现的问题。candidate-45 合成数据在 1280×800 切到第 2 次交易，右栏展开时左栏收起；切换提示会被后续回放提示替换，顶栏只显示股票/代码和周期，不能持续识别当前交易回合。参见[入场](../evidence/systematic-fixes-20261105/task-final-candidate45/independent-trade2-20261106/1280-28-entry-before-edit.png)、[结束](../evidence/systematic-fixes-20261105/task-final-candidate45/independent-trade2-20261106/1280-49-exit.png)及[限定观察](../evidence/systematic-fixes-20261105/task-final-candidate45/independent-trade2-20261106/identity-sample.json)。

排查：`currentFixture().round` 已用于左列表和切换提示，但主区 `.instrument` 未呈现；`state.notice` 被回放动作更新，不能作为稳定身份。已观察到的是身份提示缺口，而非草稿串用或回放错误。R01 要求列表显示回合，原稿没有指定收起列表时的常驻样式；因此这是待审阅的设计补充，不冒称违反了已批准的精确画稿。

## 候选与边界

在既有顶栏副标题保持当前字体、行数与高度，把当前 `currentFixture().round` 加入“日线 · 合成演示行情”，例如“日线 · 第2次交易 · 合成演示行情”；回合切换后更新，跨买入前/持仓/结束保持同一身份。只展示已在列表暴露的回合名，不提前展示成交价格或结果，不改变回放截止、草稿、两侧开合或交易列表，不增加持仓记录、Text 碰撞规则或新按钮。固定住既有图表、标题、主操作的层级和空间预算；任何挤压或隐藏主操作需报告并调整，不能缩字号或扩大主栏。候选仅供用户审阅，不回填正式视觉规范。

参考：[R01/R02/R05](../evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)；[原入场](../evidence/immersive-layout/screenshots/final-A-entry-1440.png)、[原持仓](../evidence/immersive-layout/screenshots/final-step-holding.png)、[原退出](../evidence/immersive-layout/screenshots/final-replay-exit.png)；[candidate-45 清单](../evidence/systematic-fixes-20261105/candidate-20261105-45/manifest.json)；[覆盖矩阵](../DESIGN-COVERAGE.md)。

## 验收与反例

- [ ] 在 1280×800 与 1440×900，选择第 2、3、1 回合并跨 entry/holding/exit，回合提示与当前选择一致；展开、收起左侧、筛选后身份不消失，不依赖短暂 notice；不得暴露未揭示成交结果或更改行情、成交截止。
- [ ] 1280、1440 及 1291/1292 两侧，同态和前中后对照顶栏/图表/侧栏空间；文本无截断或主操作遮挡；不改变原字号、顶栏高度或按钮命中区。
- [ ] 完整保留先前已验证的列表选择与内存草稿隔离，回放 28→29→33→34→41→49 实际显示新 K/成交；独立记录浏览器 console、版本清单、截图与截图参考。
- [ ] 实现者与视觉审阅者分离；协调者实操关键旅程并与参考同态对比；分别记录功能、状态、视觉的结果。非实现者和协调者以目标版本提供独立证据，不把历史 45 的其他结论自动迁移。
- [ ] 物理触屏、真实持久化及 TradingView 完整功能不在此补充的原型范围；用户明确排除的 Text 重叠专项继续 EXCLUDED。

## 派发与证据

- 仅允许在 `../evidence/systematic-fixes-20261105/task-10-identity-stage/` 的独立候选中工作，复制冻结 candidate-45 工作区；不改 3091 正在审阅的原稿、正式规范或数据库。不得覆盖历史清单。
- 实现仅针对副标题绑定（必要时少量局部样式），先复现原缺口；输出修改文件、哈希、诊断、操作与不足到该隔离目录。保留输入方式与视口；无需为原型写镜像实现的测试。
- 用户指定的项目默认实现模型 `gpt-5.6-luna` 在当前可用模型列表不可选，使用当前会话继承模型；协调者独立接受。全局源码归一、合入预览与状态判断由协调者负责。

## 2026-11-06 候选与限定复核

- 隔离候选已完成，范围与九文件版本见[实现者报告](../evidence/systematic-fixes-20261105/task-10-identity-stage/REPORT.md)和[清单](../evidence/systematic-fixes-20261105/task-10-identity-stage/manifest.json)。3091 原稿未被覆盖，候选不回填正式规范。
- [协调者实际操作](../evidence/systematic-fixes-20261105/task-10-identity-stage/coordinator-review/REPORT.md)在 1280×720 走通第二回合买入前至结束，并同态比较原稿；[非实现者的独立复核](../evidence/systematic-fixes-20261105/task-10-identity-stage/independent-review/REPORT.md)提供四个视口的截图视觉比较与模拟输入样本。
- CDP 模拟不计作项目要求的实际输入覆盖。由于 computer use 视口设置未生效，1291/1292/1440 的实际输入仍为 **NOT VERIFIED**；本票上方完整勾选门槛尚未全部满足。用户要求不专门处理的 Text 重叠为 **EXCLUDED**。
