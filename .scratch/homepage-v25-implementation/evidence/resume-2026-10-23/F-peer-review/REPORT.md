# F 独立只读 peer review

2026-10-23，reviewer `/root/state_g61`，GPT6.1 Ultra。只读 F/S/账本源码；仅本目录新增证据。没有修改产品/共享记录，没有服务、数据库、依赖、提交或全量测试。本报告不是 F 或产品接受。

## 版本与范围

首次探针绑定时间 `2026-10-22T16:53:16.436Z`（上海 2026-10-23 00:53）。所审 F 源 SHA256 `174c506e14195a050773b68629090417fe1a4e4e4ffd85f093ca4e3b79ef97de`；测试 `f5350f8ac4b92057836df85052d0d9f9524041de585403e68fb60ce6da3fb245`。详细 canonical/IPO/statement/library 源 hash 见 `source-before.json`；F 源与测试只读副本见 `*.reviewed.txt`。Owner 同期在最小 IPO 修复，后续结果必须另绑新 hash。

已读原 `issues/01-financial.md`、`F-debug/ROOT-CAUSE.md`、当前 `F-fix/INTERFACES.md` 和 `report.md`，直接审阅 F 源/测试、canonical ledger、IPO acquisition cost、statement 知识时间及真实 library 构建。历史缺显式 nature/asOf 的断言没有作为本次通过依据。

## 确定可复现问题

### P1：非 execution IPO 改变库存时，费用池没有同步归属

原源 `homepage-v25-performance.ts:182–209` 的 pool 只在实际 execution 分配；canonical 自行处理 IPO 库存事件，F 仅将其新增 fees 放入 pool，没有处理对应的平仓/反向。随后 `netRealized = grossRealized - fees + pool` 会把本应已实现的费用退回。`amount` 在可信零仓位直接返回 UF=0，因此费用会从全平后的总净额消失。

真实 `buildInstrumentTradeSummaries → buildTradeLibraryEntries → F`，明确 live/asOf，附带同证券/账户/币种的唯一 IPO application/refund/fee：

|输入|应得|实际|
|---|---|---|
|1 月开空 1@150、fee2；IPO 分配 1@100、fee3 全平|realized45、closingUF0、net45、openFees0|realized50、closingUF0、net50、openFees5；所有 available=true，无原因|
|同一开空；IPO 分配 2@100、fee3，平空1再开多1|realized46.5、closingUF8.5、net55、openFees1.5|realized50、closingUF5、net55、openFees5|

第一例 canonical 本身为 quantity0/grossRealized50/fees5/net45，因果可定位 F 费用投影；第二例总净额正确仅来自错误分项抵消。必须分别断言分项，恒等式不足以接受。`actual.json` 的 `ipo-full-close`、`ipo-reverse` 保留全链输入输出。

建议在 F 范围内让费用分配与已接受 canonical 库存事件的时间线同步；或明确将尚不能归属的分项分类为 unavailable。不能保留已知正确的 gross/quantity 却宣称当前错误净实现可用。至少覆盖 IPO 全平、部分平空、反向开多、事件之后再有 execution，以及跨期 carried fee。

### P1：raw 同 ID 数量冲突仍发布任意一份库存的市值

原源 `:131` 发现同 account/instrument/nature/run/id 冲突后保留首条并记录 `duplicate-execution-conflict`；`:164` 仅把 lineage 缺失送入 quantityReasons，冲突未按字段依赖传播。market amount 只检查 quantityReasons，故 PNL 已 unavailable，而市值仍 available。

真实管线 raw 同 ID、数量分别1与2，其余相同；报价110。实际 PNL=null，但 current quantity='1'、currentMarketValue='110'、available=true，而正确行为是数量/市值 unavailable 并保留冲突原因。交换原始行顺序可能改变发布库存；没有证据可选择1或2。`actual.json` 的 `duplicate-conflicting-quantity` 保留全链。

建议区分冲突依赖：数量、方向、成交时间/身份冲突应使受影响边界数量不可知；纯 fee 冲突可保持可信数量与市值。不要把所有冲突一概传播到市值。完全相同 raw duplicate 应仍去重为1份（本次控制 PASS）。

## 本次局部结果与边界

固定 Node26，精确 include 仅 `peer.test.ts`：5项，3 FAIL / 2 PASS，exit1。首份原始 `probes.log`、`actual.json` 保留，不覆盖失败。命令：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-peer-review/focused.vitest.config.ts
```

两项局部 PASS：完全相同 raw execution 去重，ordinary 跨期 fee bridge（realized17/openingUF48/closingUF0/net-31）。仅证明这两条输入。

静态审阅：三边界分别有 cursor，raw candle 先按可见日期/raw/身份筛选，当前 asOf 与历史期间分开；unknown fee 不直接污染可信数量；RoomFxSnapshot 生产 pair 键、正数、status、知识截止与原币小计均有明确门槛。这些方向与设计一致，但本次未独立运行全部 owner 矩阵，不能据此宣称这些领域全部 PASS。输出 FX metadata 可追到 id/source/asOf/status；未增加历史 FX 服务，也未把当前 FX 报作逐日历史汇率。

未证实的新推测不作为 defect；其他复杂 statement/非成交事件的费用归属只列为受影响回归面，须具体探针后裁定。页面/持久化/返回重载/视觉/真实 DB 本次 NOT VERIFIED。Owner freeze 后将原5项探针原样复验，另存结果和新源 hash；不由 reviewer 修改产品。
