# 首页交互视觉修复实施计划

> Use superpowers:subagent-driven-development; existing isolated worktree and dirty baseline preserved. No commits/pushes.

Spec: [实施契约](IMPLEMENTATION-SPEC.md)。基线快照 [baseline/source-manifest.json](baseline/source-manifest.json)。所有实现模型 gpt-5.6-luna，禁止子代理再派代理。测试针对行为，不镜像实现；先失败的关键回归测试，再实现和适用验证。

## Task 1 — 看可信金额并查看缺口

H03/H05/H06、V01/抽屉V02。所有权 summary、allocation 的 tsx/css/test，新 room-valuation-diagnostics.tsx/css/test 与可选局部 diagnostics helper。不改 review-dashboard 或领域财务算法。消费已有 model/cash，新增 callbacks 见 spec；root/Task3 是真实消费方。实现分币金额、完整性命名、去灰环、分组摘要、分页搜索抽屉、焦点/Esc/行动。自测金额完整/部分/全缺/FX/合法空头/重复原因/搜索分页/焦点。报告 acceptance/task1-report.md。

## Task 2 — 单币趋势和可读历史

H04/H07/H08币种、V01、J02。所有权 room-holdings-history、room-performance tsx/css/test，room-performance-chart.ts/test，新 currency-presentation.ts；为桶内边界允许修改 app/lib/reviews/trading-room-history.ts/test 的 sampleHoldingsHistory 范围，保留既有修复。先实现最小单币选择→历史点→同日表格→返回当前切片，提交报告等待真实图接受；浏览器受阻时不擅自扩大依赖该新契约的集成。后续粒度/边界/color 仍为此票独立范围，由 root 记录门槛后推进。测试单币不混轴、重排色不变、稀疏边界、快照不求和、keyboard、FX。报告 acceptance/task2-report.md。

## Task 3 — 首页范围与后台任务入口

H01/H02/H08分页/H09、V02/V03、J01/J03。所有权 review-dashboard tsx/css/test 与 room-pending-reviews tsx/css/test。允许同目录现有 unified header scoped override 不改公用文件。只页头/任务/诊断真实接线可独立并行；依赖新图状态的布局先留 integration-pending 直到 Task2 真实图门槛。接线 retry/check，本月文案，chips移出折叠，窄屏摘要，pending精确入口，紧凑分页，真实阶段动画及reducedmotion。保持全部账户/统计期/快照返回持久化。报告 acceptance/task3-report.md。

## Task 4 — 独立接受与交付

/root 整体测试、类型/构建；只读独立代码/视觉审阅；写浏览器用隔离库、原交易完整性对比。视口1440×1000/1280×720/390×844/320。首图旅程、缺口更新、复盘保存返回reload，以及匹配状态视觉全部有证据才 accepted。缺少真实浏览器则保持 NOT VERIFIED，报告阶段成果和可打开预览不宣称完成。最终用户预览运行，不推送。

## 接口和冲突扫描

| 任务/关系 | 输出/消费 | 裁定 |
| --- | --- | --- |
| 1自身 | 金额与诊断消费原模型，不动财务 | 一致，FX回退保留 |
| 2自身 | 单币原轴与FX轴，采样快照 | 一致，桶内边界不抹除 |
| 3自身 | pendingcount与通知不同，旧hook阶段 | 一致，无continue伪入口 |
| 4自身 | automation≠browser≠visual | 一致，策略阻断保留 |
| 1→3 | RoomAllocation callbacks retry/check | 唯一接口由1新增，3真实接线，不共享编辑 |
| 2→3 | periodControls slot、自然月文案 | 3只传slot，不改2组件；真实首图验收依赖保留 |
| 1/2 | shared reportcurrency/model | 只读既有接口；颜色helper归2，1可用局部币种文字 |
| 1/2/3→4 | baseline与报告/截图 | 实现不自签；root维护矩阵及接受 |

## fix1 范围补充

Task3 唯一拥有 use-holdings-valuation-refresh.ts/.test.tsx 中断证据扩展，并接入自己拥有的 dashboard 输入类型。工作区已经传递完整 marketDataJobs，不改存储／调度器。Task1 当日行宇宙与证据提示采用实施契约末节裁定，不复用其他指标比例。Task2 状态修复仅最小旅程，不越过真实图接受门槛扩自动采样或依赖布局。

三个任务第一轮静态 review FAIL；修复均回原owner。fixed snapshot acceptance/fix1-base，最终依然需要协调者独立验证，不自签接受。
