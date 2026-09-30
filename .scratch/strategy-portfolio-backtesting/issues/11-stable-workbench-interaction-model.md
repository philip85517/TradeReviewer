# 11 — 明确固定工作台与紧凑回放控件的交互模型

ID: strategy-visual-11
State: open
Status: integration-pending
Labels: wayfinder:prototype
Mode: HITL
Assignee: root
集成负责人: root
Parent: [策略观察者：从视觉原型确认完整使用动线](02-visual-journey-map.md)
Resolution comment: 部分完成；[A选型](../comments/strategy-visual-11/2026-09-30-a-selection-and-clarity-review.md)、[第三轮修复](../comments/strategy-visual-11/2026-09-30-a-repair-resolution.md)及第四轮局部验收保留；[V1融合决定](../comments/strategy-visual-11/2026-09-30-v1-design-integration.md)统一09/11共同设计，本票仍待融合导航/状态实际验证与首次用户任务研究

## Question

如何借鉴 TradingView 的紧凑控件和固定工具带，让观察、结果、比较及异常恢复保持布局连续性，同时保留策略观察者的时间安全、完整信息和返回语义？

## Scope / What to build

先根据两图差异产出低保真分区、按钮状态表、跨视图切换与返回模型，再收集用户反馈。覆盖实验框架、图表/回放条、摘要、检查区、结果比较、异常和库/列表/创建的共同导航锚点。此票输出模型和设计决定，不实现生产 UI；可点击工作台承接到既有 05，比较承接到 06，避免另建重复实施队列。

09 策略库模型与本票可独立讨论；共享导航、完整策略/组合身份和返回字段在两票交接处对齐。尺寸为方案目标，必须验证，不把图 2 的图片像素当成 CSS 尺寸。

## Refs

