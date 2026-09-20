# 我的交易室独立 QA 计划与隔离样例

状态：独立 QA 矩阵与 09 最终集成验收已完成；07 两个 P1、08 source/账户/daily retry 路径及 09 桌面/390px 集成都已由代码与真实浏览器证据闭合。无剩余 QA 阻断项；集中验证链也已完成。隔离样例只写 QA 目录，未修改正式交易库。

规格基线：`docs/specs/2026-09-19-trading-room-homepage.md`。任务边界：`.scratch/trading-room-implementation/issues/09-qa.md`。

## 验收矩阵

| ID | 固定样例与操作 | 应观察结果 | 自动化/真实浏览器 |
| --- | --- | --- | --- |
| S01 默认范围 | 清空浏览器状态，打开交易室 | 默认是实盘、全部四类汇总、本月、趋势；高级筛选和收益质量折叠；未知来源不混入 | 组件测试；浏览器首次打开 |
| S02 四类与 ETF 去重 | 全部 → A股股票/美股股票/港股股票/ETF；在 ETF 内切 CN/US/HK 市场 | 三类股票均排除 ETF；ETF 可跨市场；全部四类只计一次；证券原市场身份保留 | 分类/聚合单测；浏览器逐项筛选 |
| S03 未知、实盘、模拟 | 默认范围、未知来源、模拟盘；模拟盘分别选 run-a/run-b | 默认只含实盘；未知来源单列；模拟运行必须选定且盈亏/胜率/趋势/日历不跨运行合计 | 范围模型测试；浏览器切换并核对摘要 |
| S04 自然月边界 | 固定日期 2026-09-19，依次本月、近3个自然月、今年至今、自定义 | 本月 `2026-09-01..09-19`；近3个月 `2026-07-01..09-19`；起止日均纳入；不按滚动 90 天 | 日期纯函数测试；浏览器显示起止日期 |
| S05 历史边界 | 自定义跨 2025-12-31/2026-01-01、2026-07-01、2026-08-31、2026-09-01，含 2024-02-29 | 平仓日归属正确；区间外不计入；US date-only/隔夜单使用来源交易日 | 日期/市场交易日单测；浏览器自定义期间 |
| S06 主指标与排除 | 观察两笔 ROI 回合、未知费用、历史不完整、结算币种不匹配 | 主指标只纳入可信完整回合；未知值不显示为 0；排除样本与原因可见；持平仍进胜率分母 | dashboard/domain 单测；浏览器收益摘要 |
| S07 成本与本金收益率 | A股股票完整范围；核对两笔各成本 10000、净赚 100；再填写本金 10000 CNY | 交易成本收益率 `200/20000=1%`；本金参考收益率 `200/10000=2%`；不累加各回合百分比；局部账户/标的筛选回退成本收益率 | 收益率/分母单测；浏览器录入、刷新、重开 |
| S08 缺本金与总体分母 | 重新生成 `--principal=missing-hk`；切全部及无交易但已配置分类 | 有交易分类缺本金时仍展示盈亏但回退成本收益率；不能用部分本金除全量盈亏；已配置但当期无交易本金仍进总体分母 | settings/聚合测试；浏览器切换并核对提示 |
| S09 趋势与日历联动 | 趋势↔日历；近3个月日历；点月、点日；月/年/全部年份；翻到上月 | 近3个月日历先显示三个月汇总并保留原期间；点月才下钻；日格只展开详情；年恰好 12 月；翻上月后摘要/趋势/收益质量/日历一致且不再称本月 | calendar/trend 单测；浏览器逐层点击 |
| S10 筛选状态清理 | 先选市场/账户/运行并点日期详情，再切市场、账户、期间、运行 | 失效日期详情和下钻结果清除；不残留上一个范围的金额；返回复盘保留合法筛选和展示状态 | 组件交互测试；浏览器返回路径 |
| S11 当前持仓 | 观察 canonical `HK:700`（显示代码 `0700`）期前开仓、两个账户、三市场 ETF；检查排序、估值状态 | 当前持仓不受业绩日期窗隐藏；按市场分组，组内最近成交降序；账户来源保留；有报价显示时点，缺失/过期明确标注，不伪造当前价 | episode/holdings 单测；浏览器实际点击 |
| S12 持仓复盘闭环 | 从持仓行进入复盘，返回交易室 | 进入准确持仓回合，不打开同股其他历史回合；返回保留筛选、期间及趋势/日历状态 | workspace 交互测试；浏览器真实导航 |
| S13 汇率快照可用 | 默认 `--rates=ready`，观察原币、人民币估算、来源、更新时间 | 摘要、趋势、日历使用同一快照；显示“按最新汇率估算”；原始交易金额不变 | FX/存储单测；浏览器同屏核对 |
| S14 汇率失败与无值 | `--rates=stale` 观察沿用旧值；`--rates=none` 首次打开；手动刷新/重复打开 | 失败沿用带日期旧值并提示本次失败；无值只显示原币；不伪造完整跨币种总额；同日重复打开不无限请求 | FX route/storage 测试；浏览器刷新和重开 |
| S15 数据质量 | 查看未知费用、历史缺口、行情 stale/needs-provider/source-unavailable | 交易盈亏、持仓行情、历史 K 线、汇率分别说明；部分可用不统称失败；明细显示影响数量、原因、时间及可执行动作 | 质量模型/路由测试；浏览器从首页进入数据管理 |
| S16 导航与数据管理 | 访问我的交易室、交易库、模式洞察、数据管理；从复盘返回 | 一级入口可用；导入、行情更新、问题明细集中在数据管理；原有导入/刷新行为不被隐藏入口破坏 | 渲染/路由回归；浏览器桌面及窄屏 |
| S17 响应式与可访问性 | 390px 和桌面宽度；键盘操作筛选、下钻、折叠、导航 | 无横向溢出；首屏能看到期间和核心业绩；实盘/模拟身份不用盈亏红绿区分；控件有可访问名称 | CSS/组件测试；真实浏览器截图和键盘路径 |
| S18 原始数据与交付 | 浏览器期间只写隔离库；验收前后比较原始成交摘要/哈希 | 正式库成交数量、ID、来源和财务字段不变；记录 worktree、DB、端口、进程、URL、最后验证时间；预览服务保持运行 | SQLite 查询/哈希；协调者亲自真实浏览器确认 |

