# 首页 ≤1 秒：启动、路由和后台工作边界

日期：2026-10-24。范围：OS04；只读可行性研究。只新增本文；未运行 build、服务、浏览器、HTTP、数据库或安装操作，未修改产品代码、旧任务状态或 3/3 暂停。

结论：**启动链路有明确可拆分的结构，但预构建和代码分包均不能单独证明首页整体 ≤1 秒。** 当前首页首次加载会实例化全站工作区，等待通用 bootstrap/账户别名恢复，然后另起首页原子来源读取；SPA 返回虽避开 document 和首次模块加载，仍会发起全量首页读取。若维持现有数据读取/身份处理，已测财务链自身仍有 17.541 秒失败路径。面向 1 秒目标，应让首页只承担当前首屏的代码、状态和版本化数据读取，并和其他研究域提出的首屏聚合边界一起验证。

## 口径和证据边界

沿用 [README](README.md) 的暂定口径：服务已启动，导航开始到真实首屏财务指标、持仓、首屏曲线可用且可交互 ≤1000 ms；骨架、旧值、超时终态不算成功。该口径不是新的设计批准。本文无 UI 开发或实机 UI 验收，控件覆盖、触摸及视觉对比 N/A（文档研究范围），并不意味着产品验收通过。

已读 [CONTEXT](../../CONTEXT.md)、[AGENTS](../../AGENTS.md)、当前开发/前端审计/任务跟踪工作流，以及 [ADR-0001](../../docs/adr/0001-current-architecture.md)、[ADR-0006](../../docs/adr/0006-market-data-module-boundary.md)。ADR-0001 是历史回溯；其中旧 Node/默认路径不覆盖当前运行配置。下述数值来自唯一完整的插桩开发样本 [DIAGNOSIS](../homepage-timeout-funnel-2026-10-24/DIAGNOSIS.md)、[complete-trace.json](../homepage-timeout-funnel-2026-10-24/complete-trace.json)，绑定其 baseline/source manifests；源码位置为本次只读检查时的工作区。

