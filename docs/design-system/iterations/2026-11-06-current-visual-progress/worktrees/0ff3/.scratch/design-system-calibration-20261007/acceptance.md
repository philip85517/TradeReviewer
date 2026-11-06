# 本轮验收记录

State: open
Status: acceptance-failed
Owner: /root

记录日期：2026-10-07；协调者在最终源码停止编辑后独立执行验证。本记录替代早期“尚未实现/构建”的进度结论；历史 FAIL 保留在原审查和红测试日志中，不删除、不把静态修复升级成真实图表验收。

| 门槛 | 当前结论 | 证据 / 边界 |
| --- | --- | --- |
| 项目指令、运行资料及批准参考 | PASS_DOCUMENT_ONLY | [材料登记](evidence/materials-inventory.md)；当前工作流和原规格优先 |
| 用户设计启动包 | NOT VERIFIED | 未找到本次包及路径；旧 DevHandoff zip 不代替它 |
| 八类诊断、候选规范与可追踪来源 | PASS_DOCUMENT_ONLY / SOURCE_ONLY | [诊断](DIAGNOSIS.md)、[最终独立报告](evidence/sample-final-review.md)；尚无新实测 |
| 指定状态安全和时间元数据反例 | PASS_SOURCE_ONLY | 最终四源文件哈希及独立报告；[先失败证据](evidence/fixture-regression-red.log)保留，[最终 11 测试](evidence/fixture-safety-final.log)通过 |
| 已有纯数据/绘图安全辅助契约 | PASS_TEST_ONLY | [25 测试](evidence/pure-safety-tests.log)；不证明浏览器全路径安全 |
| TypeScript 与样板 eslint | PASS_COMMAND_ONLY | [typecheck](evidence/typecheck-final.log)、[lint](evidence/lint-final.log)、[命令结果](evidence/validation-results.json)，均 exit 0；lint 仅新样板 TS/TSX |
| 完整构建与本地运行入口测试 | PASS_COMMAND_ONLY | 滚动修正后 [npm test](evidence/preview-scroll-build-runtime.log)、[退出结果](evidence/preview-scroll-validation.json)，exit 0，构建成功、5 项测试通过；运行测试使用隔离临时库；[旧日志](evidence/build-runtime-final.log)保留 |
| 服务、路由和客户端资源 | PASS_HTTP_AND_BUNDLE_ONLY | 修正后 [启动凭据](evidence/preview-scroll-start-receipt.json)、[HTTP](evidence/preview-scroll-http.json)：3031 首页/样板/21 资源 200，返回 CSS 含两个新滚动规则；不是浏览器加载或实际滚动证明 |
| 滚动容器源码修正 | PASS_SOURCE_ONLY / HASH_ONLY | [D03](issues/03-preview-scroll.md)、[独立复核](evidence/preview-scroll-independent-review.json)：两条局部 CSS 插入，其他样板源文件及 774 个既有 app 文件不变；真实滑动/全屏 NOT VERIFIED |
| 既有源文件保护 | PASS_HASH_ONLY | [774 文件](evidence/existing-app-preservation-delivery.json)与本轮前快照一致；既有未提交修复保留 |
| 静态候选颜色计算 | PASS_CALCULATION_ONLY | [颜色](evidence/static-contrast.json)、[主动作状态](evidence/sample-action-contrast.json)；默认 5.31、hover 6.89、pressed 8.66 不代表有效渲染像素 |
| 真实浏览器核心旅程 / 新 K 与成交可见 | NOT VERIFIED | 本地 URL 安全策略拒绝尚未确认恢复；数组增长和 reveal 接线不能替代主图可见证据 |
| Tooltip、列表、摘要、图层和轴完整未来安全 | NOT VERIFIED | 指定入口源码/fixture 已查；消费者真实操作未执行 |
| 同状态前后 / 最新截图 / 非实现者视觉比较 | NOT VERIFIED | 历史首页图、批准复盘图和同内容 CSS 基线不冒充本轮前后截图 |
| 实际中文字体、computed / bbox / 有效颜色 | NOT VERIFIED | 声明、候选参数与静态色值不等于浏览器测量 |
| 长文、价格、窄窗及断点边界 | NOT VERIFIED | scoped CSS 已有规则；320/390/1024 等实际画面未测 |
| 鼠标 / 键盘 / 模拟触控 | NOT VERIFIED | 不以 DOM 接线或静态焦点规则宣称操作通过 |
| 物理触屏 / 软件键盘 / 读屏 | NOT VERIFIED | 未测试；各类输入证据保持区分 |
| 数据库保存、返回导航和重开 | NOT APPLICABLE | 本轮固定内存样板，无保存承诺、repository 或写 API；生产原验收不变 |
| 正式样式与项目指令固化 | NOT APPLICABLE | 等用户选定实际画面，本轮仅候选规范与局部样板 |

## 服务与数据范围

预览：[样板](http://127.0.0.1:3031/design-preview)、[业务首页](http://127.0.0.1:3031/)。最新滚动修正版于 2026-10-07 05:49:33 UTC 启动，进程组 41927，监听进程 41945；05:49:54 UTC 两路由与 21 个资源 HTTP 200，见 [本次启动](evidence/preview-scroll-start-receipt.json)、[HTTP/资源检查](evidence/preview-scroll-http.json)。只替换已核实属于本工作树、本任务的旧进程组 39790。此前 05:37:29 启动和 05:40:32 存活记录保留在 [旧启动凭据](evidence/preview-start-receipt.json)、[旧存活检查](evidence/preview-live-at-delivery.json)。没有改默认 3022、共享业务数据库路径或其他服务。

启动使用既有隔离库 `.scratch/local-review-20261006/review.sqlite`。样板自身仅合成内存状态；`npm test` 的存储运行用例创建自己的临时隔离库。规范里的“刷新复位”重新初始化整个样板，包括内存中的后见标记，不作为生产来源持久化方案。

## 整体结论与余项

2026-10-07 滚动回归：用户报告无法上下滑动。源码定位 root 自动高度与全局 body overflow:hidden 的组合，见 [D03](issues/03-preview-scroll.md)。已发布两条局部 CSS 修正，独立哈希复核与新构建/HTTP 检查通过。旧 CSS 快照对滚动可达性不充分，受影响的长文/窄窗/底部动作及实际全屏门槛仍未接受；真实浏览器输入未测。历史源码和命令报告不删除。

**State: open / Status: acceptance-failed。** 当前无最终定向源码复核的残留明确 FAIL；必需的真实浏览器、图表可见旅程、测量与视觉门槛仍 NOT VERIFIED。不能宣称本轮完整 UI 已验收，也不关闭此前首页修复的 FAIL / NOT VERIFIED。

待补证顺序：核对用户启动包；恢复本地页面浏览器访问后取得业务首页新图与测量；按 [评审指南](REVIEW-GUIDE.md)执行同状态样式比较、S0/S1/下一根/S2/回早期与焦点长文；由非实现者直接看图签署功能、安全、视觉三个独立结论。用户仅选择焦点、密度、阅读感受及动作清晰度，再执行规范草案中的正式固化范围。
