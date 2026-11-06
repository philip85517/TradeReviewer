# 2026-11-06 最新完整设计文档进展

本轮将各 worktree 已推进的文档集中到独立分支，推送后通过 PR 进入 master。完整保全不等于设计批准。剩余设计细节统一按推荐、暂定处理，停止逐项确认。产品实现、业务数据库和运行验收不在本轮范围。

## 阅读顺序与效力

1. 用户最新明确决定、[当前项目工作流](../../../agents/development-workflow.md)及[交易库业务规范](../../trading-library-design-spec.md)约束本轮整合。
2. [首页公共 V2.5](../../baselines/2026-10-22-homepage-v2.5/visual-spec.html)是公共视觉来源；[交易库 V2.0](../../baselines/2026-10-26-trading-library-v2.0/visual-spec.html)是交易库视觉基础；[后续业务决定](BUSINESS-UPDATES.md)覆盖旧稿对应条款。
3. 本页记录最新已确认方向、暂定方案与覆盖关系。策略 V1.2 是最新策略设计提案；复盘保留最新原型进展，须经用户审阅后回填正式正文。
4. 旧规范、过程截图、验收和历史归档只解释对应版本。发生冲突时按本页明确的覆盖关系阅读，不能用较新的 mtime 或旧 PASS 覆盖当前决定。

## 完整文档类型与去向