### 07 真实浏览器证据增量（2026-09-19）

以下为 root 在隔离服务中操作、QA 独立核对证据文件后的 09 矩阵更新；证据中的 root 操作不等同于 QA 亲自控制浏览器，但保留了实际 AX 页面结果。

| 矩阵项 | 当前证据 | 独立判断 | 遗留项 |
| --- | --- | --- | --- |
| S01 / S07 默认与完整本金 | `07-browser-global.txt`、`07-browser-two-percent.txt` | 默认实盘/全部分类/本月可见；A 股 ¥200 / 本金 ¥10,000 显示本金参考收益率 2%、成本收益率 1% | 07 路径及最终集成通过 |
| S07 / S08 持久化与缺本金回退 | `07-browser-persist-fallback.txt`、`07-browser-live-return-clear-fixed.txt`、`07-browser-live-return-save-fixed.txt` | ¥20,000 重开保留；缺本金时本金参考收益率不可用、成本收益率仍可算；模拟回实盘清空/保存成功 | 已通过最终集成复核 |
| S03 / S07 模拟运行隔离 | `07-browser-run-a.txt`、`07-browser-run-b.txt`、`07-browser-live-return-*-fixed.txt` | run-a 的 ETF USD 1,000 显示本金参考收益率 1%、成本收益率 2.5%；run-b 不继承本金，成本收益率 -2.5% 且明确缺 ETF 本金；回实盘保存/清空成功 | 旧 `runId` 反例已修复，保留旧证据作审计 |
| S07 币种确认与数据保留 | `07-browser-currency-confirm.txt`、07 定向 saving-lock 回归 | 改币种先要求确认，并明确金额不会自动换算；保存中金额/币种/确认控件已禁用 | 后续只需随整站回归复核 |
| S03 / S10 scope 切换反例 | `07-browser-missing-pool.txt`、`07-browser-live-return-*-fixed.txt` | 旧证据明确显示请求 400；新证据验证 live scope 清空/保存成功 | 旧反例不作为当前缺陷；质量明细动作已由后续 08 证据闭合 |
| 08 数据质量模型与明细 | `08-qa-preflight.md`、`08-scope.md`、`08-browser-source-diagnostic.txt`、`08-browser-transaction-account-fixed.txt`、`08-browser-daily-retry-fixed.txt`、`08-browser-daily-retry-result.txt` | 历史含持仓、空 candle、unknown-only、provider retry 隔离、无 status candle 回归、source 行情检查、有效账户及 daily/1H action 分离均确认；scope 11/11 | 08 独立 QA 通过 |
| 09 质量明细集成 | `08-browser-fx-stale-home.txt`、`08-browser-direct-data-stale.txt`、`08-browser-fx-refresh-details.txt`、`08-browser-transaction-account-fixed.txt`、`09-preview-final.txt`、`09-browser-errors.json`、`09-preview-desktop.png`、`09-preview-390.png` | stale 旧汇率带失败提示，数据管理直达明细，手动刷新成功后质量恢复可用；交易账户补录/编辑可用；1280/390 无溢出且 console errors 为 `[]`；今年至今 62 回合/¥29143.03 与原币拆分一致 | 09 最终通过 |