| 启动阶段 | 本样本时间 | 可归因范围 |
| --- | ---: | --- |
| navigation → responseStart | 10,374.2 ms | 文档 TTFB；不是纯 SQL，也不是已测生产 SSR |
| navigation → loadEnd | 10,719.1 ms | 包含文档等待；不是可交互完成 |
| 框架 GET /home | 约 10.4 s，其中 compile 4.3 s / render 6.0 s | [冻结日志第 17 行](../homepage-timeout-funnel-2026-10-24/FROZEN-SERVER.log#L17)，包含于上述导航，不再次相加 |
| loadEnd → initialBootstrap start | 2,504.9 ms | trace seq1/13；未逐函数归因，不得全称为 JS parse/hydration |
| initialBootstrap | 680.5 ms | seq13→41；getBootstrap 480.0、monthly evidence 180.4、aliases 10.7、summaries 2.2 ms 均为内含子项 |
| initialBootstrap end → globalRead begin | 413.7 ms | seq41→52；包含调度/渲染等未细分工作，不能归给某个模块 |
| navigation → globalRead begin | 14,318.2 ms | seq52；应用 15 秒财务预算至此才开始 |
| globalRead → afterDomain 拒收 | 17,541.0 ms | 后续数据/身份链；预构建不会自动删除这条业务链 |

loadEnd 后至 globalRead 的 3,599.1 ms 只可按上表分段，不能把其中未归因的 2,918.6 ms 当作可保证回收收益。没有 CPU profile、生产运行、warm 重复样本或关闭后台的对照；没有用源码/传输体积推算解析时间。

## 当前启动合同与源码事实

1. **路由文件分开，但客户端工作区未按路由分开。** [`app/home/page.tsx:1`](../../app/home/page.tsx#L1) 与 [`app/trades/page.tsx:1`](../../app/trades/page.tsx#L1) 都导入 `TradeReviewWorkspace`，仅 `initialPage` 不同；[`workspace:1`](../../app/components/trade-review-workspace.tsx#L1) 是 client boundary，[`workspace:1325`](../../app/components/trade-review-workspace.tsx#L1325) 以 activeView 切换内容。`/` 还静态导入开发原型，[`app/page.tsx:3`](../../app/page.tsx#L3)；本样本为 `/home`，因此不能把根页面原型依赖当成本样本已测主因。
2. **非首页功能仍进入工作区静态模块图。** 导入 dispatcher 在 [`workspace:54`](../../app/components/trade-review-workspace.tsx#L54)，导入弹窗/TradeLibrary/数据管理在 [`workspace:214`](../../app/components/trade-review-workspace.tsx#L214)，ReviewChartWorkspace/RecallWorkspace 在 [`workspace:273`](../../app/components/trade-review-workspace.tsx#L273)。dispatcher 静态导入 TradingView 解析器 [`dispatcher:13`](../../app/lib/import/dispatcher.ts#L13)，后者静态引入 XLSX [`tradingview-simulation:2`](../../app/lib/import/tradingview-simulation.ts#L2)。这证明候选分包边界；不证明全部组件实际 mounted、全部代码进入同一个生产 chunk，或某库消耗了多少 ms。
3. **已有懒加载需要保留，不能重复计作新收益。** PDF runtime 在 [`pdf-text:55`](../../app/lib/import/pdf-text.ts#L55)，PaddleOCR 在 [`ocr-engine:142`](../../app/lib/import/screenshot/ocr-engine.ts#L142)，PPTX/JSZip 在 [`pptx:70`](../../app/lib/recall-export/pptx.ts#L70) / [`pptx:110`](../../app/lib/recall-export/pptx.ts#L110) 动态导入。ReplayChart 顶部对 lightweight-charts 是 type-only import，实际 runtime 到组件 effect 才加载 [`replay-chart:990`](../../app/components/chart/replay-chart.tsx#L990)。不能声称“首页当前启动全部 OCR/PDF/图表引擎”。本次未找到可用于当前源码初始 chunk 审计的 dist/.next/.vite 产物，也未执行构建。
4. **SSR 没有直接提供真实首页财务结果。** 首页 route 传的是 `getDemoReplayFrame()` 且 `showDemo=false` [`home/page:5`](../../app/home/page.tsx#L5)；demo frame 仍执行服务器数组选择/切片 [`server-replay-provider:53`](../../app/lib/demo/server-replay-provider.ts#L53)，没有该函数耗时证据。真实数据依赖客户端链。RootLayout 的 metadata 基于 request headers [`layout:16`](../../app/layout.tsx#L16)，不能仅因使用 build 就假设整页已静态化。
5. **通用 bootstrap 是首页首读的串行前置。** [`workspace:2853`](../../app/components/trade-review-workspace.tsx#L2853) mount effect 先 getBootstrap；未迁移时检查/执行旧浏览器迁移；应用 monthly evidence，再等待 activeAliasLoader [`workspace:2886`](../../app/components/trade-review-workspace.tsx#L2886)，恢复 reviews/settings/jobs/选择等全站状态，直到 [`workspace:3034`](../../app/components/trade-review-workspace.tsx#L3034) 设置 storage ready。首页 host 明确要求 storage 和 alias 均 ready [`workspace:2277`](../../app/components/trade-review-workspace.tsx#L2277)，才在 [`use-homepage-host:260`](../../app/components/homepage-v25/use-homepage-host.ts#L260) 发起财务首读；该首读又独立获取 homepage source、FX 和 aliases 等 [`workspace:2233`](../../app/components/trade-review-workspace.tsx#L2233)。去掉 gate 会破坏账户恢复/迁移合同，应改变最小前置读取边界而非绕过正确性。
6. **后台工作与首页首读确实并存，但已有限流/范围优化。** 通用 hydrated 后启动证券资料队列 [`workspace:3074`](../../app/components/trade-review-workspace.tsx#L3074) 与全库存日线 hydration [`workspace:3207`](../../app/components/trade-review-workspace.tsx#L3207)，后者用 concurrency=4/interactiveReserve=1 的 scheduler [`workspace:1257`](../../app/components/trade-review-workspace.tsx#L1257)。首页自己的 summaries `Promise.all` 未接入该 scheduler [`workspace:2257`](../../app/components/trade-review-workspace.tsx#L2257)。盘中读取已限定 activeView=review [`workspace:3332`](../../app/components/trade-review-workspace.tsx#L3332)，不是首页无条件读取。trace 证实首读 236 次 market 请求之外另有后台 236 次，但关键窗口已测后台 route 重叠仅约 31.89 ms；没有证据把 7.243 秒 dailyAll 全归后台。
7. **返回首页不等于复用已验真的财务结果。** `openHome` 经 native history.pushState，再 `acceptAddress(..., read=true)` [`use-homepage-host:438`](../../app/components/homepage-v25/use-homepage-host.ts#L438)，触发 beginRead [`use-homepage-host:249`](../../app/components/homepage-v25/use-homepage-host.ts#L249)。同一 mounted 工作区可保留模块和全站状态，但会重读首页数据；focus/visibility 恢复也可刷新 [`use-homepage-host:493`](../../app/components/homepage-v25/use-homepage-host.ts#L493)。旧 UI snapshot 不能视为数据版本缓存。交易库 destination 已 collectionOnly、跳过 FX/行情 [`workspace:2237`](../../app/components/trade-review-workspace.tsx#L2237)；本轮没有交易库计时，不外推首页数值。

## 三个优化方向及 1 秒成立条件

| 方向 | 改变什么 | 1 秒成立条件 / 不能承诺的点 | 未来验证 |
| --- | --- | --- | --- |
| A. 用生产预构建定义正式基线，开发编译单列 | 当前 [`package.json:9`](../../package.json#L9) 的 dev 经 debug launcher 显式 `--dev` [`debug-local:195`](../../scripts/debug-local.mjs#L195)；build 与 start 为不同脚本，start-local 未带 --dev 选择 `start` [`start-local:38`](../../scripts/start-local.mjs#L38) | 已启动预构建服务可避免把开发按需编译纳入用户首访；**不能直接扣除全部 6 秒 render，也不能声称省下 10.4 秒或立刻达到 1 秒**。生产仍可能有模块首次执行、SSR、数据和浏览器工作 | 相同源码/隔离数据/机器，分别生产 cold browser、warm browser；另列 dev 冷请求。保存 server SSR/模块载入、文档 TTFB、资源和 main-thread profile |
| B. 首页专用 host，分离非首屏模块和状态 | `/home` 只挂首页及必要共享导航，导入、Recall、数据管理、交易库按用户旅程加载；首屏使用最小且可验证的账户/数据身份前置，避免先完整全站 bootstrap 再独立首页 source；可评估由服务器提供已验真的初始首页结果 | 首页当前所有指标、持仓、曲线、筛选及导航合同必须保留；SSR 提前给值仍需证明事件处理器及时可用。整体 1 秒需要把通用工作区依赖从首页必经链移除或证明其已充分有界；仅在底层加 dynamic import 但保留全套 hooks/effects 不充分。无 profile，不能给分包节省秒数 | 对比生产 module graph 与实际 Coverage/CPU，标记 minimal identity ready、home read begin、数据提交、首个 paint、真实点击响应；测试账户别名/首次迁移、直接 URL、导入后失效与跨路由恢复 |
| C. 首页读取优先，统一数据拥有/去重，返回路径按版本复用 | 先服务当前首屏；其他库存 hydration/元数据工作按消费者需求启动；同源同版本读取共享 in-flight/结果，SPA 返回可验证版本未变时复用，变更后重新读取 | 必须保留取消、stale generation、账户/来源身份、导入失效与正确 scope；单纯延迟到 idle 不保证首屏交互不被后续长任务阻塞。当前 236 次首读日线与来源计算仍需首屏聚合/身份方案配合；背景延后单独不足以证明 1 秒 | 相同输入关闭/延迟后台的受控 A/B，分别记录关键链/非关键链请求与 rerender；重复导航/焦点变化、刷新/导入后返回，确认结果正确、版本一致、首屏点击无阻塞 |

## 必须分开的场景

| 场景 | 当前证据 | 判断 |
| --- | --- | --- |
| dev 服务已启动，路由首次编译 + 浏览器新导航 | 本次唯一完整 trace；并非所有缓存维度均受控 | 失败；作为诊断依据，不作为生产 SLO |
| 生产已预构建、服务已启动、浏览器模块/HTTP 缓存冷 | 未测 | 1 秒的正式关键场景；需包含首次模块执行与真实首屏结果 |
| 生产已启动、硬刷新但资源热 | 未测 | HTTP cache 可减少传输，仍须重新初始化/获取数据；不可替代冷访问验收 |
| 同一 SPA 从交易库返回首页 | 仅源码证明 pushState + fresh read；未测 | 可能避开 document/初始模块链；仍受数据链约束。不能用保留旧 UI 冒充新范围已完成 |
| 进程冷启动 → 服务 ready → 导航 | 未测 | 单列运维时间。标准 dev 还含 native assertion、在线备份/quick_check，见 [`debug-local:118`](../../scripts/debug-local.mjs#L118) / [`debug-local:175`](../../scripts/debug-local.mjs#L175)；不混入“服务已启动”的 1 秒目标 |
| 聚合缓存未命中 / 导入后首次打开 / 首次旧数据迁移 | 未测 | 不能只靠热访问承诺整体目标；必须单独满足 1 秒，或由用户明确批准不同 SLO |

## 最小验证计划（未执行）

1. 冻结源码/构建标识与相同隔离数据快照；记录生产/开发、process cold/warm、浏览器 HTTP/module cache、服务端数据/聚合缓存分别状态，避免统称 cold。保留现有失败 trace。
2. 对每个上述有效场景采多次无细粒度日志的端到端样本；冷样本使用独立浏览器上下文，重复样本用于分布，不把单次最好值当通过。是否采用 p95 需主代理最终目标口径明确；单次完整 1 秒内只证明那一次。
3. 用少量跨度标记 navigation/click → 最小前置 ready → 首页 read → 数据和身份接受 → React commit → 浏览器绘制 → 首个真实控件响应。CPU profile 与 detailed trace 用于另一诊断轮，报告其观测开销。
4. 从 production 初始模块图核对首页是否还被导入/Recall/库页面模块牵引；以浏览器 CPU/Long Task/React commit 证据确认影响，不能通过文件数或字节数换算 parse 时间。后台 A/B 独立于模块拆分 A/B，以免混淆收益。
5. 财务正确性、导航/取消与来源安全、视觉一致性分别验收。首屏金额和曲线必须来自对应版本且通过真实浏览器观察；非零条目、导入后失效、账户别名、返回/刷新、首屏交互均需要独立证据。启动域通过不等于整个首页交付通过。
