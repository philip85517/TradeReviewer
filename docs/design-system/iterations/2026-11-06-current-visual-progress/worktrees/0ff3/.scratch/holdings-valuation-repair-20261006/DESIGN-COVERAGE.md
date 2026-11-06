# DESIGN-COVERAGE

参考图：/var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/codex-clipboard-22a5d7f7-0e30-488a-b0ed-564425154436.png（原问题状态）；精确行为参考 IMPLEMENTATION-SPEC.md 和 assets/repair-options.md。原图不包含新状态设计，增量遵循当前 room-holdings-history.module.css。
比较视口：1440×1000、1920×1080、1055×900、821×900、820×900、390×844；同状态截图。桌面图高220，窄屏190，现有按钮36，移动/粗指针44。root owns whole-page consistency and complete persistence.

| Element / requirement | Exact reference | Owner | Journey / state | Acceptance evidence |
|---|---|---|---|---|
| E-H01 metrics/period/day/week/month | 截图持仓总览首行 + spec展示 | chart worker/root | 今年/日切市值/盈亏/收益率，保留日期键盘/触控 | chart tests + assets/first-journey.md + browser screenshots |
| E-H02 complete/partial/unknown per currency | spec财务第1–3项 | chart worker/root | 部分虚线、全额实线、未知断点、覆盖成员变化断线/点详情 | tests + first real 9/14 baseline + independent visual review |
| E-H03 tooltip and coverage | spec财务第1–4项 | chart/domain workers/root | 同图金额、每币种覆盖、小计标题、缺汇率fallback | focused tests + real date/metric selection |
| E-D01 trusted ledger/corporate actions | spec财务第4–5项 | domain worker/root | 516780已支持红股、未知事件、数量/成本分离、无未来余额 | real ledger unit fixtures + isolated DB independent reconciliation |
| E-D02 session cutoff validity | spec行情第1–3项 + market-session-research.md | domain worker/root | CN holiday, timestamp before close, US DST/HK half day, future/pretrade/currency/source invalid | calendar/valuation tests + diagnosis independently rerun |
| E-R01 automatic asynchronous daily fill | spec行情第4–5项 | refresh worker/root | visible room load/range change, once per scope/session, navigate/click chart while update | coordinator browser + dedup/retry tests + DB persistence |
| E-R02 manual retry/cancel and dynamic state | spec行情第5–7项 | refresh worker/root | overlap with auto, finite failure, partial terminal, cancel preserves/reload interrupt | focused task tests + isolated real browser flow/persistence |
| E-A01 data safety/whole-page acceptance | spec范围与交付 | root/independent reviewer | refresh two runs/multiple batches, return/reload; unchanged trades; all states visual | FINAL-ACCEPTANCE.md with PASS/FAIL/NOT VERIFIED distinct |

## 14:26 公共生命周期复修拆分（原范围不变）

E-R01/E-R02 的 UI/helper/hook owner 为 `holdings_refresh_implementation`；公共入口、锁释放、订阅取消和 durable daily receipt 的唯一 owner 为 `temporal_ledger_implementation`（Task3b，已结束其 Task2 修改）。root 负责接口集成与整体旅程；`history_state_review` 只读独立审查。

| Requirement / exact spec | Element | Reference / state | Owner / delivery | Browser action / expected / counterexample | Evidence / gate |
| --- | --- | --- | --- | --- | --- |
| spec 行情自动范围与一次尝试 | E-R01 | 原图持仓总览；visible/range/session | Task3 dashboard registry/hook | 可见范围自动 daily；切历史区间不丢已关闭持仓、不无限重试 | focused actual hook/candidate + final browser；待验 |
| spec 共享去重/排队/全局锁 | E-R01 | 更新 waiting/downloading | Task3b public workspace lifecycle | AB 与 BC、disjoint C、两个 BC waiter、full/daily 双向；等真实 lock release 后仅补缺 ID | independent actual start+lock runtime + browser；待验 |
| spec 取消保留有效缓存 | E-R02 | cancelled/return/reload | Task3b subscribers + Task3 helper/hook | 取消持仓 AB 不 abort 公共 B；取消 queued BC 不移除另一个 C；独占取消不再执行 | actual ownership probes + isolated cache/reload；待验 |
| spec 状态基于实际持久化 | E-R02 | complete/partial/failed/cancelled/recompute | Task3b daily receipt + Task3 hook | 1D 成功不受 1h 失败污染；同 requestedAt 共享有效；写失败不能旧作业冒成功 | durable failure and exact worker probes + isolated DB；待验 |
| spec 非阻塞/手动继续 | E-R02 | update/manual retry/busy | Task3 status/control | 更新中切指标/选日期；失败有限终止，重复点选给共享反馈；手动可继续 | browser mouse/keyboard + independent screenshots；待验 |

## 首次结果显示饥饿复修（15:00，原非阻塞范围）

