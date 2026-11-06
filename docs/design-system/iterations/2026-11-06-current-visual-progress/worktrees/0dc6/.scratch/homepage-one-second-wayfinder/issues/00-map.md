# 首页一秒打开优化与验证决策地图

ID: homepage-one-second-map
Labels: wayfinder:map
State: open
Status: charted
Assignee: unassigned
集成负责人: 主协调者

## Destination

在已确认的一秒目标与 V2.5 首页设计下，明确优化候选的合同、启动边界、可证伪实验及验收流程，最终依据证据共同选定首轮正式优化迭代。终点是实施路线可准确派发，不是本次完成产品优化。

## Notes

- 既有范围：首页 V2.5 与先由首页采用的共享规范，含必要交易库进入/返回；本地图聚焦此范围的打开性能，不扩大为交易库内部改版。相关上层努力是[V2.5 首页代码设计决策地图](../../homepage-v25-wayfinder/issues/00-map.md)，其历史状态保持不变。
- 用户本次原话答复“采用建议边界”：本地业务数据齐备时，完整真实首屏≤1000ms，覆盖浏览器冷/热、服务重启后首读、导入或修订后首次打开。进程启动与外部行情/FX补齐单独计时。导航后发生的编译、内部投影缺失/重建仍计入导航；不能将内部缓存缺失改称外部数据未齐备。导入及预计算的总等待也必须报告。
- “首页就绪”采用根[领域语言](../../../CONTEXT.md)；首屏内容不能通过隐藏曲线、持仓或关键控件缩减。unknown、旧值、骨架、快速错误、空业务样本均不能代替完整数据成功。
- 输入为[可行性分析](../../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md)和[完整桌面漏斗](../../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md)。基线 HEAD `58bf0d90e68ddc634de180b3f5c3d16a089f0eb3` 加现有 dirty 工作树，不能只用 commit 标识候选；原开发插桩单样本用于定位，不充当生产基线。A/B/C只是候选，尚无架构选择。
- [既有最终接受](../../homepage-v25-implementation/FINAL-ACCEPTANCE.md)保留：财务纯模块48控制＋9样本局部PASS；整页FAIL，真实非零业务链仍需验证；P1/F07和Bars已3/3暂停。建图及研究不重置轮次、不自动恢复。后续实验授权和正式实施授权分别记录。
- [验证路线](../VALIDATION-ROUTE.md)和[设计覆盖](../DESIGN-COVERAGE.md)为待决流程草案；用户已确认的总门槛不能被阶段预算、p95或实验局部通过替代。每个候选任务仍由主协调者独立验收，最多3轮，超限暂停并保留失败原因；旧任务继承原计数。
- 每次先读 wayfinder、[本地跟踪](../../../docs/agents/issue-tracker.md)、[拆票标准](../../../docs/agents/task-decomposition.md)；HITL采用 grilling/domain-modeling，模块边界采用 codebase-design。后续故障先按 systematic-debugging/diagnosing-bugs统一诊断；实施另遵循[开发流程](../../../docs/agents/development-workflow.md)与[前端审计规范](../../../docs/agents/frontend-control-audit.md)。当前模型偏好 GPT-6 Astra Ultra，协调者独立接受。
- 只建图：所有子票 open/unassigned，无 Resolution；下一会话查询 frontier 后先领取一票，HITL必须有用户真实交流，一次最多解决一张非研究票。没有外部知识缺口，未设 research 票，也不重新执行旧诊断。
- 本地以 Parent 和命名 Blocked by 链接表示关系；全部 issue 创建后再接依赖。查询 `python3 .scratch/homepage-one-second-wayfinder/frontier.py`，可加 `--all` / `--mermaid`；地图不维护第二份开放任务列表。

## Decisions so far

<!-- 建图会话不领取、不解决子票；已确认目标属于 Notes，不伪造关闭记录。 -->

## Not yet specified

- 最小实验暴露的具体重建或组合瓶颈，可能要求进一步选择增量粒度、检查点或组合策略；目前不预先指定数据表、完整缓存键和所有范围的预计算方案。
- 非零金样与真实旅程可能揭示新的输入缺口或设计矛盾；以具体反例形成后续问题，不能把原先已知失败藏进此处。
- 若最终选择不足以满足已确认门槛，再由用户决定投入、修订范围或停止；当前不编造速度、工期或资源承诺。

## Out of scope

- 本次产品代码实现、服务/浏览器/数据库操作、正式优化交付、推送/合并/部署。
- 绕过已暂停任务、借改名自动获得第四轮；改动业务原始数据。
- 交易库 V1.0 内部完整改版、全站页面性能保证、新增窄屏或触屏设计；必要进入/返回链路仍须回归。
- 改动已批准金额公式、费用/FX/时区语义、持仓C方案、24px徽章或既有信息层级以换速度。
- 以更换 SQLite、前端框架或行情供应商为预设；当前证据没有支持这种前提。
