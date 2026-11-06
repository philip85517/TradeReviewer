# 持仓市值与盈亏修复

State: closed
Status: locally-accepted
集成负责人: root

用户已确认“展示已知部分并补齐完整估值”“默认异步补充齐（不影响正常流程，同时给到更新的状态动态效果），另外有手工触发按钮”，并授权“开始修复”。实施与独立源码复核完成；真实隔离浏览器的曲线、自动/手动更新、取消/重试、返回/reload、保护数据检查通过。完整/部分/失败/重试恢复的独立视觉检查完成；root 已接受本次功能、端到端与视觉三个门槛。全仓回归与 lint 的 FAIL 单列保留，本次接受不代表全仓 CI 可合并。

预览：[本地 review 页面](http://127.0.0.1:3031/)。此工作树生产构建，显式隔离库 `.scratch/local-review-20261006/review.sqlite`，服务 session 30810。原业务 3022、配置和原始交易未改变。重启：从本工作树运行 `sh .scratch/holdings-valuation-repair-20261006/start-preview.sh`。

实现显示可用的原币市值/盈亏小计和币种独立覆盖，完整实线、部分虚线、未知断点，成员变化不连接成虚假损益。修复休市行情截点、可信余额传播与支持的红股处理。默认后台补行情，复用全局锁、逻辑订阅共享与持久化链路；下载/重算期间仍可看有效快照，手动更新、取消、重试给出真实反馈。

9/14 实际图：CNY 市值 218591.40、盈亏 -9305.02；USD 市值 1551.99、盈亏 +188.99。数量/市值覆盖 7/15（CNY 6/7、USD 1/8），完整=false。513010 等数量/成本证据和部分来源行情仍缺，下载不能补造账本或保证全部证券可估值。

- 权威范围：[实施契约](IMPLEMENTATION-SPEC.md)、[计划](implementation-plan.md)、[设计覆盖](DESIGN-COVERAGE.md)、[视觉契约](visual-contract.md)。
- 当前验收：[FINAL-ACCEPTANCE.md](FINAL-ACCEPTANCE.md)；冻结版本：[源码指纹](assets/final-source-manifest.json)。
- 真实浏览器与 SQLite：[完整旅程](assets/final-browser-journey.md)、[保护数据](assets/data-integrity-final-delivery.json)。
- 未实施 UI 的独立审查：[报告](../../.superpowers/sdd/implementation-plan/task-3-final-source-review.md)。
- 原问题：[根因与单变量对照](../holdings-history-diagnosis-20261006/diagnosis.md)。
- 真实决策：[地图](issues/01-repair-map.md)、[交流](assets/charting-context.md)、[行情研究](assets/market-session-research.md)。
- 早期失败保留：[历史 README](assets/historical-README.md)、[历史验收](assets/historical-FINAL-ACCEPTANCE.md)，issues 与审查报告也保留逐轮 FAIL。

Luna（gpt-5.6-luna，high）执行有界、不重叠实现任务；root 负责整页与真实持久化；history_state_review 独立直接看图。所有业务源已停止修改，未提交/推送/合并/发布，非本任务已有修改保留。

类型、构建和 5 项 runtime 检查通过；129 项领域/图表回归、74 项实际公共入口/锁/回执断言与冷显示 actual 探针通过。全仓 lint 仍有精确基线同样的 13 errors，未制造全绿；最终有界全量为 3120 PASS / 16 FAIL / 6 SKIP，失败都在 workspace 文件；该文件隔离复验 86 PASS / 5 FAIL，其中 3 项基线也失败，另外 2 项在基线和最终源码精确单项复验均通过。没有提高 timeout 或删改失败断言。鼠标/键盘为真实浏览器，合成触摸单独有组件测试，设备仿真及物理触屏 NOT VERIFIED。

任务 07–10 本次范围已由 root 接受。规划中的真实余额、来源最终性边界不因实施票关闭而伪造解决。`python3 .scratch/holdings-valuation-repair-20261006/frontier.py` 仅查询地图派生视图。

2026-10-06 16:10 交付检查：最终源码 25 文件与冻结指纹一致；共享/隔离库保护数据 count/hash 不变；3031 PID 62247 仍监听，真实浏览器 URL 已检查、错误 console 为空、临时视口覆盖 reset、验收夹具页已关闭。最终正常面板为 319×804；[首屏](assets/final-delivery-real-browser.jpg)、[滚动至实际曲线](assets/final-delivery-real-browser-default319.jpg)，以及本次已接受的 [1440 完整页面](assets/final-reload-cache-1440.jpg)。工作流：[development-workflow](../../docs/agents/development-workflow.md)。
