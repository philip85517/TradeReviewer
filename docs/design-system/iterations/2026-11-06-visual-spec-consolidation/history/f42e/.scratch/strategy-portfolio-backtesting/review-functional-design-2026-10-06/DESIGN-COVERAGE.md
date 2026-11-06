# 策略工作台评审修订：设计覆盖

范围：正式功能设计文档。八项建议来源于[评审报告](../design-report-2026-10-06/策略工作台设计评审.docx)“修改建议”页；[可检索原文](../design-report-2026-10-06/qa-03/text_b.txt)保留 R01–R08。本文 DR 前缀仅避免与原产品 R 编号冲突。

**本表是设计和后续验收映射，不是实现派发。** root唯一负责整页一致性及完整状态/持久化设计；独立文档审查者不改稿。下游实现者/独立视觉审查者待正式派发前指定。用户只确认规格终点，未因“确认”批准未展示的布局细节。所有新UI证据均 NOT VERIFIED；历史FAIL/PASS不改写。

## 规格定位与参考目录

- **S**：[本轮功能设计](../../../docs/specs/2026-10-06-strategy-workbench-review-functional-design.md)，DR01/RD01 起于39行，DR02/RD02于55行，DR03/RD03于72行，DR04/RD04于99行，DR05/RD05于107行，DR06/RD06于123行，DR07/RD07于137行，DR08/RD08于145行；时间动作表于165行，视觉边界于180行，旅程于194–200行。行号以本轮冻结文档核验为准。
- **I**：[融合契约](../../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)，IF01页面职责39行，IF02进入/重开43行，IF03身份61行，IF04返回65行，IF05导航83行，IF06控件87行，IF07文案101行，IF08时间105行，IF09管理122行，IF10接线128行。
- **L**：[策略库与实验规格](../../../docs/specs/2026-09-30-strategy-library-and-experiments.md)，LD02两层复用、LD03创建来源、LD04复制版本、LD07兼容性/数据、LD10引用口径、LD11入口、LD12查询工具。**M**：[交互模型](../strategy-library-interaction-model.md)，M11详情、M12管理、M13四步、M14查询、M15元素规范。
- **W**：[稳定工作台规格](../../../docs/specs/2026-09-30-strategy-stable-workbench-design.md)，WD02表118–123行：WB03主图区、WB04回放条、WB05状态位、WB06检查区、WB07明细区；WD03固定控件、WD04时间、WD06事件与来源。RD01单独定位于既有38px业务上下文行；[REPAIR-03](../workbench-design/REPAIR-03-CONTRACT.md) UR01–08及[STYLE-04](../workbench-design/STYLE-04-CONTRACT.md)固定布局与主题。

下列代号各自指向**准确文件**；不是泛指整个截图目录。所有图均是现状/继承参考，新增RD呈现还没有批准图。

