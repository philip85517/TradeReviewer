# 独立核对整页控件、视觉和关键断点

ID: TL20-I19
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: root
Owner role: VISUAL-REVIEWER
Priority: P1

## Scope / What to build

冻结最终版本与隔离数据→DOM/AX/source全量登记→真实鼠标/键盘及适用触控→点击前中后→逐图同态对照→复验差异。

- 未实现所审UI的审查者直接打开参考和真实截图；1440×1000/1280×800四主态、长页/下钻/异常及关键断点两侧都比；回放按其规格补1440×900、约390px与真实手机键盘。
- 按CONTROL-INVENTORY完整枚举所有菜单选项、条件窗口、重复行/图点/分布区间及页码；覆盖与通过分别报告，未执行/工具不足保留NOT VERIFIED。
- 逐项检查布局/层级/密度/数值表头字形右缘/颜色/命中盒/tooltip边缘及焦点、点击前中后rect与下游scroll；重大差距不能被总分抵消。
- 发现设计待补回wayfinder；实现故障开独立finding交唯一owner修复，再对最终版本复验；审计票不自行改产品。

本票是独立开发任务，不是wayfinder决策子票。ready-for-agent表示范围已描述；所有依赖accepted且closed、具体接口/待决交互冻结后才能领取，禁止实现者填补业务政策。局部接受不代表功能整体接受。

## Refs

- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L43–89
- [docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md)，L331–378
- [approved-e-live-list-1440.jpg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-live-list-1440.jpg)
- [approved-e-live-stats-1440.jpg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-live-stats-1440.jpg)
- [approved-e-sim-list-1440.jpg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-sim-list-1440.jpg)
- [approved-e-sim-stats-1440.jpg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/approved-e-sim-stats-1440.jpg)
- [journeys-date-1280.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/journeys-date-1280.svg)
- [hcr06-final-pending-library-1280.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/hcr06-final-pending-library-1280.svg)
- [08-extreme.svg](../../../docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/images/08-extreme.svg)
- [覆盖矩阵](../DESIGN-COVERAGE.md)中Owner为本票的各行；element/control ID为本轮规划本地ID，正文只有章节/文档stable-id，不能借用别的功能元素全集。
- [视觉契约](../visual-contract.md)、[接口与文件责任](../INTERFACES.md)、[回放转移契约](../REPLAY-STATE-CONTRACT.md)、[控件登记计划](../CONTROL-INVENTORY.md)。D03/D02等新增交互使用决策完成后批准的稿件，不拿不相干参考图代替。

## Blocked by

- [范围失败、迟到请求和缺失输入均可解释并恢复](18-failure-recovery.md)

## 实施与验证步骤

- [ ] 重新读完整原规格/准确状态图、相关矩阵行、所有依赖Resolution与契约；按生命周期领取唯一Assignee，冻结允许修改文件及实际类型签名。有新不明业务问题回决策票。
- [ ] 为 `full-control-inventory` 执行已定义场景并如实记录通过/失败/未验证：完整动态边界与分母冻结，非抽样；鼠标/键盘/模拟触控/物理触控分别记录。
- [ ] 为 `visual-reference-comparison` 执行已定义场景并如实记录通过/失败/未验证：同CSS视口/缩放/数据/阶段/导航匹配，E仅几何，V2数字语义优先；逐图差异均有结论。
- [ ] 为 `spatial-interaction-regression` 执行已定义场景并如实记录通过/失败/未验证：展开/长文/空/错误/候选取消与返回前中后测量，不以无overflow代替视觉一致。
- [ ] 在最终运行版本直接验证上述旅程；本票不修改产品，缺陷另建票交对应owner修复再复验。
- [ ] 执行定向检查：`python3 .scratch/trading-library-v20-development/frontier.py --validate（仅任务结构）；产品检查必须另附真实浏览器日志/截图，脚本不证明控件通过`；实现任务保留失败到通过日志，审计/接受任务保留实际操作证据，不用结构验证代替产品。
- [ ] 显式隔离库，真实操作本票旅程及取消/失败/返回/reload；前端按CONTROL-INVENTORY登记动态实例并记录点击前中后空间/状态链；无写入部分说明范围依据。
- [ ] 非实现者直接看参考与同状态渲染图，协调者独立复核后记录各门槛。检查受影响上游/下游，失败保留并交回owner。

## 验收标准与反例

- [ ] 完整动态边界与分母冻结，非抽样；鼠标/键盘/模拟触控/物理触控分别记录；证据记录在本票独立报告内。
- [ ] 同CSS视口/缩放/数据/阶段/导航匹配，E仅几何，V2数字语义优先；逐图差异均有结论；证据记录在本票独立报告内。
- [ ] 展开/长文/空/错误/候选取消与返回前中后测量，不以无overflow代替视觉一致；证据记录在本票独立报告内。
- [ ] 控件检查触发：本票影响/检查前端；范围：全交易库四主态及两详情链，入口/首页返回影响面；不扩成无关分析/数据/策略整页重做。
- [ ] 不引入未批准的尺寸、默认折叠/阶段、阈值、行情来源或账户默认；无用户授权差异。
- [ ] 参考与渲染版本、CSS视口/缩放/DPR/状态/数据可比；功能、端到端和视觉分别签结论，不以单测/回调/HTTP成功替代。

## 派发说明

- 本轮没有派发执行。独立审查者必须与所审实现者不同；最终集成接受由root亲自完成，不能委托worker代签。本票为独立审查，执行人不得是所审UI实现者。
- 候选文件范围（技术落点，非产品需求；派发前按契约核实并锁定）：
- `.scratch/trading-library-v20-development/CONTROL-INVENTORY.md`
- `.scratch/trading-library-v20-development/DESIGN-COVERAGE.md`
- `.scratch/trading-library-v20-development/evidence/visual/（未来证据）`
- `.scratch/trading-library-v20-development/issues/（未来finding独立建票）`
- 输入/输出与接线：只读产品；VISUAL-REVIEWER输出版本绑定的controls/verification/findings/space表与并排截图，INTEGRATOR接缺陷，owner修复后审查者重新看图。
- 共享文件只由INTERFACES指定owner写；跨owner变更交接给owner，不能并行覆盖。完整页视觉owner为root；完整持久化流owner为DATA；角色未落实到具体受领人前不得执行。
- 禁止：写业务库、变更conf绝对业务库/端口、静默合并/删除人工成果、将mock图/fixture当真实验收、push/merge/publish、擅自扩大或再派子代理。

## 验收证据

独立控件/视觉 NOT VERIFIED；本票只读产品，写入验收由最终集成票负责。 未来报告位置：`../evidence/I19/report.md`，每个勾选链接实际日志/截图/持久化重读结果。报告头包含commit/dirty内容manifest、worktree、时间、服务URL/会话、显式隔离库、数据范围、CSS视口/缩放/DPR、输入方式和排除依据。该目录尚未产生证据。

协调者接受：尚未接受。回归须保留旧证据，重开本票并同步README、DESIGN-COVERAGE与FINAL-ACCEPTANCE。

## 历史

- 2026-10-26 拆票：open / ready-for-agent / unassigned；依赖未解除，未实施/未验收。
