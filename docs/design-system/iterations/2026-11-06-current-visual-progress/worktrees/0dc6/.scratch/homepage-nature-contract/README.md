# 首页与交易库历史性质合同
State: closed
Status: accepted-scoped
Assignee: root
Round: 1/3（候选1通过；未进入第二轮）

范围与方案见[PLAN](PLAN.md)，原诊断见[02](../homepage-data-diagnosis-2026-10-24/issues/02-source-semantics.md)。
财务与Bars仍暂停；本票通过只代表性质协议，不代表完整首页/1秒目标。

已统一业务性质解析；1868笔真实来源中1778 live / 84 simulation / 6 unknown。764个历史回合的ID和成员全部保持，原始库未改写。独立执行18文件627测试通过、lint通过、build通过；全项目typecheck仍有8项既有recall测试错误。

- [最终验收及已知限制](FINAL-ACCEPTANCE.md)、[控件与视觉证据](CONTROL-AUDIT.md)
- [实现报告](evidence/IMPLEMENTATION.md)、[独立代码审查](evidence/REVIEW-independent.md)
- [桌面预览](http://127.0.0.1:4392/trades?scope=live&market=all&accounts=*&rangeMode=all)：隔离数据库，包含历史业务数据副本。服务保持运行。

服务停止后，在项目根目录执行 `./.scratch/homepage-nature-contract/START-PREVIEW.sh`，复用已验收构建及隔离库；不要对仍运行的4392重复启动。常规开发仍遵循项目`make dev`默认3333及新鲜备份规则。
