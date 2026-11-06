# 模拟练习初始资金接入只读核查（2026-10-29）

范围：静态阅读当前源码、原始 V2 文档、用户决定与现有测试；未访问业务数据库，未修改产品代码，未运行测试或浏览器。下述“已接入”是源码接线结论，不是独立功能或视觉验收。

## 结论与差距

- **设置入口与持久化已接线**：`app/components/trade-review-workspace.tsx:6251,6304` 挂载数据管理与模拟练习完整记录；`app/components/data-management/data-management.tsx:110-114,229-253` 在「账户与计价」挂全局设置；`app/components/practice-source-view.tsx:113-126` 在指定练习完整记录挂本练习设置。`app/components/data-management/practice-capital-settings.tsx:31-33,61-87` 读取、正数校验、PUT 保存，呈现实际来源。两个路由分别位于 `app/api/storage/practice-capital/route.ts:13-16` 和 `app/api/storage/practices/[practiceId]/capital/route.ts:15-17`。UI 是现有页面惯例，不是批准的资金编辑器画板（`DESIGN-COVERAGE.md:343-356`）。
- **100000 CNY 默认、覆盖优先及继承在存储读取链存在**：`app/lib/storage/practice-capital-contracts.ts:3-5,13-22`；`app/lib/storage/practice-capital-store.ts:30-49,52-70`。未覆盖时每次读当前全局值，覆盖练习保留自己的值；非法已存设置不静默降级。`app/lib/storage/practice-statistics-capital-integration.test.ts:52-97` 是独立临时 SQLite 的既有测试：直接用 store 设值，检查路由和客户端的值与重开；它没有证明用户界面实际写入后的收益率变化。本次未运行。
- **收益率重算尚未形成真实可见闭环**：统计快照在同一事务内读取每练习生效资本并传财务计算（`app/lib/storage/practice-store.ts:166-171,197-204`），计算器确有净额/正本金 × 100 的通式（`app/lib/trades/practice-metrics.ts:174-183`）。但真实投影明确把整个练习的已实现额、费用、残余、权益轨迹置未知（`app/lib/storage/practice-statistics-financial.ts:55-75`）；当前客户端还拒绝已知完整练习净额及收益率（`app/lib/storage/practice-statistics-v2-client.ts:65-71`）。因此全球更改后新快照能携带新的有效资金，但当前真实财务链没有可计算收益率，不能据此宣称用户决定中的收益率已实际重算；不能把闭合报告小计当完整练习结果。规格 `visual-design.candidate.md:198-206`、用户决定 `USER-DECISIONS-2026-10-27.md:5` 要求缺项保持未知。
- **展示缺口**：统计页只使用返回收益率计算“收益率样本”数（`app/components/library/library-practice-statistics.tsx:76-77,435-438,467-475`），并无可见收益率数值；分布始终呈不可用说明，未有金额/收益率切换（同文件 :492-495），与 V2 `visual-design.candidate.md:216` 的切换和下钻要求仍有差距。收益率可见数值及分布需在有权威完整结果合同后贯通，不能虚构财务输入。
- **刷新边界**：设置组件的保存没有向统计页发布刷新回调（`practice-capital-settings.tsx:61-79`）；统计页按挂载、`refreshKey` 或手动刷新重读（`library-practice-statistics.tsx:386-406,460`）。工作区 `practiceRefresh` 目前在导入/打开等价练习时增加（`trade-review-workspace.tsx:1511,5040,6772`），不是资金保存时增加；从数据页返回交易库会重新挂载统计页（同文件 :6306,6339-6348）。实际导航、刷新时序及异常并发需隔离浏览器验证，静态分析不能证明显示实时同步。
- **恢复继承入口**：服务提供 DELETE 单练习覆盖，但设置组件仅呈现 PUT 保存（`practice-capital-settings.tsx:61-88`）；源码中未见该界面的“恢复全局默认”操作。用户决定没有明确要求此操作，属于可用性/后续需求缺口，不能自动视作本次规定未满足。

## 验收建议与限制

使用隔离 SQLite，创建 A 未覆盖/B 单独覆盖两练习，从两个真实 UI 入口设置并保存，离开、重开和刷新，核验资金来源与身份；全局变动后 A 生效值变化而 B 不变，非法值、失败重试、并发读取与旧数据不受损。对已有可信的完整净额样本（前提是后续批准来源与完整性合同）验证 A/B 的实际收益率及分母与未知样本排除，包括返回和重载；验证收益率切换与分布下钻。分别保留真实浏览器、持久化、视觉证据。此处未验证真实 UI、网络、真实用户数据、旧库迁移或完整 V2，测试源码不等于实际通过。

## 核查版本 SHA-256

```
89791f28d281a8390c5b72139997907747b12655ad3b26bb9715af704424f77d  .scratch/trading-library-v20-development/USER-DECISIONS-2026-10-27.md
dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43  docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md
aff0111329e7fb602e1668ea510df82b8ed23a11a93759e9c09ec432466fc941  app/components/data-management/practice-capital-settings.tsx
058d1b64e950e70d3b78c0dd7779cf91c1171cac5b6e36ef698c511bc1b0dcf0  app/components/data-management/data-management.tsx
ee7839fad68fafbf42edfd4c0ed74cb2d0e5491a7a15e6364d8381c3023cf9c5  app/components/practice-source-view.tsx
2532285e7926dcb3db96021b2928f78a3e55bd01ee59dd07307aa2dec058ed9e  app/components/trade-review-workspace.tsx
2413159eadc94bbac1e78b99f8a47a41545bc0f6cf7542ac52d18620f821f94c  app/components/library/library-practice-statistics.tsx
1b6628a6b3d02c758560b173412c6178d600fb625be80bda8986769b19b3a07c  app/lib/storage/practice-capital-store.ts
9d8397cc1c521e2a0580d2c0babb928c96e38bddb787a14d917e49cead66d17c  app/lib/storage/practice-store.ts
8865711f7c7e6ae0f8679f6d90b314a60643ea6b59c971b096457fa356bb34d0  app/lib/storage/practice-statistics-financial.ts
d1839ab3f19a8f09eda2946ea467f482d8851bbcb3b9030f75c0111be235006f  app/lib/storage/practice-statistics-v2-client.ts
7428ba3e98f975f9f3b188bc71b4f89133693725e2aedbd9389e510697924c51  app/lib/trades/practice-metrics.ts
2740a6ca28522d1557c8a03e287165132cc1728a2faba6760d07b39e1ebb5c19  app/lib/storage/practice-statistics-capital-integration.test.ts
```
