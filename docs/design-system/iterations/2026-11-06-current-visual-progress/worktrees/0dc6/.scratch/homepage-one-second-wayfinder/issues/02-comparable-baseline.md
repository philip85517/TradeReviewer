# 建立同源可比的生产导航基线与非零对照

ID: homepage-one-second-comparable-baseline
Labels: wayfinder:task
Parent: [首页一秒打开优化与验证决策地图](00-map.md)
Mode: AFK
State: open
Status: ready-for-agent
Assignee: unassigned
集成负责人: 主协调者
Resolution comment: 尚无

## Question

怎样取得可与未来候选比较、能随产品代码变化而红绿变化的真实导航基线？本票只完成决策所需的测量准备与事实采集，不优化产品。

## Scope

- 按已冻结矩阵建立生产预构建主基线；开发冷编译/HMR单列解释。不能把开发到生产环境切换收益全部算作代码优化。
- 固定现有 dirty 文件清单及内容哈希、Node/SQLite/算法版本、浏览器/视口/硬件、数据规模和缓存状态；缺少必测非零样本则NOT VERIFIED，不伪造通过。
- 使用显式 `TRADEREVIEW_DB_PATH` 的隔离 WAL 一致副本及自有空闲端口，绝不请求旧3333服务或写业务库；业务库仅允许为取得副本进行已授权的一致性备份读取，也可使用已有冻结副本。测试服务及所有测试写操作均指向隔离副本，按当前配置与启动脚本操作。
- 测量导航→成功数据paint/交互；失败基线也保留完整阶段、请求数、字节数、版本关联及缺失原因。未插桩计总时长，受控插桩用于归因，比较开销。
- 为后续候选留下同一可运行旅程与判定脚本；不重复做外部研究，也不通过修复基线故障消耗暂停任务轮次。

## Refs

- [验证路线](../VALIDATION-ROUTE.md)；[历史完整漏斗](../../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md)。
- [旧检查器只重放保存事件](../../homepage-one-second-feasibility-2026-10-24/FEASIBILITY.md:15)。
- [开发流程](../../../docs/agents/development-workflow.md)、[配置优先级](../../../conf/README.md)、[原生运行时](../../../conf/native-environment.json)。

## Blocked by

- [验收数据、首屏完成判据与采样矩阵如何冻结](01-acceptance-matrix.md)

## 验收标准

- [ ] 真正运行当前候选的生产导航，包含冷/热、重启首读、写后首开等适用场景；未能执行的项逐项NOT VERIFIED。
- [ ] 保存环境/源码/数据清单、未插桩逐次值、失败原始trace及非零业务对照，当前路径慢或错不妨碍基线事实接受。
- [ ] 协调者独立执行至少一条已冻结旅程，核对探针能区分真实成功、错误和旧数据。
- [ ] 证据区分一致性备份读取、隔离服务访问及测试写入，业务库无测试写入；独立Resolution准确区分“基线准备完成”和“产品达标”。

## 反例与证据

只执行旧JSON检查器、只测API/纯模块、不同数据/缓存状态比较、把异代span拼成一个样本，均拒绝。发现新问题先记录，不在此票顺手修复。
