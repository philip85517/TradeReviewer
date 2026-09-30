# 02 — 四步创建：策略包选择、候选解释与确认进入

ID: strategy-desktop-v2-02
State: open
Status: draft
Labels: draft
Assignee: unassigned
集成负责人: 发布后领取该切片的主协调者
Source: [策略桌面端视觉与完整交互设计规格](../../strategy-portfolio-backtesting/issues/08-desktop-ux-design-spec.md)

> 拆分草案，尚未发布为可领取任务；用户确认粒度与依赖后移入 issues 并标 ready-for-agent。本票范围为合成交互原型，不是生产功能。

## Scope / What to build

从实验列表新建，经设置起点、选择完整策略包、解释候选和确认进入，生成一个或两个组合配置并进入 T0；返回列表重开保留准确设置。使用既有运行接口即可独立验证，不等待第 01 票的新工作台完成；不扩张为正式筛选服务。

范围外：不重写运行时钟/账本、不承担新工作台和结果页面验收。已开始运行的配置安全编辑由第 04 票完成；本票只编辑未运行草稿，不能触碰旧运行状态。

## Refs

- [桌面设计正文](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)：DD03–DD04（146–167 行）、DD13–DD14（268–281 行）；E09–E12（139–142 行），T01–T02（319–320 行）。
- 需求：UX06、UX07、UX08、UX09、UX10；元素：E09、E10、E11、E12；用户故事：3、4、5、6、7、8、10、11、12、13、14、15、16、17、18、19、20、21、49、50；验收：T01、T02、T12。
- [拆分与共同契约](../TICKET-PLAN.md)、[逐项覆盖草案](../DESIGN-COVERAGE.draft.md)。
- [参考 creation-baseline-1440.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1440.jpg)。
- [参考 creation-baseline-1280.jpg](../../strategy-portfolio-backtesting/screenshots/creation-baseline-1280.jpg)。
- [参考 creation-history-1440-final.jpg](../../strategy-portfolio-backtesting/screenshots/creation-history-1440-final.jpg)。
- [参考 creation-packages-1280-final.jpg](../../strategy-portfolio-backtesting/screenshots/creation-packages-1280-final.jpg)。
- [参考 creation-preview-1280-final.jpg](../../strategy-portfolio-backtesting/screenshots/creation-preview-1280-final.jpg)。
- [参考 creation-ready-1440.jpg](../../strategy-portfolio-backtesting/screenshots/creation-ready-1440.jpg)。
- 参考是现有风格/旧状态，不是新设计批准画板；按正文目标和同状态新渲染对照，不能拿旧 PASS 替代本票。
- [项目拆票标准](../../../docs/agents/task-decomposition.md)、[UI 验收模板](../../../docs/agents/ui-task-templates.md)。

## Blocked by

None — 拆分获批并发布后可领取；不是本轮自动开始实现。

## 输入/输出与最小整理

输入未运行草稿与合成覆盖场景，输出与现有运行入口兼容的已确认配置；复用现有列表/创建导航。配置形状若确需变化，由接线 owner 提供兼容适配，不据共享文件人为增加与第 01 票的产品阻塞。

## 验收标准与反例

- [ ] AC01：保留 A 的四步结构，文案及主次动作符合 DD03；完成步骤勾号、当前蓝色、未到灰色。进入工作台仍为待开始且无成交。
- [ ] AC02：历史日期/时间、时区、完整日/周截止、标的来源、独立本金和五档期限可见；无效/未来时点与非法本金禁止继续，盘中/休市时点不偷用未来 bar。
- [ ] AC03：固定逐日揭示说明替代无行为差异的盲看开关；保持配置接口兼容，不因移除 UI 开关改变策略历史数据边界。
- [ ] AC04：策略卡明确多选；规则详情不切换选中；未选预设只读、已选可编辑；不可用包就近解释原因，并保留其他包可选。规则仍是打包策略，不新增条件搭建器。
- [ ] AC05：候选按入选/规则不符/数据不足分组计数；默认入选，展开能看规则值和数据可知时间；样例计数不冒充已检查全证券池。
- [ ] AC06：目标权重、预计金额、现金与实际零持仓区分；金额随本金同步；切组合预览不混用预设。无候选可创建全现金组合。
- [ ] AC07：部分覆盖需确认；改变起点、集合或场景撤销旧确认及旧预览；回退保留有效输入；确认页和已创建摘要保留覆盖说明。
- [ ] AC08：完成四步→进入现有或已集成的新工作台 T0→返回列表→重开准确配置；至少验证单策略、双策略、缺字段、部分覆盖与无候选。
- [ ] AC09：两档桌面比较策略卡、预览、确认页的密度/字号/主动作；开发场景工具折叠，原型标识常驻，缺数据关键说明不能被一起隐藏。

核心反例：把数据未知当规则排除；调了未选预设却误以为策略已选；创建即持仓；修改本金后摘要仍是旧金额。

## 视觉与状态约束

- 1440×900、1280×800 CSS 视口，100%缩放；历史基线DPR1，新验收记录实际DPR。保留TradeReview侧栏/背景/蓝色主动作、6–8px圆角；本票元素遵守DD02尺寸、DD13字体和状态色。
- 先装配一屏代表性状态并独立看图，之后扩展其余状态。每票都完成自己的视觉/键盘检查，第08票只验集成，不补做前票门槛。
- 时间遵守DD06，运行V/M/各组Mᵢ、结果R及曝光来源由同一会话边界协调；字段不适用时按本票范围说明，不删除后续契约。
- 原型使用合成数据，返回重开只保留内存；无真实API/schema/数据库写入。窄屏暂不修改，不新增窄屏专项门槛。

## 验收证据

- 功能/时间状态：NOT VERIFIED；端到端浏览器：NOT VERIFIED；独立视觉：NOT VERIFIED。
- 计划记录于 acceptance/02.md，渲染证据放 screenshots/02/；这些是计划位置，文件未产生前不得当成证据。
- 数据库持久化：NOT APPLICABLE（本票内存原型）；正式产品要求保留在原产品规格。
- 协调者接受：未接受。任一必需FAIL/NOT VERIFIED都不能关闭票。

## 派发说明

- 尚未分派。实现默认使用gpt-5.6-luna的有界任务；同一切片指定唯一会话/接线owner与整页视觉owner，协调者独立接受。不因前后票共享文件增加虚假产品依赖。
- 发布后、实际派发前填实际代理及精确可写文件范围；共享文件唯一writer，必要时串行落地或由接线owner集成。不得同时派发两个代理修改同一文件。
- 本票只触及本切片所需原型模块及证据；不改普通业务数据、不创建新供应商体系、不推送/合并/发布。
- 每次UI交付提供仍运行且新鲜浏览器检查过的预览URL、启动方式与范围说明。自动化通过不能代替视觉或真实图表证据。

## 历史

- 2026-09-29：基于桌面UX v2生成拆分草案，等待用户确认拆分；未更改父票，未发布可领取任务，未实施。
