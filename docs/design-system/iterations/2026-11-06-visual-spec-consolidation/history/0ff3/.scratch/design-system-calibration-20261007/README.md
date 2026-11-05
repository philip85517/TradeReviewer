# TradeReview 设计规范校准与可逆样板

State: open
Status: acceptance-failed
Owner: /root
Date: 2026-10-07

2026-10-08 用户指出旧首页样板偏离正式 master：首页推荐方向已撤回，转入 [按正式首页结构拉齐](../homepage-master-alignment-20261007/README.md)。旧合成组件及复盘样板保留到 `/design-preview/component-sample`；新 `/design-preview` 将复用完整业务首页和隔离数据副本，不再适用本文件“所有样板均为内存 fixture”的范围描述。旧报告、滚动修正和未验证记录完整保留，不能据其宣称新首页视觉通过。

目标：诊断首页视觉不协调的具体来源，建立中文暗色设计规范草案，并交付一个真实组件的推荐样板。用户授权普通检查、设计细节和可逆制作独立完成；最终由用户选择实际画面的焦点、密度与阅读感受。

本轮与既有首页修复分开追踪；不宣称旧修复已验收，不改变共享数据库、框架、库或正式业务数据。样板为内存中的固定合成数据，刷新复位。

2026-10-07 阶段性交付：候选规范、八类诊断和真实组件样板已落文件；指定源码反例经非实现者复核，协调者独立通过 typecheck、样板 lint、11 项 fixture 测试、25 项已有纯安全测试及 `npm test`（构建 + 5 项渲染/本地运行检查）。3031 的本任务服务已用新构建启动，首页、样板及 21 个首屏客户端资源 HTTP 200。最新浏览器、字体/尺寸测量、真实图表旅程与视觉比较仍 NOT VERIFIED，因此整体保持 open / acceptance-failed。

- [旧组件及复盘样板](http://127.0.0.1:3031/design-preview/component-sample)
- [业务首页](http://127.0.0.1:3031/)
- [一次性交付与评审指南](REVIEW-GUIDE.md)
- [主要问题与具体规则](DIAGNOSIS.md)
- [规范草案](../../docs/design-system/TradeReview-设计规范-v0.1.md)
- [最终独立源码复核](evidence/sample-final-review.md)

- [需求与边界](BRIEF.md)
- [视觉契约](visual-contract.md)
- [需求覆盖](DESIGN-COVERAGE.md)
- [01 实际组件样板](issues/01-component-sample.md)
- [02 规范与诊断](issues/02-standards-and-diagnosis.md)
- [03 样板滚动回归](issues/03-preview-scroll.md)
- [验收记录](acceptance.md)

启动包路径尚未收到。浏览器本地 URL 被此前安全策略拒绝，恢复确认尚未收到；本轮最新画面、computed style、实际字体、真实主图交互与独立视觉比较均 NOT VERIFIED。源码声明不等于实测。旧画面保留为历史问题参考。

2026-10-07 用户报告“无法上下滑动”：确认源码中 body 禁止滚动而样板 root 只有最小高度、没有有界滚动高度。D03 已增加 root 的 height:100dvh 及 review:fullscreen 的 overflow-y:auto；协调者独立确认仅两条局部 CSS 插入，其他样板源码和 774 个既有 app 文件不变。新 npm test 构建与 5 项运行入口检查通过，05:49:33 UTC 已重启 3031；首页、样板、21 个资源 HTTP 200，返回 CSS 确实包含修正规则，见 [D03 证据](issues/03-preview-scroll.md)。真实滚动/全屏及长文/窄窗可达性仍 NOT VERIFIED；旧日志保留，整体 UI 仍 acceptance-failed。
