# 首轮原型设计覆盖

原始来源：[规格](../../docs/specs/2026-09-29-strategy-portfolio-backtesting.md)；[视觉/场景契约](visual-contract.md)。本表只覆盖首轮信息结构原型；R01–R06 后端行为及详细创建/工作台/比较问题留在后续票，不代表整功能覆盖已完成。无批准画板，本次生成候选画面；截图在浏览器验收时保存。

| 需求/元素 | 交付区域 | 阶段/浏览器动作 | 预期及反例 | owner/任务 | 参考 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R01/S01 | 应用导航/实验列表 | 打开入口/返回重开 | 合成集合来源可见，不读正式库 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R02/S03–S04 | 创建/预览 | 选时间策略并预览 | 区分候选目标和已持仓，未来隐藏 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R03/S05 | 播放/主图 | 下一日、播放暂停至终点 | 图形随游标实际揭示，末尾有反馈 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R04/S06 | 调仓事件 | 查看第五日事件 | 目标与实际调整可解释，无人工批准 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R05/S07 | 结果/对比 | 查看结果并切第二组合 | 展示演示净值差异并可返回 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| R06/S02 | 策略包 | 切包/查看规则 | 完整策略说明，不做条件搭建器 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| S08 | 返回/恢复 | 离开列表再打开 | 仅内存恢复清楚标注，刷新重置 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |
| A/B | 布局/切换器 | URL切换、键盘、窄屏 | 结构不同，输入不误切方案 | Luna 实现 / 主协调者验收；主导航与操作顺序 | visual-contract.md；无既有画板 | prototype-acceptance.md / screenshots | PASS (prototype only) |

## 用户选择后的追加要求

