# V2.0 文档修订实施契约

Assignee: v20_revision（gpt-5.6-luna / max）
集成负责人: root
范围：只写 docs/design-system/baselines/2026-10-26-trading-library-v2.0/ 以及本任务 implementation-report.md。不要改 canonical、索引、V1.1、产品代码、数据库或评论；不要派代理、提交、推送。

先读项目当前 AGENTS.md / docs/agents/development-workflow.md、task-decomposition.md，以及本任务 DESIGN-COVERAGE.md 和 confirmed-findings.md；阅读 canonical docs/design-system/trading-library-design-spec.md 完整规范，两份 reviews/luna-{a,b}-scan.md 和旧 V1.1 完整正文、生成器、fixture、E 参考图。准确旧包：docs/design-system/baselines/2026-10-24-trading-library-v1.1/。

## 输出
- 新 V2.0 包，document ID TRADING-LIBRARY-V20，version 2.0；十章 BT01–BT10、已有主要旅程与错误/空/缺失状态覆盖保留；正文引用 canonical（source 内 ../../../trading-library-design-spec.md）。
- 从 V1.1 必要源文件复制并修订；独立生成 identity/manifest/HTML；不要整包照抄历史 reviews 或带旧的 authority/validation 承诺。V1.1 全目录及评论原样保留。
- 修订 fixture、数据派生、图例和图中逻辑，重新生成全部在 V2.0 正文引用的逻辑 SVG。生成器样例语义测试按修改调整，并验证边界（行为与配对数、练习样本、残仓估值、本金、费用一次、持平、零样本）。纯文档无需产品测试。
- 保留 E 已批准视觉契约：64 顶栏 / 72 左栏 / 58 次栏，列表/统计与模式相邻；无首页按钮/视角字样；绿盈红亏；模拟低饱和底色及边缘；说明 i/口径浮层。原 E JPG 或旧 prototype 如保留为链接，明确历史几何参考，不能作为 V2.0 业务图。当前图需要清晰可读，不能把旧图藏在“只是样例”的免责声明之后。
- 模拟详情中的内部配对可保留参考路径和示例，不冒称已决定最终预览指标/复盘状态算法；顶层结果使用练习金额/收益率。已知 A 100+50 买入后卖80，配对2份≠实盘2回合，残仓70；无结束估值则整体未知，不能用1884部分盈利冒充完整练习净额。可采用明确的假设资金/结束价格示例，但不得声称已实现真实数据来源。
- 保留最近开仓配对例子；fixture如用 human_action_id，需要写明设计输入而非自动行为识别已经实现。不要把未知真实规则用时间/价格聚合补出来。
- 模拟练习标题稳定#01/#02，三种日期分离；有效练习日期导入前完成；文件名只辅助；等价重复/变化选择/人工保护写进交互流程和验收。
- 初始资金缺失不影响可算金额胜率；每个图的金额/率/胜率/分布计数用自己样本。混合方向练习分类未决，不把内部多空统计当练习级。
- V2 README 写构建方法/预览链接/权威规范/历史来源/真实未决，不复制过去测试通过声明。

## 质量与证据
实现后自验生成器与测试、reader构建、SVG可解析、数字与正文一致、git diff --check。报告路径 .scratch/trading-library-v20-spec-sync/implementation-report.md：文件、命令、结果、未决、不适用理由。状态 implementation-ready，不冒称最终接受。
root 将独立校验链接、历史哈希并浏览阅读器；另两名未参与实施的 Luna 负责复核。产品控件/数据库/触屏验收 N/A，原因仅文档与静态图例。
