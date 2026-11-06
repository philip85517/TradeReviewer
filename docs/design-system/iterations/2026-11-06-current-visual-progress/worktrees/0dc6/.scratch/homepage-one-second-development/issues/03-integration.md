# 03 独立集成验收

后续[数据差异系统诊断](../../homepage-data-diagnosis-2026-10-24/DIAGNOSIS.md)已完成，产品未修复，无新产品候选，本票仍1/3。同C4全市场1440×1000首页两次终止于timeout；此前A股来源警告观察仍按原状态保留。接口同源且结构通过，但1784笔未知性质的首页/旧库分类不同，财务来源与完整加载链仍未通过。失败状态和异常日志缺口另行登记，未恢复财务/Bars。

State: open
Status: incomplete
Assignee: root
集成负责人: root
Blocked by: 完整财务数据、范围往返和正常数据视觉未通过；P1/F07与Bars按用户决定暂停
验收轮次: 1/3（一次集成验收，不将多次构建当新候选）

## What to build / Scope

无独立产品修改。按PLAN Task03与DESIGN-COVERAGE串行构建、定向回归、隔离生产实测；给出真实一秒差距，不掩盖原财务及Bars暂停。

## Refs

../PLAN.md；../DESIGN-COVERAGE.md；../../homepage-one-second-wayfinder/VALIDATION-ROUTE.md。

- [x] C4源清单884文件无后续变化、构建PASS、6文件128测试PASS；全局tsc保留与baseline相同8错误FAIL。
- [x] C4桌面真实浏览器、PID60461、Node26、4392、显式隔离DB及实际句柄、资源URL→dist hash绑定；导入持久化与返回/重载PASS。
- [ ] 完整首屏：baseline/C2 timeout；C4当前源证据警告、金额未知、曲线不可用。冷/热/重启/写后完整非零首屏均未取得合格计时，不能PASS；整体≤1s门槛FAIL。
- [x] Task01 2/3接受，Task02 2/3部分验证，Task04 2/3接受；原暂停3/3不重置。README/设计覆盖/最终验收同步。

最终 [FINAL-ACCEPTANCE.md](../FINAL-ACCEPTANCE.md)。本票不因构建/局部性能通过关闭，也不继续执行用户保持暂停的财务优化。

Sol 6.1 Ultra续验：[root记录](../evidence/continuation-2026-10-24/ROOT-ACCEPTANCE.md)、[版本化覆盖表](../evidence/continuation-2026-10-24/CONTROL-AUDIT.md)。同C4的884源码/272 dist未变，未重跑产品构建/回归测试，无新产品候选，仍1/3；合成fixture另有诊断CLI校验/渲染。解析器真实桌面格式/等待/失败/刷新恢复和首页入口到预览已补证；焦点返回FAIL，真实取消/替换竞态、完整首页仍未接受。1868笔executions逐列不变。独立扫描未发现批准范围内尚未实施的独立产品优化；共享焦点方案仅记录。P1/F07/Bars仍paused3/3，不重置或绕过。
