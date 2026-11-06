# 01 — 核对首页与旧交易库的数据链

ID: homepage-data-diagnosis-01
State: closed
Status: accepted
Assignee: root
集成负责人: root

## Scope / What to build

只调查用户四项问题：数据库、解析协议、请求阻塞、隐藏异常；不实施产品修复，不恢复暂停任务。

## Refs

- 当前用户原文及 [DESIGN-COVERAGE D01–D04](../DESIGN-COVERAGE.md)
- [DIAGNOSIS](../DIAGNOSIS.md)、[控件规范](../../../docs/agents/frontend-control-audit.md)

## Blocked by

None。诊断不依赖恢复财务或Bars的实现。

## 验收标准与反例

- [x] 查实际PID/句柄及两接口同源；反例：不把验收副本当业务原库。[证据](../VERSION-AND-DATABASE.json)
- [x] 真实接口校验并比较新旧分类；反例：HTTP200不等于业务契约完整。[证据](../PROBE.json)
- [x] 真实桌面复现、区分接口耗时与整体截止；反例：不将历史dev数据说成当前production新测。[证据](../BROWSER.json)
- [x] 检查catch、来源诊断与UI；反例：console空不能排除异常。[诊断](../DIAGNOSIS.md)
- [x] 局部前端触发、范围、版本绑定、观察及未测项记录。[审计](../CONTROL-AUDIT.md)

## 验收证据

root于2026-10-24直接操作4392、1440×1000桌面，并运行实际API/领域探针1/1 PASS。该接受只针对调查完成，绝不代表首页修复、正常态视觉或1秒性能通过。没有产品变更、自测代验收或产品修复轮次。

## 历史

- 2026-10-24：调查完成；02–04产品问题保持open，原暂停记录不变。
