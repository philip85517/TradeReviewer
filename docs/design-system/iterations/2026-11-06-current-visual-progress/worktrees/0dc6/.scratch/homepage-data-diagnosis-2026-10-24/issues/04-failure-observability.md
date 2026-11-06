# 04 — 失败状态与异常原因不够明确

ID: homepage-data-finding-04
State: open
Status: diagnosis-confirmed / repair-not-started
Assignee: unassigned
集成负责人: root

## Scope / What to build

记录失败终态误导和异常可观测性缺口；本次未实施修复，没有产品候选轮次。

## Refs

- [D04](../DESIGN-COVERAGE.md)、[诊断第4节](../DIAGNOSIS.md)、[桌面审计](../CONTROL-AUDIT.md)
- homepage-source/route.ts、bootstrap/route.ts、sqlite-http-client.ts:161、use-homepage-host.ts:216、period-surface.tsx:62、home-surface.tsx:331。

## Blocked by

后续独立UI/日志实施尚未派发；若涉及财务语义或执行管线，仍受原暂停约束。

## 验收标准与反例（尚未修复）

- [ ] loading/timeout/unknown/成功空态/not-wired可区分，首读失败不暗示“没有导入”。
- [ ] requestId/阶段/耗时/规模/错误cause可关联，日志不包含完整账号、金额或原始载荷。
- [ ] 晚到异常、协议校验失败、来源诊断可追溯；不泄漏旧请求覆盖新范围。
- [ ] 真实桌面失败/重试/取消反例及空间对照；不把按钮存在当功能通过。

## 当前证据/状态

当前timeout后仍“期间数据读取中”与“当前范围暂无持仓”；[截图](../home-warm-desktop.jpg)。console为空、server仅启动日志不是没有异常的证据。catch丢cause为静态确认风险；本次未捕获真实throw，保持这一区别。产品状态FAIL，修复NOT VERIFIED。
