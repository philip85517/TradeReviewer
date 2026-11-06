# 持仓估值修复验收记录

State: closed
Status: locally-accepted
协调与整页负责人: root
独立源码/视觉审查: history_state_review（未实施所审 UI）

权威范围：[实施契约](IMPLEMENTATION-SPEC.md)、[设计覆盖](DESIGN-COVERAGE.md)、[视觉契约](visual-contract.md)。用户授权“开始修复”；Luna（gpt-5.6-luna，high）有界且不重叠实施。版本为 `codex/holdings-valuation-repair` 相对 `63690a494b8ad403081c7720985be54a95db60c7` 的未提交修改；[冻结 manifest](assets/final-source-manifest.json)。未提交、推送、合并，非本任务已有工作保留。

预览：[http://127.0.0.1:3031/](http://127.0.0.1:3031/)，本工作树生产构建，session 30810。数据库显式 `/Users/zhoulin/.codex/worktrees/0ff3/TradeReview/.scratch/local-review-20261006/review.sqlite`。原业务 3022/共享库/配置未变。启动脚本：[start-preview.sh](start-preview.sh)，从工作树执行 `sh .scratch/holdings-valuation-repair-20261006/start-preview.sh`，已有服务占用 3031 时不重复启动。

| 门槛 / 元素 ID | 协调者或独立证据 | 当前结论 |
| --- | --- | --- |
| 首条真实图表 E-H01/H02/H03 | [first-journey](assets/first-journey.md)，先接受真实今年/日市值、盈亏再展开依赖 UI；最终生产页 [browser journey](assets/final-browser-journey.md) | PASS |
| 原币小计、币种覆盖、未知/部分/完整、收益率 E-H01/H02/H03 | 129 项 [focused tests](assets/domain-chart-final-tests.log)，真实 9/14 小计/覆盖；缺 FX actual builder/component 夹具和独立直接看图 [review](../../.superpowers/sdd/implementation-plan/task-3-final-source-review.md) | PASS |
| 冷启动显示与精确回执 E-H02/R02 | [root actual hook/controller](assets/cold-display-final-post-maintenance.log)：同范围/前进时间先显示安全结果；六类不兼容拒绝；100→150→200 仅确认最新精确输入；真实页下载/重算保留快照 | PASS |
| 台账、红股、绝对时间、date-only、市场 session E-D01/D02 | 20 个 actual builder [反例](assets/domain-cutoff-precision-before-final.json)、129 回归、[投影](assets/projection-final-coordinator.json)、[红股复算](assets/domain-reconciliation.md) | PASS |
| 自动扩展、手动去重、锁、订阅取消 E-R01/R02 | [74 个 actual 断言](assets/workspace-final-post-maintenance.log)，17 专门 workspace tests；真实 3031 当前 8→历史 39 候选、手动共享反馈、取消/重试 | PASS |
| 终态和失败回执 E-R02 | actual producer 新持久化 1D 回执、旧作业拒绝、1h 不污染 1D、失败/取消有限终止均在 74 断言中通过；实际 hook/worker 的完整/部分/失败→重试完成截图均由独立 reviewer 直接看图；complete-v2 指纹见报告 | PASS |
| SQLite 持久化、返回/reload E-A01 | [真实旅程](assets/final-browser-journey.md)：下载后导航返回/reload 当前和 9/14 数值恢复；pre/post reload 154277 日线同 SHA256 | PASS |
| 原始交易保护 E-A01 | [最终摘要](assets/data-integrity-final-delivery.json)：共享/隔离库 executions 1866、imports 213、revisions 11、principal provisionals 1；count/hash 与基准一致 | PASS |
| 六视口独立视觉 E-A01 | 1440×1000、1920×1080、1055×900、821×900、820×900、390×844；reviewer 直接看原图、before 与有效完整截图；蓝色层级/控件顺序与尺寸保留，无 Major/Minor 产品差异 | PASS |
| 类型 / 构建 / runtime / diff | [typecheck](assets/final-typecheck-all-stable.log) exit 0；[npm test](assets/final-build-runtime-stable.log) 构建成功、5 runtime PASS；git diff --check PASS | PASS |
| 全仓 lint | [最终对照](assets/final-lint-comparison.log) exit 1：13 errors / 48 warnings；13 errors 与精确 base 同样（base 13 errors / 22 warnings），无新增 error | FAIL（既有基线，非全绿） |
| 全量 unit | [最终 --maxWorkers=4](assets/final-unit-constrained.log) exit 1：3120 PASS / 16 FAIL / 6 SKIP，321 files PASS / 1 FAIL / 3 SKIP；[workspace 隔离](assets/final-workspace-single.log) exit 1：86 PASS / 5 FAIL；其中 3 项 [exact base](assets/baseline-regression-comparison.log) 同样 FAIL，另 2 项精确单项 base/final 均 PASS（下文） | FAIL（全仓未全绿；本功能门槛另验） |
| 预览交付检查 | 2026-10-06 16:12，PID 62247 仍监听 3031，真实浏览器检查 URL、今年/日/原币/全部账户与 9/14 详情；临时 viewport reset 后默认 319×804，console error 为空、夹具 tabs 已关闭；[首屏](assets/final-delivery-real-browser.jpg)及[实际曲线](assets/final-delivery-real-browser-default319.jpg)。当前聊天通知由本轮最终回复提供 | PASS（预览检查） |

鼠标/键盘是真实浏览器。touchStart 由实际组件测试覆盖；浏览器后端无设备触摸 API，设备仿真和物理触屏分别 NOT VERIFIED，不将窄视口冒称真机。契约要求明确区分，不制造设备 PASS。

## 数据与范围限制

9/14 市值 CNY 218591.40 / USD 1551.99，盈亏 CNY -9305.02 / USD +188.99。数量/市值覆盖 7/15（CNY 6/7、USD 1/8），完整=false。513010 等账本数量/成本仍缺；HK provider 有 source-forbidden/403，自动补行情保留真实原因；来源无独立最终性字段，本次为已完成交易日的来源日线参考估值。

新生产浏览器窗口后缓存增加 189 日线；存在既有自动同步/共享任务，不把全部增长归于新功能。pre/post reload 全 daily_candles 行 SHA256：`26e6d3ee2605e39737f95e10797677e14a92198545000c93b3bb684c3ae6d646`。真实数据库快照与曲线恢复分别证明持久化、页面接线，不只凭 DOM 重渲染。

缺 FX 和刷新终态 evidence-only 服务使用实际组件/hook/worker 与明确标识的受控边界，只证明对应分支行为/视觉，不替代 3031 实际 provider/SQLite 证据。

## 失败与回归历史

[历史 README](assets/historical-README.md)、[历史验收](assets/historical-FINAL-ACCEPTANCE.md)、各 issue 与 [独立审查](../../.superpowers/sdd/implementation-plan/task-3-final-source-review.md) 保留 FAIL：未来 receipt、日期精度、候选 A→AB、重复补 B、公共 B 被取消、旧回执冒成功、首结果显示饥饿。最终冻结源的实际反例复验已关闭这些软件缺陷。

默认并发失败、5 文件有界失败、单独 chart 通过和串行全量中断日志都保留。没有调高 timeout 或修改失败断言，未把 unrelated 基线 lint/test 伪写通过。legacy workspace 两测试仅隔离默认自动 scheduler 场景，保留旧手动/导航断言；自动由专门 tests 与 actual 74 断言覆盖。

整体：root 于 2026-10-06 16:10 接受本次功能正确性、真实端到端行为和独立视觉还原。25 个冻结源码文件未变，原始保护数据不变（[最终逐项确认](assets/final-delivery-integrity-check.json)）。全仓测试和 lint 仍 FAIL，保留其证据与范围限制；未发现未关闭的本次功能反例。此记录不代表所有真实持仓估值齐全，也不代表全仓 CI 可合并。

## 最终回归分类与签署

- 最后全仓 16 个失败都在 workspace 文件；隔离该文件后 86/91 通过，剩余 5 个为 Recall/chart 加载或原 5000ms 超时。3 个与精确基线失败相同：Recall header actions、parent navigation save retry、per-episode drawing draft snapshot gate。
- 其余 2 个精确单项均在固定 base 与最终 source 通过：imported review actions（[base](assets/baseline-imported-review-actions.log) 9.08s / [final](assets/final-imported-review-actions.log) 8.50s）；latest Recall drawing draft（[base](assets/baseline-latest-recall-draft.log) 11.02s / [final](assets/final-latest-recall-draft.log) 10.85s）。各为 1 PASS / 90 SKIP、exit 0、原 timeout、maxWorkers=1/no-file-parallelism。单项通过只关闭本轮归因疑问，不抹掉批量 FAIL，也不证明全仓稳定性。
- 早期默认并发 43 FAIL、5 文件 1 FAIL、串行中断、已单项通过的 cancelled-import chart 仍留原日志。没有重复无关测试或提高 timeout。
- 两旧 suite 的 idle hook mock 仅分离其既有 hydration/manual/navigation 场景，保留 Recall 断言；默认 async 公共接线由 17 永久 tests、74 actual probes、cold hook/controller 与真实 3031 旅程独立证明。旧 suite 本身不证明 Recall 与 live scheduler 共存，独立 reviewer 已声明此证据边界。
- complete/partial/failed 的受控视觉页 main SHA `bfd3d0248318cb7ce5f16cd66b2c9c534d92b6c1c364fb6c585da0b32cc42eff`；产品状态由实际 hook/worker 产生，不注入 phase。complete-v2 图 SHA `3fca6e7705bd7133e9c44ed4f706054121847b4edf35884714394c89e131f909`。该页不证明业务持久化；failed 夹具主动移除行情输入，不代表真实 cache 保留结果。
- `final-recomputing-real-1440.jpg` 截图时 header 实际 downloading，曲线仍显示旧有效快照；真正的重算文案由前一实际 DOM 观察证明，不由文件名推断。cancel 图 dateSelect 为空，不能作为 9/14 选中保留证明；reload/return 后重新选 9/14 的独立真实旅程证明数值恢复。

签署：root（协调、整页视觉与持久化负责人）；独立源码/视觉意见见原 [review](../../.superpowers/sdd/implementation-plan/task-3-final-source-review.md)。三项本次核心门槛 PASS；全仓 CI FAIL 与设备触摸 NOT VERIFIED 如上保留。服务继续运行，最终真实页面后台仍处理 36/39 候选，正常查看/选日期可用；不把处理进度或完成视觉等同于所有持仓已完整估值。

交付浏览器的 viewport reset 由后续实际 DOM 确认为默认 319×804；此前 1440 读数是 resize 生效前的状态，不称其为最终默认宽度。root 直接检查默认窄面板首屏与滚动后的真实曲线，控件仍可读；此附加检查不替代已接受的六视口独立视觉。临时 evidence-only 3043/3045 服务已关闭，3031 实际 review 服务保留。