| 需求/元素 | 范围 | 参考与责任 | 验收 | 状态 |
| --- | --- | --- | --- | --- |
| V01：兼容现有 TradeReview 设计风格 | 当前 A 和后续创建、运行、结果原型及正式页面 | [用户追加约束](comments/strategy-visual-03/2026-09-29-resolution.md#用户追加约束与现有-tradereview-风格兼容)；后续主协调者负责整页一致性，派发前绑定实现者 | 匹配视口直接对照现有应用框架、组件、密度与关键状态；既有 PASS 不代替此项 | 本轮创建页PASS；后续运行/结果仍待验收 |

## 第二轮创建原型覆盖（派发前）

准确来源与逐项交互见 [创建契约](creation-visual-contract.md)。未批准像素画板；现有应用截图为视觉参考。

| ID | 规格/参考 | owner | 旅程/预期与反例 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| C01 | S01/S08；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 列表新建→回退→重开；内存草稿可达 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C02 | S03/D03；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 输入日期时间→盘中/周末截止；不偷用完整未来日线 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C03 | R02/D03；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 盲看切换→截止说明；创建不泄漏未来 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C04 | R01/R03/S03；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 数据集合/本金/五档期限→摘要同步 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C05 | R06/S02/D04；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 规则说明/多选/调仓预设→两个独立组合 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C06 | S02/D02；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 缺必需数据→包禁用，其他包可用 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C07 | S03/D02；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 部分覆盖→显式确认→修改后撤销 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C08 | S04/D03；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 候选与目标/实际分离→可知依据/金额 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C09 | S04；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 无候选→现金100%→创建 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| C10 | S03/S04；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 编辑→失效旧预览→创建→重开 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| V01 | 用户风格约束/creation-baseline-1440.jpg；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 同视口与现有应用框架/密度对比 | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |
| V02 | 创建契约；creation-visual-contract.md 对应行 | Luna实现/主协调者整页验收 | 1440/1280/1059/1060/390布局与CTA | creation-acceptance.md + screenshots/creation-* | PASS（prototype only，用户待反馈） |

## 回测工作台第一切片（派发前）

| ID | 来源与参考 | owner/组件 | 旅程及反例 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| W01 | running-visual-contract.md W01；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 准备页开始→运行T0；配置不得丢失 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W02 | running-visual-contract.md W02；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 逐日/播放/末尾；新增真实bar可见 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W03 | running-visual-contract.md W03；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration（TSX）+ creation_visual（CSS）；主协调者独立验收 | 主图切换与1440/1280/390视觉；控件常驻 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W04 | running-visual-contract.md W04；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 首次/周期调仓/hold/现金；资金账本守恒 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W05 | running-visual-contract.md W05；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 双游标回看恢复/事件定位；不漏未来 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |
| W06 | running-visual-contract.md W06；规格S05/S06/S08与D03；creation-baseline-1440.jpg及creation-preview-1280-final.jpg | running_integration / running-prototype与creation接线；主协调者独立验收 | 列表重开/配置失效/刷新；仅内存 | running-acceptance.md / screenshots/running-* | PASS（prototype only，用户待反馈） |

## 桌面 UX v2 提案覆盖（文档阶段，未派发）

依据：[设计方案](../../docs/specs/2026-09-29-strategy-desktop-ux-design.md)，评审 D01–D10；用户明确排除 D11 窄屏，并确认完整桌面旅程验收。既有 PASS 仅证明旧原型状态，不证明新提案。所有实现 owner 未分派；文档协调者为 Codex。后续派发前按实际批准画面补齐准确行号/状态截图和单一 owner，不能拿本表摘要代替正文。

共同参考：screenshots/creation-baseline-1440.jpg 为既有风格，screenshots/design-review-running-1440.jpg 为旧运行问题定位；两者都不是新布局批准画板。新设计适用视口只含 1440×900、1280×800。

| 需求/元素 | 精确规格章节 | 所属旅程/可观察结果与反例 | 后续设计任务/owner | 验收依据与证据状态 |
| --- | --- | --- | --- | --- |
| UX01 / E01–E02 | DD01、DD05、DD10 | 切组合同日联动，不共享本金、不残留旧事件 | 工作台/比较；owner未分派 | T01/T04/T08；NOT VERIFIED |
| UX02 / E03、E05–E06 | DD02、DD05、DD12 | 默认净值、摘要、持仓变化；T0不伪造收益日 | 工作台；owner未分派 | T03/T04/T12；NOT VERIFIED |
| UX03 / E04–E05 | DD06 | 推进→回看→返回最新；新bar可见，不泄漏未来轴/事件 | 工作台；owner未分派 | T03/T05/T06；NOT VERIFIED |
| UX04 / E01、E04、E12 | DD07、DD10–DD11 | 快速展开取消/中断、编辑派生、原实验重开 | 工作台；owner未分派 | T07/T08/T11；NOT VERIFIED |
| UX05 / E07–E08 | DD08–DD09、DD12 | 结果→比较→事件回看→返回来源；部分数据不伪装完整 | 比较结果；owner未分派 | T09/T10；NOT VERIFIED |
| UX06 / E09 | DD03 | 四步创建→待开始，按钮语义一致、回退输入保留 | 创建收敛/完整交接；owner未分派 | T01/T02/T12；NOT VERIFIED |
| UX07 / E10 | DD04 | 显式多选→预设→规则详情；未选预设不可编辑 | 创建收敛；owner未分派 | T01/T02/T12；NOT VERIFIED |
| UX08 / E11 | DD04 | 入选/规则不符/数据不足分组，目标/实际分离 | 创建收敛；owner未分派 | T01/T02；NOT VERIFIED |
| UX09 / E01–E12 | DD02、DD13 | 两档桌面五种运行状态及创建/结果；键盘焦点和数字颜色一致 | 整页视觉；owner未分派 | T12；NOT VERIFIED |
| UX10 / E12 | DD14 | 原型标签常驻、工具折叠、关键缺失就近可见 | 全流程；owner未分派 | T02/T11/T12；NOT VERIFIED |
| 跨区域接口/完整状态 | DD06、DD09–DD11、DD15 | V/M/Mᵢ/R和返回来源一致；失败组合不能延伸旧持仓 | 完整会话接线；owner未分派 | T01–T12；NOT VERIFIED |

本轮文档核对见 desktop-spec-verification.md；产品数据库验证不适用于本次文档交付，正式功能要求未撤销。窄屏本轮明确 OUT OF SCOPE，不新增改版或专项验收。
