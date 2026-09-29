# 08 — 完整桌面旅程与独立视觉验收

ID: strategy-desktop-v2-08
State: open
Status: draft
Labels: draft
Assignee: unassigned
集成负责人: 发布后领取该切片的主协调者
Source: [策略桌面端视觉与完整交互设计规格](../../strategy-portfolio-backtesting/issues/08-desktop-ux-design-spec.md)

> 拆分草案，尚未发布为可领取任务；用户确认粒度与依赖后移入 issues 并标 ready-for-agent。本票范围为合成交互原型，不是生产功能。

## Scope / What to build

从全新桌面会话走通创建→多组合运行→调仓回看→派生/重开→完整结果/比较→返回过程，独立核对视觉与键盘，并形成可交接的原型证据。它是整条用户行为的集成验收票，不是集中补做前面遗漏视觉或功能的杂项票。

范围外：不开始生产回测、真实数据/插件/DB开发；不改窄屏；不修改/关闭既有父规格或 Wayfinder 决策票。用户设计反馈记录为证据，由原决策流程后续处理。

## Refs

- [桌面设计正文](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)：完整规格 UX01–UX10（23–32 行）、E01–E12（131–142 行）、DD01–DD16（116–303 行）、TD01–TD04（307–344 行）；T01–T12（319–330 行）。
- 需求：UX01、UX02、UX03、UX04、UX05、UX06、UX07、UX08、UX09、UX10；元素：E01、E02、E03、E04、E05、E06、E07、E08、E09、E10、E11、E12；用户故事：1、2、3、4、5、6、7、8、9、10、11、12、13、14、15、16、17、18、19、20、21、22、23、24、25、26、27、28、29、30、31、32、33、34、35、36、37、38、39、40、41、42、43、44、45、46、47、48、49、50；验收：T01、T02、T03、T04、T05、T06、T07、T08、T09、T10、T11、T12。
- [拆分与共同契约](../TICKET-PLAN.md)、[逐项覆盖草案](../DESIGN-COVERAGE.draft.md)。
- [参考 creation-baseline-1440.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg)。
- [参考 creation-baseline-1280.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg)。
- [参考 creation-history-1440-final.jpg](../../strategy-portfolio-backtesting/screenshots/creation-history-1440-final.jpg)。
- [参考 creation-preview-1280-final.jpg](../../strategy-portfolio-backtesting/screenshots/creation-preview-1280-final.jpg)。
- [参考 design-review-running-1440.jpg](../../strategy-portfolio-backtesting/screenshots/design-review-running-1440.jpg)。
- 参考是现有风格/旧状态，不是新设计批准画板；按正文目标和同状态新渲染对照，不能拿旧 PASS 替代本票。
- [项目拆票标准](../../../docs/agents/task-decomposition.md)、[UI 验收模板](../../../docs/agents/ui-task-templates.md)。

## Blocked by

- [04 — 配置派生：保留原实验并重开多个实验](04-fork-and-reopen-experiments.md)。
- [07 — 组合比较：共同区间、口径差异与回看](07-portfolio-comparison.md)。

## 输入/输出与最小整理

第 04 票保证创建/派生/重开；第 07 票传递包含运行、多组合、展开、异常、结果/比较。所有叶子能力齐备后验整体。协调者负责跨组件接线和最终体验；发现实现缺陷回交对应票owner，不集中写在验收票。

## 验收标准与反例

- [ ] AC01：从可复现入口完成 T01–T12 全旅程，覆盖正常、空候选、缺字段、部分覆盖、取消、失败、落后组合、派生和结果返回；不存在只能靠注入props才能出现的关键路径。
- [ ] AC02：正式逐项勾选UX/E/T覆盖，全部必需行为有证据，无无法归属的遗漏；局部票通过不能抵消整条链上的失败。
- [ ] AC03：未参与实现者在1440×900、1280×800直接比较现有风格与最终渲染：创建、T0、首次建仓、调仓、回看、完成、结果、比较、抽屉和错误。主次层级、首屏、字体颜色与尺寸分别有证据。
- [ ] AC04：真实图表新增bar/净值点可见，时间/账本/结果保持一致；未来数据、轴、tooltip、事件计数不泄漏；来源曝光和返回上下文保留。
- [ ] AC05：鼠标与键盘单独记录；输入/IME不意外推进；Esc关闭和焦点恢复、长中文和多组合菜单可用；不把桌面模拟当真实触屏证据。
- [ ] AC06：所需类型检查/构建通过；只运行变化需要的检查，不为无关低层helper新增成套测试。真实浏览器与视觉不由这些命令替代。
- [ ] AC07：最终服务在交付时仍运行、预览URL在浏览器新鲜检查，提供可点击入口、合成/内存范围说明和启动命令；不伪造数据库保存/真实回测通过。
- [ ] AC08：用户可对完整原型给出设计反馈；技术PASS和用户接受分别记录。未通过项回归原owner修复并复验，保留旧失败记录。

核心反例：拼接各worker报告就宣布完整通过；最后才发现首屏布局偏离；结果页静态占位却打勾；交付链接服务已停。

## 视觉与状态约束

- 1440×900、1280×800 CSS 视口，100%缩放；历史基线DPR1，新验收记录实际DPR。保留TradeReview侧栏/背景/蓝色主动作、6–8px圆角；本票元素遵守DD02尺寸、DD13字体和状态色。
- 先装配一屏代表性状态并独立看图，之后扩展其余状态。每票都完成自己的视觉/键盘检查，第08票只验集成，不补做前票门槛。
- 时间遵守DD06，运行V/M/各组Mᵢ、结果R及曝光来源由同一会话边界协调；字段不适用时按本票范围说明，不删除后续契约。
- 原型使用合成数据，返回重开只保留内存；无真实API/schema/数据库写入。窄屏暂不修改，不新增窄屏专项门槛。

## 验收证据

- 功能/时间状态：NOT VERIFIED；端到端浏览器：NOT VERIFIED；独立视觉：NOT VERIFIED。
- 计划记录于 acceptance/08.md，渲染证据放 screenshots/08/；这些是计划位置，文件未产生前不得当成证据。
- 数据库持久化：NOT APPLICABLE（本票内存原型）；正式产品要求保留在原产品规格。
- 协调者接受：未接受。任一必需FAIL/NOT VERIFIED都不能关闭票。

## 派发说明

- 尚未分派。实现默认使用gpt-5.6-luna的有界任务；同一切片指定唯一会话/接线owner与整页视觉owner，协调者独立接受。不因前后票共享文件增加虚假产品依赖。
- 发布后、实际派发前填实际代理及精确可写文件范围；共享文件唯一writer，必要时串行落地或由接线owner集成。不得同时派发两个代理修改同一文件。
- 本票只触及本切片所需原型模块及证据；不改普通业务数据、不创建新供应商体系、不推送/合并/发布。
- 每次UI交付提供仍运行且新鲜浏览器检查过的预览URL、启动方式与范围说明。自动化通过不能代替视觉或真实图表证据。

## 历史

- 2026-09-29：基于桌面UX v2生成拆分草案，等待用户确认拆分；未更改父票，未发布可领取任务，未实施。