|类型|内容与入口|当前性质|
|---|---|---|
|业务与公共规范|业务 Markdown/HTML、首页 V2.5、交易库 V2.0|当前规范，保留原身份及评论|
|策略完整设计|[V1.2 正文、22 张图稿、生成器、覆盖表](../../baselines/2026-10-24-strategy-workbench-v1.2/README.md)、[SW01–08](../../shared/strategy-workbench-v1.2/README.md)|最新提案；本轮明确决定优先|
|复盘设计与原型|[最新方向及版本入口](#review-current)、[V1.0 历史改写稿](../../baselines/2026-10-22-review-workspace-v1.0/README.md)、candidate45/direct-v5/identity、静态 JS/CSS/vendor|方向与候选分开；没有替换正式产品|
|本轮确认配图|[逐项原话与边界](../../../../.scratch/visual-specs-consolidation-20261106/issues/03-core-design-alignment.md)、[图稿出处](alignment-manifest.json)|ST01/02 已确认；其余暂定；均非运行证据|
|执行与验收资料|视觉契约、DESIGN-COVERAGE、任务/计划、独立报告、JSON 清单及截图|从属、版本绑定；原 FAIL / NOT VERIFIED 保留|
|其他 worktree 设计及历史|[原始保全与聊天依据](../2026-11-06-visual-spec-consolidation/README.md)、本轮补充与清单|按最新候选、历史、产品实施资料分别登记；不回灌旧规则|

[交易库最新业务覆盖表](BUSINESS-UPDATES.md)列明 14 项后续决定与原始出处；[首页架构与各分支最新资料](WORKTREE-COVERAGE.md)保留为候选或过程记录，不等于实施通过。

完整性检查的文件范围、截止、遗漏补齐和排除理由见 [worktree 核对表](WORKTREE-COVERAGE.md)。它记录受审范围；不能据此宣称忽略文件、任意外部路径或未来更新已纳入。

## 策略：已确认与暂定

|决定|本轮结论|精确图示/边界|
|---|---|---|
|ALIGN-ST-01 整体分区|已确认|ST06：身份/摘要、左图右检查栏、图下回放；不扩大为整套参数批准|
|ALIGN-ST-02 四指标摘要|修订 2 已确认|[首页同款四卡](alignment/02-summary-home-aligned-v2.svg)：四张独立等宽卡，高 88px，间隔 12px，圆角 8px，内边距 16px；标签 14/20、主值 28/34，同一左起点、等宽数字；口径说明收进标题说明入口|
|ALIGN-ST-03 横向空间|暂定|[图示](alignment/03-chart-inspector-space.svg)：右栏 320px、间隔 24px、主图占剩余空间；不是全站通用宽度|
|ALIGN-ST-04 净图高|暂定|[图示](alignment/04-chart-height.svg)：标准 360px、紧凑至少 320px，允许外层纵向延续；不批准吸底或固定工具栏|
|ALIGN-ST-05 推进视野|暂定移动方式；目标可见性是既有要求|[图示](alignment/05-replay-viewport.svg)：保留横向缩放，必要时最小平移使主动推进目标可见；手动回看暂停，刷新/侧栏 resize 保留视野；不改变日期/信息截止语义|
|ALIGN-ST-06 检查栏层级|暂定|[图示](alignment/06-inspector-hierarchy.svg)：概览/调仓记录/统计指标；名称左齐、表格金额右齐；长原因完整可读|
|ALIGN-ST-07 回放条|按用户批量指示暂定|[图示](alignment/07-replay-toolbar.svg)：日期→播放/暂停→下一交易日→速度；播放/暂停同槽；按钮 36px、14/20 字、间隔 12px；触控与窄屏另验|
|其余未冻结设计细节|推荐、暂定|沿最新方案保留，不逐项提问、不记为最终批准，不改变已确认业务与安全规则|

原连续摘要带、四分隔线、主值右齐及底部重复说明，已由 ALIGN-ST-02 修订 2 取代。旧 PNG 验收图只对应旧版本。指标卡标签与主值左齐；表格数值列右齐，二者不能混用。其他页面图中的旧摘要局部仅作历史示意，不能覆盖本轮确认。

<a id="review-current"></a>

## 复盘最新方向与未完成状态

当前业务的真实复盘回合由**每次主动平仓/退出**形成，不要求整只证券持仓清零。回合是否形成、复盘是否完成是两个概念；具体定义以当前业务规范为准。本轮没有新增评分或正式完成门槛。旧 RV04 的“零至零回合”、按该定义生成的解释图/算例及 RV09 的“全部清仓后才完成”，均不再作为当前业务依据。

已记录的 R01–R05 用户方向见[原覆盖记录](../../../../.scratch/review-workspace-design-map/evidence/immersive-layout/revision-01/DESIGN-COVERAGE.md)：

|方向|最新内容|被取代内容|
|---|---|---|
|R01|左侧同股交易按最近到最早排列|不以旧布局取代最新交易选择动线|
|R02|右侧采用 A：连续的买入前/结束之后表单；持仓记录收起|独立持仓判断、拆开的加仓/减仓表单|
|R03|图上可自由创建多条 Text，不绑定买卖节点|旧正文的节点绑定、两张短卡等候选限制|
|R04|工具条从约 647×48 缩到约 539×40，保持 916:68 比例|不将旧尺寸重新当默认|
|R05|真实图表、回放状态与表单职责分离|不能只靠表单变化证明回放可用|

这些方向不等于批准全套 candidate45，也不把原型内合成交易分段作为真实业务配对规则。交接依赖当前业务规范与交易库 V2.0；旧稿引用 V1.0 仅保留历史背景。

|版本|入口|效力与证据边界|
|---|---|---|
|candidate45|[当前默认原型](../../baselines/2026-10-22-review-workspace-v1.0/prototypes/workspace-v0.1/index.html?variant=A&scene=entry)、[验收](../../../../.scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-final-candidate45/ACCEPTANCE.md)|当前默认保持不变；旧 FAIL 保留，部分旅程/实际输入未验|
|direct-v5|[隔离候选与报告](../../../../.scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-04-direct-text-stage/REPORT.md)|未合入默认原型；不得按 mtime 自动取代|
|identity|[隔离候选与复核](../../../../.scratch/review-workspace-design-map/evidence/systematic-fixes-20261105/task-10-identity-stage/coordinator-review/REPORT.md)|顶部持续显示交易次数，待用户审阅；不替换默认入口|
|10/24 正文/解释图|[历史候选](../../baselines/2026-10-22-review-workspace-v1.0/visual-spec.html)|未按上述全部方向回填；本页覆盖冲突部分，不能称现行权威|

11/6 用户原话：“这些不要特意去处理，因为标注时我做的，所以假如影响到阅读了，我自己会调整这些文字的控件范围”。因此取消文字/文字、文字/成交标记的专项自动避让要求；旧重叠 FAIL 保留为历史，不改成 PASS。**已放置 Text 的直接拖动与独立显示宽度调整仍未实现/未通过**，创建时选位和修改正文不等于事后调范围。模拟输入、浏览器实际输入、键盘/触控分别记账；缺失证据继续 NOT VERIFIED。TradingView 的其他绘图工具仍存在禁用占位，不能宣称功能 1:1。

## 整合与验收边界

保留已推进完整资料和历史依赖，撤回此前只选 67 个文件的精简建议作为本轮执行范围。原始快照、旧验收及旧选择报告不改写；本轮对正文/图稿的必要修订另有差异与哈希记录。归档中的原目录相对链接、源 worktree 绝对路径并不保证在 PR 中独立可运行；当前导航和当前必要依赖须单独检查，历史缺链列入清单。

本轮检查文档来源、文件类型、当前入口、生成阅读页、身份/评论、冲突覆盖及 git 范围。UI 操作、真实图表、持久化、实机触控不适用于本次文档 PR，也不会被记为 PASS。独立复核与远端状态见 [最终记录](FINAL-ACCEPTANCE.md)。