| 参考 | 1440×900 | 1280×800 | 精确区域/边界 |
| --- | --- | --- | --- |
| RF14 | [f14](../resume06/screenshots/f14-1440.png) | [f14](../resume06/screenshots/f14-1280.png) | 实验卡片状态、区间、主动作；原尺寸 |
| RF15 | [f15](../resume06/screenshots/f15-1440.png) | [f15](../resume06/screenshots/f15-1280.png) | 起点/期限；按钮位于正文滚动区的现状问题 |
| RF16 | [f16](../resume06/screenshots/f16-1440.png) | [f16](../resume06/screenshots/f16-1280.png) | 选择、计数、定义/预设摘要 |
| RF17 | [f17](../resume06/screenshots/f17-1440.png) | [f17](../resume06/screenshots/f17-1280.png) | 候选/信号/目标与成交；首屏状态 |
| RF18 | [f18](../resume06/screenshots/f18-1440.png) | [f18](../resume06/screenshots/f18-1280.png) | 预检/日历/锁定文案及操作栏；[小视口末尾](../resume06/screenshots/f18-1280-scrolled.png) |
| RF10 | [f10](../resume06/screenshots/f10-1440.png) | [f10](../resume06/screenshots/f10-1280.png) | 包版本、状态、引用统计口径 |
| RF12 | [f12](../resume06/screenshots/f12-1440.png) | [f12](../resume06/screenshots/f12-1280.png) | 所看包版本、元数据与统计；[小视口末尾](../resume06/screenshots/f12-1280-scrolled.png) |
| WA-T0 | [回看T0](../workbench-design/style-04-evidence/review-t0-1440.png) | [待开始T0](../workbench-design/style-04-evidence/t0-1280.png) | 固定上下文/回放框架；两图阶段不同，分别作为几何参考，不能互比状态 |
| WA-R | [result](../workbench-design/style-04-evidence/result-1440.png) | [result](../workbench-design/style-04-evidence/result-1280.png) | 阶段结果、只读回放槽位 |
| WA-C | [compare](../workbench-design/style-04-evidence/compare-1440.png) | [compare](../workbench-design/style-04-evidence/compare-1280.png) | 比较、共同截止、只读原因 |
| WA-E | [event](../workbench-design/style-04-evidence/event-1440.png) | [event](../workbench-design/style-04-evidence/event-1280.png) | 事件日投影、命名返回、关闭、320px详情 |
| WA-P | 无同状态1440参考；新呈现须生成 | [pressure](../workbench-design/style-04-evidence/pressure-1280.png) | 六组合、长名、大金额与滚动压力 |
| WA-F | 无同状态1440参考；新呈现须生成 | [failure](../workbench-design/style-04-evidence/failure-1280.png) | 失败及最后完整投影 |

## 逐状态覆盖

责任列使用既有决策票的名称，不创建重叠队列：**库模型**=[明确策略库、三类策略包与实验的交互模型](../issues/09-strategy-library-interaction-model.md)；**工作台模型**=[明确固定工作台与紧凑回放控件的交互模型](../issues/11-stable-workbench-interaction-model.md)。二者仍open。本文在库模型当前已领取的设计讨论中整理评审输入；工作台条目仅提出继承规则的呈现细化，不据此解决其整票。

证据目录 `evidence/` 为**未来计划路径**，尚无浏览器/UI验收输出。每行都需功能、状态安全、视觉各自支持；文档审查不填成UI PASS。