| Requirement / exact spec | Element | Reference / state | Owner / delivery | Browser action / expected / counterexample | Evidence / gate |
| --- | --- | --- | --- | --- | --- |
| spec 首次安全快照与精确回执分离 | E-H02/E-R02 | 原图空白持仓总览；冷启动、同范围新输入排队 | holdings_refresh_implementation，Task1 history hook/controller/test 四文件；root 整体显示 owner；history_state_review 独立审查 | 首次完成结果先显示并注明更新中；同 identity 与 forward timestamp 两种；范围/FX/回退拒绝；latest 精确完成前 acceptedInput=null | actual hook/controller RED 已记录 task-3-final-source-review.md；GREEN/fresh browser 待验 |

Task3b 跨入口逻辑订阅/producer coverage 模型已由 root 批准实施；保持 workspace/test 唯一所有权与原 E-R01/E-R02 scope，cross-entry 两个 runtime FAIL 必须关闭后才能进入整体验收。

| 验证维护 | ID | 依据与唯一 owner | 验收证据 |
| --- | --- | --- | --- |
| 旧组件报价夹具应为真实已完成 session；本地 SQLite smoke 应匹配已有 schema 14 | E-D02/E-A01 | IMPLEMENTATION-SPEC.md 市场截点合同；基线 db/sqlite-schema.ts 及 sqlite-store.test.ts 的14；temporal_ledger_implementation 仅 room-holdings.test.tsx 与 tests/local-dev-storage.test.mjs | 原失败日志、相应 focused tests、最终集成 tests；不得为通过断言放宽产品报价校验 |
| 旧 hydration/navigation/manual-refresh 测试与新增自动 scheduler 场景分开 | E-R01/E-R02/E-A01 | 默认异步补齐用户合同；exact-base 对照 assets/baseline-regression-comparison.log；temporal_ledger_implementation 仅两个 legacy workspace 测试文件 | 保留旧手动/导航/持久化断言；独立 actual hook 与 workspace 74 assertions 及新专门测试覆盖默认自动流程；发现实际产品回归必须重开 |

## 最终冻结版本验收 · 2026-10-06 16:10

以上“待验 / 未接受 / RED”均为保留的历史检查点，当前裁决如下；准确规格仍为 IMPLEMENTATION-SPEC.md，无静默删减。

| ID | 最终 owner / 用户旅程 | 最终证据 | 当前门槛 |
| --- | --- | --- | --- |
| E-H01 | chart worker / root；今年、日/周/月、三指标、9/14 日期与键盘选点 | first-journey、129 domain/chart tests、真实最终浏览器与 final-delivery-real-browser.jpg | 功能/端到端/视觉 PASS |
| E-H02 | chart + history worker / root；币种独立实线/虚线/断点、成员变化；更新仍显示安全快照 | actual cold hook/controller、coverage expanded、真实下载/重算/取消/reload 与独立直接看图 | 功能/端到端/视觉 PASS |
| E-H03 | chart/domain worker / root；金额小计、coverage、缺 FX fallback | 9/14 实际 CNY/USD 小计、actual-builder missing FX screenshot、独立报告 | 功能/端到端/视觉 PASS |
| E-D01 | temporal_ledger_implementation / root；只向后传播可信余额、支持红股、缺数量成本保留 | 20 actual builder 反例、domain reconciliation、projection-final-coordinator、129 tests | 功能/端到端 PASS；无新增专属 UI，沿 E-H03 视觉 |
| E-D02 | temporal_ledger_implementation / root；date-only/UTC、节假日、session、未来/成交保护 | domain-cutoff-precision-before-final、市场研究、129 tests 与真实 9/14 | 功能/端到端 PASS；沿 E-H03 视觉 |
| E-R01 | holdings_refresh_implementation + public lifecycle owner temporal_ledger_implementation / root；当前8→历史39、手动加入同任务、切换不阻塞 | 74 actual assertions、17 permanent tests、冷 hook、真实 browser/database/reload | 功能/端到端/视觉 PASS |
| E-R02 | 同上 / root；waiting/downloading/recompute、partial/failed/cancelled/retry/complete、共享订阅安全 | 精确新 1D receipt 与 actual worker probe、真实取消/重试/cache、真实组件三终态+重试完成截图、独立视觉 review | 功能/端到端/视觉 PASS；夹具不替代 SQLite |
| E-A01 | root + independent history_state_review；整页六视口、真实保护数据与持久化、当前预览交付 | FINAL-ACCEPTANCE、final-browser-journey、final-delivery-integrity-check、独立看图报告、3031运行与最后截图 | 三核心门槛 PASS；全仓 CI FAIL / device touch NOT VERIFIED 单列 |

具体 log、图 SHA 与失败历史见 FINAL-ACCEPTANCE，不用单项 PASS 取消全量 FAIL，不以窄屏替代触屏，不以 mock 回调替代业务持久化。原 Wayfinder 数据边界票仍按真实地图保留。
