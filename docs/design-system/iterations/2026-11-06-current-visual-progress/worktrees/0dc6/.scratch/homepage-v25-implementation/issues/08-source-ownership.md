# 08 — 冻结首页真实财务来源与附件选择所有权

ID: S1
State: closed
Status: accepted-pure-module
Assignee: /root/astra_source
Model: gpt-6-astra / ultra
集成负责人及独立接受负责人: /root
验收: 1/3 PASS；纯新接口，不替代财务 seam、Metrics、HistoryChart 或已暂停 ContributionBars 的原轮数。

## Scope / What to build

仅新增 `app/components/homepage-v25/source-contract.ts`、`financial-source-model.ts` 及同名测试。将真实 raw entries、行情、FX 证据、revision 和明确的 universe/lifetime coverage，按现有附件选择规则转为一次提交拥有的不可变财务来源。保留原始 fills/episode/event/initial-position 证据，只持有最终 prepared handle；独立当前指标、期间与历史来源共享同一选择收据。未知完整范围保持未知，不根据最老一笔成交猜测 inception。

## Refs / Design coverage

冻结接口、类型、完整状态/来源合同和验收反例：[ROOT-DATA-CONTRACT.md](../evidence/P4/ROOT-DATA-CONTRACT.md)。原规格位于 `docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md`；精确章节/图像/owner/旅程/证据映射已写入该合同及 [DESIGN-COVERAGE.md](../DESIGN-COVERAGE.md)。

|需求与元素|规范及参考|owner / 旅程|接受证据|
|---|---|---|---|
|HV25-06..13 附件选择与重置|HP03、`clear-attachments.svg`、`reset.svg`、过滤参考（准确路径见冻结合同）|S1 / 市场账户与附件选择→同一来源|同 asOf current 的 openOnly、pending 审阅覆盖、完整 group key 字面反例|
|HV25-14..22 期间、独立当前金额|HP02、`period.svg`、`chart-gap.svg`、`home-1440.svg`、`home-1280.svg`|S1 / 选择→期间与当前两类来源|原始证据、未知 all bounds、货币和选择 receipt|
|HV25-32..43 历史与贡献来源|HP05、`history-stats-source-missing.svg`、`contribution-current-a-share.svg`|S1 / 同来源→后续历史 producer|不伪造完整回合或 FX clock、不重建原始成交|
|HV25-47..51 过期与失败|HP09 对应状态参考见冻结合同|S1 / 不同请求提交|完整 request key、调用方 mutation 隔离、source/selection stamp|

## Blocked by

纯接口编写/独立接受无额外依赖。实际页面发布仍受 [01 财务合同](01-financial.md)、[04 真实持仓旅程](04-holdings-journey.md)、[05 期间](05-period-performance.md)、[07 历史贡献](07-history-contribution.md) 各自接受门槛约束。

## 验收标准与反例

- [x] 真实 eligibleGroups.sources 投影保留原始冲突重复、episode/executions/event/initial position；不采用 rebuilt entries 作为财务原始证据。
- [x] complete / partial / unknown universe 与 lifetime 的 asOf/knownAt 合法性、精确时间到上海日、日期精度与月份精度分别处理，空集合与未知范围分开。
- [x] 全市场/CN/HK/US 与账户、nature、run、symbol 的完整选择收据及币种正确；openOnly 用同 asOf 的 current，pending 使用真实审阅覆盖。
- [x] 调用方 mutation 不改变 owned source，且不冻结调用方对象；不重复维护成本/费用账本或无界全局 prepared cache。
- [x] 请求键覆盖 domain/generation/scopeKey/startedAt/target；保持 S 原数值 generation 合同。
- [x] TDD 字面 RED/GREEN、root 独立反例、strict 依赖类型、lint、hash/diff 与复杂度证据。

## 接受证据与边界

新增证据仅写 `evidence/resume-2026-10-24/source/`。root 已签署 [第1/3轮纯模块接受](../evidence/resume-2026-10-24/source/ROOT-ACCEPTANCE-1.md)。纯模块不含 UI/DB 写流程，故本票 UI/数据库接受不适用；首页及后续 producer 的完整 UI/持久化/视觉仍 NOT VERIFIED。profile QUIET 期间仅编写源码与文档，禁止 CPU 测试和浏览器操作。

## 2026-10-24 qualification regression reopened

Prior 1/3 pure PASS retained. Full raw invalid fee is parsed by an unused qualifier entries rebuild before F can mark fees unknown. Same S1 task reopened; next formal round 2/3. Owner astra_finance / Astra Ultra, bounded dispatch [ROOT-DISPATCH](../evidence/resume-2026-10-24/source/qualifier-repair/ROOT-DISPATCH.md). Initial persisted-raw library assembly is a separate OPEN entry boundary, not covered by this fix.

## Root formal round 2/3

Qualification regression fixed within approved pure boundary: [ROOT-ACCEPTANCE-2](../evidence/resume-2026-10-24/source/qualifier-repair/ROOT-ACCEPTANCE-2.md), fresh 196 regression + 4 independent PASS, strict/lint exit0, 4 hashes match. F07 initial raw library assembly still OPEN and is not covered by this PASS. Prior 1/3 evidence retained.