| 需求/规格定位 | elementID | 准确参考 | 阶段/状态 | owner/任务/交付 | 浏览器操作/旅程 | 可观察预期与反例 | 计划证据 | UI状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DR01；S§DR01；I IF08；W WD04 | RD01（38px上下文）/WB05 | WA-T0 | 待开始 | root/工作台模型/时间组 | J-RD01确认后停住 | V/M=T0、无结果；反例：计划终点伪装进度 | evidence/dr01-t0 | NOT VERIFIED |
| 同上 | RD01（38px上下文）/WB05 | WA-T0、WA-E | 暂停/回看 | root/工作台模型/时间组 | 推进后回早期日 | 查看日突出，M不倒退；轴/tooltip无未来 | evidence/dr01-review | NOT VERIFIED |
| 同上 | RD01/WB03/05/07 | WA-R、WA-C | 结果/对比 | root/工作台模型/时间组 | 同进度进入结果/对比 | 单组合结果受R/所选Mᵢ限制，对比C可区分；失败组不静默排除 | evidence/dr01-cutoffs | NOT VERIFIED |
| 同上 | RD01/WB03/05/06 | WA-E、WA-F | 事件/部分失败M>Mᵢ | root/工作台模型/时间组 | 点事件；一组失败另一组继续 | 事件V整页同步；未知不作0；M不退、失败Mᵢ不被补齐 | evidence/dr01-event-failure | NOT VERIFIED |
| DR02；S§DR02；I IF02/04/06；M M13 | RD02/LIB09 | RF15 | 第1步/长字段 | root/库模型/主动作 | J-RD01填写、Tab、滚到底 | 期限和最后字段可达，主动作首屏可发现；不覆盖字段 | evidence/dr02-step1 | NOT VERIFIED；位置待选 |
| 同上 | RD02/LIB09 | RF16、RF17、RF18 | 第2–4步 | root/库模型/主动作 | 下一步/上一步/返回 | 同位置主动作，≥36px；草稿同身份全保留 | evidence/dr02-step2-4 | NOT VERIFIED；位置待选 |
| 同上 | RD02/LIB09 | RF18；新错误状态无源图 | 提交中/失败/不确定 | root/库模型/确认 | J-RD02重复点击、核对、重试 | 不盲建第二次运行，失败保留输入；T0不自动推进 | evidence/dr02-submit | NOT VERIFIED |
| DR03；S§DR03；L LD02/07；M M13 | RD03/LIB09 | RF17 | 有候选/信号待确认 | root/库模型/预览 | 预览两个组合 | 首屏尚未成交、独立现金，目标不当成交 | evidence/dr03-preview | NOT VERIFIED |
| 同上 | RD03/LIB09 | RF17；无候选/无信号新状态无源图 | 无候选/无信号 | root/库模型/预览 | J-RD02切两种合法现金态 | 各自原因可读；不把无信号等同缺数据 | evidence/dr03-cash | NOT VERIFIED |
| 同上；I IF02 | RD03/LIB09 | RF18 | 必检通过/示例/未接入 | root/库模型/检查分组 | 预检日历未接入与真实通过 | 未接入必需项阻断真实确认；示例不授予通过 | evidence/dr03-check-groups | NOT VERIFIED |
| 同上 | RD03/LIB09 | RF18；新异常状态无源图 | 版本变化/响应过期/检查失败 | root/库模型/检查状态 | J-RD02改输入、版本失效、延迟响应 | 输入保留；旧响应不覆盖；不升级所选版本 | evidence/dr03-stale-error | NOT VERIFIED |
| DR04；S§DR04；I IF08；W WD03/04 | RD04/WB04/05 | WA-R、WA-C | 结果/对比只读 | root/工作台模型/只读提示 | J-RD03进入两模式、Tab读说明 | 44px槽位不变；无需hover可知原因；键盘不推进 | evidence/dr04-readonly | NOT VERIFIED |
| 同上 | RD04/WB04/05 | WA-R、WA-F | 返回观察/回看/完成/失败 | root/工作台模型/恢复 | 返回观察再检查可用动作；V<M时返回最新 | 恢复原观察来源、暂停；回看不准推进，返回最新不扩大M；完成/失败原因不同 | evidence/dr04-return | NOT VERIFIED |
| DR05；S§DR05；I IF04/08；W WD06 | RD05/WB06–08 | WA-E | 结果/对比→事件 | root/工作台模型/事件投影 | J-RD03点两个来源事件 | 整页到事件日、M/执行截止不变；不只改右栏 | evidence/dr05-open | NOT VERIFIED |
| 同上 | RD05/WB06–08 | WA-E | 关闭/重新打开 | root/工作台模型/关闭 | 点关闭、Escape、浏览器返回 | 停事件日并恢复焦点；来源入口仍可达 | evidence/dr05-close | NOT VERIFIED |
| 同上 | RD05/WB06–08 | WA-R、WA-C、WA-E | 命名返回来源 | root/工作台模型/来源恢复 | 关闭后返回实际来源 | R/C、筛选/集合/滚动/视野恢复；不自动播放 | evidence/dr05-source | NOT VERIFIED |
| 同上 | RD05/WB08 | WA-E；[配置](../workbench-design/style-04-evidence/config-1440.png) | 配置/包历史/来源上下文丢失/对象失效 | root/工作台模型/逐层返回 | J-RD03嵌套返回、两种失效分支 | 返回事件日后才显式恢复来源；对象失效按IF04回合适入口，不把缓存当有效对象 | evidence/dr05-nested-invalid | NOT VERIFIED |
| DR06；S§DR06；L LD11/12；M M13/14 | RD06/LIB08 | RF14 | 草稿/待开始/暂停/完成/失败 | root/库模型/卡片文案 | 浏览列表、各状态主动作 | 状态不重复、区间不混实际截止、失败原因保留；外尺寸不改 | evidence/dr06-cards | NOT VERIFIED |
| DR07；S§DR07；I IF02/03；L LD02/03 | RD07/LIB09 | RF16、RF17、RF18 | 选2/取消1/再选 | root/库模型/独立组合身份 | J-RD01逐次选择与预览 | N条配置=N独立组合，版本/本金/预设贯穿；不落固定单策略样例 | evidence/dr07-two-portfolios | NOT VERIFIED |
| 同上；I IF04 | RD07/LIB09/WB08 | RF16、RF18 | 详情返回/库升级后查看 | root/库模型/版本来源 | 查看包→返回；查看锁定配置 | 看不等于选，旧运行不变，不凭同名关联 | evidence/dr07-version-return | NOT VERIFIED |
| DR08；S§DR08；I IF06；W WD02/WB06 | RD08/LIB07–09/WB01 | RF14、WA-P | 长名称/键盘 | root/两模型共用/全名入口 | J-RD04 hover、focus、Escape | 全名完整可读，焦点恢复，不触发播放或导航 | evidence/dr08-names | NOT VERIFIED |
| 同上 | RD08/WB06/08 | WA-E、WA-P | 长详情/加载/新事件 | root/工作台模型/滚动提示 | 滚到底、切组合、返回来源 | 提示按溢出变化，旧身份不闪现；图表矩形不变 | evidence/dr08-scroll | NOT VERIFIED |
| 同上；L LD10；M M12 | RD08/LIB07 | RF10、RF12 | 包元数据/未知引用数 | root/库模型/统计层级 | 看版本与计数、失败→重试 | 当前/版本/历史分别命名，未知不作0；无新排序默认值 | evidence/dr08-counts | NOT VERIFIED |
| I IF10；S§6 J-RD01 | LIB08/09/WB01–05；RD01–03/07 | RF14–18、WA-T0 | 完整创建/真实推进/重开 | root/整合/最小完整链 | J-RD01真实图表与运行身份核对 | 同一锁定实验、新bar可见、重开暂停；不能样例硬跳转 | evidence/j-rd01 | NOT VERIFIED；先验收再扩展结果 |
| I IF02/03/04；S§6 J-RD02 | LIB09/WB08；RD02/03/07 | RF18；新持久化状态无源图 | 写入/失败/刷新 | root/完整数据流/持久化 | 隔离库保存→返回→刷新 | 实际重读同身份，防重复；回调不作证据 | evidence/j-rd02 | NOT VERIFIED |
| I IF08；S§4/6 J-RD03 | WB02–08；RD01/04/05 | WA-R、WA-C、WA-E、WA-F | 截止/事件/未来暴露 | root/完整状态流 | J-RD03、早期日tooltip/轴核对 | V/M/Mᵢ/R/C独立正确、原子投影、曝光来源不清除 | evidence/j-rd03-safety | NOT VERIFIED |
| I IF05/06/10；S§5/6 J-RD04 | LIB11/WB01–08；全部RD | RF14–18、WA-P、WA-E | 两档/两导航态/断点/压力 | root整页；独立视觉owner待派发 | J-RD04匹配状态直接比图 | 保留固定预算、图高/320px/44px/字体，未知参考不当批准 | evidence/j-rd04-visual | NOT VERIFIED |

## 本轮适用性与决策边界

- 本轮只写设计文档，UI/图表/数据库执行门槛 **NOT APPLICABLE（范围原因）**；上表指未来实现，仍是 **NOT VERIFIED**，不能借文档发布解除。
- 正式规格终点有用户“确认”；操作栏布局问题已提交用户，尚无选择时保留两候选及推荐，不自答HITL。其他新增呈现供整稿审阅。
- 沿用原地图和既有模型票，不新增实施票、不关闭整票。包数量、M12默认管理细节、比较默认指标顺序不因本稿改变接受状态。
- 文档独立审查与引用检查见[本轮记录](README.md)；原resume06、A各轮FAIL/PASS及融合NOT VERIFIED仍原样保留。

## 后续用户决定

用户已确认固定底部操作栏并授权[视觉原型修订07](../visual-iteration-07/DESIGN-COVERAGE.md)。上述行继续描述未来正式接线门槛，NOT VERIFIED不变；当前原型范围与接受另记，不混合文档和UI证据。