自动化检查应覆盖纯函数和可观察组件契约：范围/资产分类、自然月日期、可信样本与排除原因、成本/本金分母、胜率分母、趋势/日历聚合、模拟运行隔离、汇率快照读写和本金设置读写。集成阶段由协调者集中运行定向测试、类型检查、构建和运行时回归。自动化通过不能替代 S01–S18 的浏览器路径。

真实浏览器验收必须使用独立端口和本文件生成的隔离库，检查页面实际交互、console/network 错误和桌面/390px 布局。父任务已报告正式保护基线在 `reports/protected-baseline.json`；本 QA 脚本不打开该库，也不使用 `.scratch/trading-room-implementation/acceptance.sqlite`。

## 隔离样例

脚本位置：[seed-homepage-fixture.ts](../qa/seed-homepage-fixture.ts)。脚本没有生产库默认路径，必须传入 QA 目录内的显式 `.sqlite` 目标；当前浏览器验收使用 `.scratch/trading-room-implementation/qa/qa-fixture-v4.sqlite`，当前样例包含：

| 内容 | 数量/标识 | 用途 |
| --- | --- | --- |
| 证券元数据 | 10 个 instrument；`CN-SH:600000` A股股票、`US:AAPL` 美股股票、canonical `HK:700`（display symbol `0700`）港股股票、`CN-SZ:159919`/`US:SPY`/`HK:2800` 三市场 ETF | 验证四类本金边界、ETF 的真实市场归属和 metadata.assetType |
| 成交 | 31 条，7 个 import batch | 完整回合、开放持仓、未知来源、质量缺失、模拟运行 A/B |
| ROI 样例 | `roi-a-share-1/2`，每轮买入成本 10000 CNY，净赚 100 CNY | 成本收益率 1%，本金 10000 CNY 时参考收益率 2% |
| 日期样例 | `boundary-leap-day`、`boundary-year-end`、`boundary-year-start`、`boundary-july-start`、`boundary-august-end` | 2024-02-29、跨年、月初/月末和自定义期间 |
| 质量样例 | `quality-unknown-fee`、`quality-history-gap`、`quality-settlement-mismatch` | 费用未知、历史不完整、证券币种 HKD 与结算币种 CNY 不一致 |
| 持仓样例 | `holding-hk-main-buy`（2026-08-20 开仓）、另一个 canonical `HK:700` 账户（显示 0700）、CN/US/HK ETF 未平仓 | 期前持仓、同代码跨账户、估值可用/过期/缺失 |
| 模拟样例 | `simulation-run-a` / `simulation-run-b`，TradingView date-only source | 首次选择运行和运行间财务隔离 |
| 行情质量 | canonical `HK:700` 当前可用；US:SPY 过期；CN-SZ:159919 无支持源；US:MSFT source-unavailable | 持仓估值与问题明细的不同状态 |
| 汇率设置 | `trading-room.fx` 中 `rates.USD=7.2000`、`rates.HKD=0.9200`，`publishedAt`/`publishedAtByCurrency` 保存源时间；`lastAttemptDay=2026-09-19` | 同屏人民币估算一致性及 ready/stale/none 受控状态 |
| 本金设置 | A股/美股/港股/ETF 各 10000，默认 CNY/USD/HKD/CNY | 完整本金、缺本金、无本金回退 |