- [V1与A共同融合规格](../../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)：IF01–10；[覆盖与验收入口](../v1-integration/README.md)。跨页入口、导航状态、版本交接以此为准；不覆盖局部历史证据。
- [稳定工作台方案](../../../docs/specs/2026-09-30-strategy-stable-workbench-design.md)：差异表、SW01–SW10、WB01–WB08、WD01–WD07、WT01–WT03。
- [当前工作台图 1](../references/2026-09-30-round1-workbench-current.png)：2460×1498 像素，T0/单组合/净值；问题依据。
- [TradingView 图 2](../references/2026-09-30-round1-tradingview-reference.png)：2864×1662 像素；图下红框回放条、工具带和连续分区；风格参考，不授权买卖下单或全套工具移植。两图 CSS 视口/缩放/DPR 未知。
- [覆盖矩阵](../DESIGN-COVERAGE.md#稳定工作台反馈2026-09-30)：SW-C01–SW-C12，逐项参考和证据计划；[原桌面状态契约](../../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)：DD06/DD09/DD11/DD15。
- [09 策略库模型](09-strategy-library-interaction-model.md)、[TradeReview 风格基线](../screenshots/creation-baseline-1440.jpg)、[v2 原技术验收](../../strategy-desktop-ux-v2/FINAL-ACCEPTANCE.md)。
- [当前拆票标准](../../../docs/agents/task-decomposition.md)、[UI 模板](../../../docs/agents/ui-task-templates.md)。

## Blocked by

None（共同设计已写入IF01–10；实际融合画板及状态接线尚未验证，不能据文档整合自动解除下游10的既有依赖）。

## 验收标准与反例

- [ ] 先给出截图可见差异、借鉴项及非目标，区分观察与推断；反例：仅换配色或把静态截图当成抖动根因证明。证据：差异表和模型说明。
- [ ] 在两档桌面给出 WB01–WB08 的固定分区、密度/主次层级、主图最小高度、控件槽位与滚动归属；反例：只展示一张运行画面或把全部内容塞进首屏。证据：各状态低保真图。
- [ ] 待开始→播放/暂停→回看→返回最新→完成→结果/比较→事件返回使用同一框架，日期、按钮显隐和错误不挤动主图；反例：播放按钮和结果入口反复搬位。证据：状态对照与后续 WT-A–WT-D 测量计划。
- [ ] 空持仓、无事件、加载、长策略名、六个组合、大金额、失败/重试均有可读模型与恢复动作；反例：靠裁切错误或缩小关键字维持高度。证据：状态表。
- [ ] 保留 V/M/Mᵢ/R、共同有效截止、图表视野、事件来源返回、未来暴露记录和输入/IME 守卫；结果点事件进入整个事件日观察投影，关闭详情仍停该日；回早期日/切组合的占位不能短暂漏未来或串身份。反例：只换检查区而主图仍截至R、隐藏页面响应播放。证据：动作/可见性表与 WT-C/WT-E/WT-F。
- [ ] 日期/播放/单步/速度/返回最新有清晰语义、可读名称、焦点和禁用原因；“展开剩余”及取消仍可达。反例：复制参考图图标却没有对应业务行为。证据：控件状态表。
- [ ] 验证事件抽屉从420–480px覆盖式改为320px检查区的候选方案：原因、可知依据、旧/目标/实际权重、成交/未成交和费用均可读，关闭与返回来源分开。反例：只为固定宽度删掉解释字段。证据：两档详情模型与替代决策。
- [x] 与09对齐导航锚点及策略身份的设计契约；配置查看不覆盖运行，复制策略与派生实验分清。证据：[融合规格IF01–08](../../../docs/specs/2026-09-30-strategy-workbench-v1-integrated-design.md)。此项仅接受文档对齐，融合后的实际导航/状态/视觉仍NOT VERIFIED。
- [ ] 用户真实反馈与选定/修改理由保存到独立 resolution；批准的布局、参考与授权偏差写入覆盖矩阵，再交 05/06 制作和验收原型。反例：生成本规格就将模型票关闭。

## 验收证据

- 用户要求与“策略工作台迭代V1”融合，已形成[共同设计及映射](../v1-integration/README.md)。独立设计一致性审查和本轮文档验收单独记录；不以源画板局部PASS代替融合实际旅程、持久化或视觉验收。
- 本轮设计文档发布与引用核对：[规格检查记录](../strategy-library-spec-verification.md)，只证明文档交付。
- [可点击视觉画板](../workbench-design/README.md)已交付；两档布局、有限模型操作及独立截图复验见[检查记录](../workbench-design/ACCEPTANCE.md)。用户现已选择 A；[第二轮独立评审](../workbench-design/REVIEW-02.md)的 UR01–08 已在独立工作台原型中修复，逐项证据与限制见[第三轮验收记录](../workbench-design/REPAIR-03-ACCEPTANCE.md)和[修复记录](../comments/strategy-visual-11/2026-09-30-a-repair-resolution.md)。09导航的共同设计已合并，实际共享导航和状态链仍NOT VERIFIED；正式产品图表/完整持久化仍由05/06/10承接。
- 本票真实引擎/数据库/UI 实现：NOT APPLICABLE，范围为模型文档；不豁免下游真实图表和正式持久化。
- 协调者接受：接受本轮供反馈画板，未接受整票关闭；完成后在 `comments/strategy-visual-11/` 保存独立 resolution 并链接。

## 派发说明

本轮仅发布。领取后主协调者负责模型与整页视觉，允许编辑本票、模型文档、草图和相关覆盖行；不得在模型未收敛时改应用代码。进入下游实现前指定唯一整页视觉 owner、完整会话数据流 owner 和未参与 UI 实现的视觉审查者，绑定确切画板、文件范围与证据位置。

可量化稳定性采用 WT02：同视口非预期框架位移目标 ≤1 CSS px；主动 resize/展开和跨内容类型有明确例外。后续真实浏览器同时记录过渡帧与最终几何，不用两张静态图或 CLS 单项代替。遵循默认实现模型与先最小真实图表旅程后扩展的项目流程。

## 历史

- 2026-09-30：用户提供工作台和 TradingView 截图，要求先比较再沉淀设计，发布本票 open / ready-for-agent；未视为新布局已批准或已实现。
- 2026-09-30：用户要求“开始进行工作台的视觉交互设计”，root 领取。制作独立可点击设计稿用于布局/状态评审；不改应用代码。交付契约见 [本轮画板说明](../workbench-design/README.md)，用户选择仍待反馈。

- 2026-09-30：A/B/C可点击设计画板交付，推荐A；独立视觉复验通过所列截图范围，模型关键路径已在两档桌面检查。保持open / integration-pending，等待用户选型及09共享导航合并；没有批准resolution或生产代码变更。

- 2026-09-30：用户选择 A 并要求独立 UI/动线评审。记录[部分决定](../comments/strategy-visual-11/2026-09-30-a-selection-and-clarity-review.md)与[UR01–08](../workbench-design/REVIEW-02.md)，两名独立审阅者及 root 复现确认图表/语义问题；状态改为 open / acceptance-failed。修订和复验未完成，不能关闭本票；本轮只写评审记录。

- 2026-09-30：用户“确认先修复上述问题”，授权A原型 UR01–08 修订，当前进入 in-progress。按 [第三轮契约](../workbench-design/REPAIR-03-CONTRACT.md)先验收真实图表最小旅程，再扩展控件/模式；历史FAIL保留，09与生产集成不在本轮修复范围。
- 2026-09-30：第三轮桌面修复由 root 完成整合并通过真实浏览器旅程；repair_acceptance_review 作为未参与实现的视觉复核者通过 UR01–08 的桌面原型范围。状态保持 open / integration-pending：持仓/现金汇总补充复核已通过，09 共享导航、正式产品实现、隔离持久化和首次用户任务研究仍待完成。

- 2026-09-30：用户要求再做一轮原站风格修复，ST01–05 进入 in-progress；依据 [第四轮契约](../workbench-design/STYLE-04-CONTRACT.md)统一主题/控件/品牌，保持 A 几何和第三轮行为。历史验收保留，本轮视觉及回归尚待验证。

- 2026-09-30：第四轮 ST01–05 原站风格修复通过：统一主题、字体、品牌、图表与主次动作；root真实浏览器回归和original_style_audit直接看图分别通过。见[第四轮验收](../workbench-design/STYLE-04-ACCEPTANCE.md)与[修复决定](../comments/strategy-visual-11/2026-09-30-original-style-repair.md)。本票恢复open / integration-pending，09共享导航、生产实现及首次用户研究未据此关闭。

- 2026-09-30：用户要求“这里的设计内容与‘策略工作台迭代V1’当前的设计进行融合”。建立IF01–10共同规格、独立审查及覆盖表，修正旧关系图中库直达创建和旧尺寸当前态。共享导航/策略版本/确认交接/返回来源完成设计对齐；09/11仍open，实际融合及首次用户研究未验收，10保留既有依赖。见[V1融合决定](../comments/strategy-visual-11/2026-09-30-v1-design-integration.md)。
