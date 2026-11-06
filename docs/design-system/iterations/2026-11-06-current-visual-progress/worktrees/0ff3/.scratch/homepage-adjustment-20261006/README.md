# 首页整体修复与验收 — 尚未完成

2026-10-07 01:02:51 Shanghai · State: open · Status: acceptance-failed · 协调者 /root

本轮已完成关联回归问题的有界修正：行情分通道发布、现金同scope pending与保存后晚读保护、原完整返回旅程的准确查询/测量预算，以及别名实际持久化等待和coverage类型边界。root 独立核对生产/测试 diff 并运行冻结版本，**九套182/182 PASS、完整typecheck PASS、scoped lint 0 errors / 15 warnings、diff PASS**。同生产源码的build与5项runtime PASS保留，之后仅两测试文件变化，未重新构建。它们均不能代替完整产品接受，也未声明最新全仓通过。

[当前验证记录](acceptance/complete-current-verification-report.md)、[最终验收状态](acceptance/FINAL-ACCEPTANCE.md)与[当前独立缺口审计](acceptance/current-product-gaps-readonly-audit.md)为当前结论。原FAIL/NV与[此前README完整快照](README-history-before-corrected-20261006T170251Z.md)保留，不把历史失败继续写成当前运行结果。

[隔离预览](http://127.0.0.1:3031/)于2026-10-07 11:11 Shanghai恢复为独立后台进程：starter PID26857、listener PID26873，当前worktree，显式隔离review.sqlite。root于11:13:01核对首页GET200/storageGET200及两份样式资源200、进程/DB和794源文件零漂移，见[恢复证据](acceptance/preview-service-restored-20261007T031301Z.json)与[输出日志](acceptance/preview-service-20261007T031131Z.log)。旧PID1850/session94643已失效；早先01:01/01:11的运行证据仅代表当时状态，具体退出原因未确定。**真实浏览器未验收**。手工前台启动：运行[脚本](start-preview.sh)并保持终端会话；当前后台实例无需再启动。默认共享业务库与3022不变；两库四表count/row hash与前后记录一致，不能代替实际保存回环。

剩余工作仍在原范围内：自动日/周/月采样、桶内缺口/成员/可信状态边界，趋势控件顺序与布局密度；现有2:1/单列CSS须通过内容宽断点、桌面/窄屏实际首屏图形验收。选币→真实曲线→历史点→同日持仓→返回当前尚未通过；依赖集成保留该门槛。准确回合实际SQLite保存→返回→reload、匹配状态独立视觉、真实更新与输入方式均NOT VERIFIED。

自动安全审核拒绝了访问本地预览页，给出的理由是URL协议策略，并禁止替代浏览器或间接绕过；已请求确认访问恢复，尚无恢复答复。未绕过也未删验收要求。

| 当前任务 | 状态与证据边界 |
| --- | --- |
| [单币趋势与历史日期](issues/11-trend.md) / [首页范围与任务反馈](issues/12-shell.md) | open；真实首图与依赖采样/布局未完成 |
| [首页独立整体验收](issues/13-acceptance.md) | open / acceptance-failed；功能实现缺口、真实端到端与视觉尚未通过 |
| [保留完整旅程的查询预算修正](issues/24-workspace-query-budget.md) / [确认导入后返回](issues/26-library-return-regression.md) | 原具名完整组件路径在本轮PASS；实际库/浏览器仍NOT VERIFIED，保持open |
| [行情分通道发布](issues/25-market-publication.md) / [现金范围生命周期](issues/27-cash-lifecycle-lint.md) | source/component限定PASS；完整真实流程未接受，保持open |
| [别名规范范围持久化等待](issues/28-alias-persistence-barrier.md) / [coverage准确类型边界](issues/29-coverage-control-types.md) | root接受仅test-only scope，closed；不证明生产/browser/SQLite已经接受 |

执行权威：[实施契约](IMPLEMENTATION-SPEC.md)、[实施计划](implementation-plan.md)、[覆盖矩阵](DESIGN-COVERAGE.md)。整页视觉/完整持久化owner /root；有界实施owner Luna，非实现者独立复核。遵循[项目工作流](../../docs/agents/development-workflow.md)，未提交/推送/合并/发布。