脚本使用现有 schema migrations 和 SQLite 表/JSON 契约直接写入显式目标库，不依赖应用默认路径。它拒绝缺失目标、相对路径和 QA 目录外路径；已有目标必须显式传 `--force`，只会删除该目标及其 WAL/SHM 伴随文件。

生成默认样例：

```bash
node_modules/.bin/tsx \
  .scratch/trading-room-implementation/qa/seed-homepage-fixture.ts \
  "$PWD/.scratch/trading-room-implementation/qa/qa-fixture-v4.sqlite" \
  --force
```

失败与缺本金样例使用：

```bash
node_modules/.bin/tsx \
  .scratch/trading-room-implementation/qa/seed-homepage-fixture.ts \
  "$PWD/.scratch/trading-room-implementation/qa/qa-fixture-v4.sqlite" \
  --force --rates=stale --principal=missing-hk

node_modules/.bin/tsx \
  .scratch/trading-room-implementation/qa/seed-homepage-fixture.ts \
  "$PWD/.scratch/trading-room-implementation/qa/qa-fixture-v4.sqlite" \
  --force --rates=none --principal=none
```

恢复默认可用汇率和完整本金后再生成一次 `qa-fixture-v4.sqlite`。最终浏览器验收由协调者选择空闲端口启动，例如：

```bash
TRADEREVIEW_DB_PATH="$PWD/.scratch/trading-room-implementation/qa/qa-fixture-v4.sqlite" \
  npm run dev -- --hostname 127.0.0.1 --port <空闲端口>
```

服务就绪后才把该端口 URL 提供给浏览器 QA。当前契约 key 是本金 `trading-room.principal.v1`、汇率 `trading-room.fx`；本金状态使用 `version: 1` 与 `scopes.live` / `scopes.simulation:<runId>`，汇率状态使用 `rates.USD` / `rates.HKD`、`status`、`lastAttemptDay` 和逐币种发布时间。不得用旧 key 映射去写正式数据库。

## 本轮验证记录

- seed 运行成功：默认 `rates=ready/principal=complete`，生成 10 instruments、31 executions、7 import batches、4 settings、4 market-data jobs、2 daily candles，schema version 6。
- 受控模式运行成功：`rates=none/principal=missing-hk`，随后恢复默认样例；目标始终是显式的 QA `.sqlite` 文件（当前版本为 `qa-fixture-v4.sqlite`）。
- SQLite spot-check 已确认四类 metadata、canonical `HK:700` 与 display symbol `0700`、ROI 两轮字段、unknown-fee/history-gap/settlement-mismatch source evidence、run-a/run-b simulation scope，以及 `trading-room.fx` / `trading-room.principal.v1` 两个应用 settings key。
- 路径安全检查通过：缺失目标和 `/tmp/outside.sqlite` 均在写入前失败。
- 准备阶段的早期 typecheck 基线曾记录上述类型诊断；最终 `09-typecheck-final.log` exit 0，不能将早期基线与最终结果混写。
- seed 准备阶段未启动新服务或浏览器；后续 root 在隔离服务中采集的 07/08/09 浏览器证据由 QA 独立核对。07 过渡路径、08 source/账户/daily retry、09 桌面/窄屏与年份汇总均已复验通过。
- 最终集中验证：`09-full-unit-final.log` 的 workspace 旧 helper 失败保留为诊断；`09-workspace-test-final-rerun.log` 单文件 69/69 通过，合并为 190 个测试文件、1730 个通过、5 个跳过；最终 typecheck/build/runtime/lint/protected 结果均通过。
