# 规划范围与设计覆盖

本轮是文档建图，新增UI元素为无，UI/数据库验收NOT APPLICABLE（没有产品修改或操作）。下表中的规划编号不是设计元素ID；所有未来产品证据目前NOT VERIFIED。实施前必须将批准方案展开为原始元素/控件逐项矩阵，不能以本表代替。

整页体验与集成负责人：主协调者。未来整页视觉负责人和完整数据/持久化负责人由启动/实验选择问题指定；独立视觉审查者不得是被审UI的实现者。未领取的决策票不能把审查者视为实施负责人。

| 规划要求 | 精确依据与用户旅程 | 决策责任及落点 | 本轮/后续证据 |
| --- | --- | --- | --- |
| 一秒边界与完整首屏 | [地图Notes用户回答](issues/00-map.md)；[V2.5布局chapter-HP11及视口](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:40)；直接冷/热打开、重启首读、写后首开 | 主协调者＋用户，[验收数据与判据](issues/01-acceptance-matrix.md) | 本轮保留原话与流程；未来逐次导航/真实paint及输入证据 |
| 可比环境与非零金样 | [旧样本entry/group边界](../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md:110)、[旧脚本边界](../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:15)；相同输入比较 | 基线采集者待领取，协调者独立接受；[生产基线](issues/02-comparable-baseline.md) | 版本/数据/设备/缓存清单、可运行判定及独立核算，未来NOT VERIFIED |
| 金额、缺失与时间语义 | [chapter-HP02期间公式及持仓独立](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md:191)、[来源约束](../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:60)；期间切换、跨年、缺FX/行情 | 用户＋协调者，[读模型与新鲜度合同](issues/03-read-contract.md) | 输入/输出/失效矩阵、逐笔业务金样、既有正确领域对照；未来NOT VERIFIED |
| 首页启动与必要交易库接线 | [当前入口](../../app/home/page.tsx)、[工作区读取](../../app/components/trade-review-workspace.tsx:2233)、[交易库规范](../../docs/design-system/baselines/2026-10-22-trading-library-v1.0/source/visual-design.candidate.md)；首页→交易库→返回/刷新 | 用户＋协调者，[启动隔离边界](issues/04-startup-boundary.md) | 依赖图、导航/代际合同、完整控件旅程；未来NOT VERIFIED |
| 原始桌面设计保真 | [主页1440](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1440.svg)、[主页1280](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-1280.svg)、[展开1440](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-history-1440.svg)、[展开1280](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images/home-history-1280.svg)、[公共手册](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/source/component-manual.html)；1440×1000/1280×800、100%与相关状态 | 整页视觉负责人待指定，非实现者审图，协调者接受；[纵向实验](issues/06-vertical-prototype.md) | 本轮无视觉变更或授权偏差；未来匹配状态截图/几何/控件登记 |
| 版本发布、写后读与恢复 | [来源读模型约束](../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:60)；导入/同数量修订/删除→提交→返回→reload，构建中写入 | 完整数据负责人待指定，协调者贯通接受；[合同](issues/03-read-contract.md)及[实验](issues/06-vertical-prototype.md) | 状态机、revision及时间证据、真实隔离库持久化、总等待；未来NOT VERIFIED |
| 旧暂停、失败和独立门槛 | [最新整体验收](../homepage-v25-implementation/FINAL-ACCEPTANCE.md)、[Bars第三轮](../homepage-v25-implementation/evidence/P4/bars/ROOT-ACCEPTANCE-3.md)；历史not-wired、财务超时、错误恢复 | 用户决定授权，协调者执行上限；[实验选择](issues/05-experiment-choice.md) | 历史局部PASS/整页FAIL保持；暂停计数不重置，未来恢复须原话证据 |
| 证据支持的正式迭代 | [A/B/C比较](../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:50)、[任务拆解规范](../../docs/agents/task-decomposition.md)；最小旅程成功或反证后的投入选择 | 用户＋协调者，[正式迭代选择](issues/07-iteration-choice.md) | 独立Resolution＋随后批准的实现计划；当前未选方案、未授权产品迭代 |

准确元素拆分以原始正文的实际标识为准，以上概括不新增或修改规范。原研究的阶段预算只是建议；功能、状态安全、视觉与性能分别通过，不相互抵消。

控件最新分镜还须读取[第四轮原型](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/prototypes/round4/index.html)及[第五轮原型](../../docs/design-system/baselines/2026-10-22-homepage-v2.5/prototypes/round5/index.html)，与正文和整页原图共同作为实现依据；原型存在不证明真实功能或持久化已经接通。
