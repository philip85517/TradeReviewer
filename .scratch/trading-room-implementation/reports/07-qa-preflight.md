# 07 本金模型独立预审

范围：只读审查 `app/lib/principal/principal-model.ts`、其单测、`app/api/trading-room/principal/route.ts`、设置 hook/组件单测，并对照首页规格 §8、§10、§12。未审正在收尾的 dashboard 装配，没有把未完成 UI 报成新缺陷，也未修改产品代码。

## 结论

**通过模型层预审，未发现新的发布级逻辑缺陷。** 07 的模型/API 契约覆盖了四类互斥本金、实盘/单模拟运行隔离、同币无 FX 计算、未知资产排除、总体 inactive 配置本金和细筛回退。最终放行仍需真实页面验证保存/重开、运行切换和提示文案。

## 逐项核对

| 场景 | 结果 | 证据/边界 |
| --- | --- | --- |
| 同币 USD/HKD 无 FX | 通过 | `ratioPercent` 在分子、分母为同一原币时直接计算；无 FX 不会阻断同币本金参考收益率。现有 USD 无快照回归得到 1%。 |
| 未知资产与 ETF 去重 | 通过 | `principalRows` 排除 `assetCategory === "unknown"`；`requiredCategories` 只从四类分类取值，ETF 只查 `etf` 池，不会进入市场股票池。未知/空样本不会被当作 0。 |
| inactive 已配置本金 | 通过 | `principalValuesForScope` 在 `all` 范围收集所有已配置分类，即使当前期间没有该类回合；总体分母按合计金额计算，不平均分类百分比。现有 20 万分母回归通过。外币 inactive 池会纳入所需 FX，缺 FX 时回退成本口径。 |
| 局部筛选与日期 | 通过 | query/account/instrument/market/currency/reviewStatus 任一细筛触发成本收益率回退；分类/全部完整范围可用本金；仅切日期不触发回退。现有 query 与日期回归通过，代码覆盖其余五个字段。 |
| live / simulation run | 通过 | `principalScopeKey` 采用 `live` 与 `simulation:<trimmed runId>` 独立命名空间；无 run id 的模拟范围不可用，不会套用实盘或其他 run。本地模型/API 隔离回归通过。 |
| 金额缺失与 FX 投影 | 通过 | 正数 Decimal 由 `normalizePrincipalValue` 校验；非法/零金额被清除并进入缺本金回退。混币种使用同一 `RoomFxSnapshot`；无快照或缺任一所需汇率时保留原币小计并回退，不伪造总体本金收益率。 |

## 实际验证

定向验证命令：

```text
npx vitest run app/lib/principal/principal-model.test.ts \
  app/api/trading-room/principal/route.test.ts \
  app/lib/principal/use-principal-settings.test.tsx \
  app/components/dashboard/room-principal.test.tsx
```

结果：4 files / 19 tests passed。覆盖 1% 成本与 2% 本金样例、20 万 inactive 分母、缺分类回退、细筛/日期、模拟 run 隔离、混币种同一快照、未知/开放回合排除、同币无 FX、非法金额及持久化失败路径。

## 给 nav 的建议（测试补强，不是当前缺陷）

1. 增加一个“只有 A 股有盈亏、inactive 美股本金为 USD、无 FX”用例，确认模型仍回退成本收益率；再用完整 FX 断言 inactive USD 确实进入总体分母。
2. 为 `accountIds`、`instrumentIds`、`markets`、`currencies`、`reviewStatuses` 各补一个细筛回退及清除后恢复本金的断言；目前单测只直接覆盖 query，其他字段由同一实现分支覆盖但缺少独立回归。
3. 增加模拟无 runId、未知资产全量范围和已配置但无交易分类的摘要断言，锁定“不可用/不缺项/不混入”的提示语义。

## 隔离 QA fixture

本金设置契约已稳定到 `PRINCIPAL_SETTINGS_KEY = "trading-room.principal.v1"`，因此仅更新 QA seed 的设置键/形状并生成新库；运行中的 v3 未改写：

```text
脚本：.scratch/trading-room-implementation/qa/seed-homepage-fixture.ts
新库：.scratch/trading-room-implementation/qa/qa-fixture-v4.sqlite
```

v4 生成结果：schema 6；instruments 10、executions 31、importBatches 7、settings 4、marketDataJobs 4、dailyCandles 2。`app_settings` 中本金 JSON 为 `{"version":1,"scopes":{"live":{...四类...}}}`，FX 仍为 `trading-room.fx` 的 ready 样例。v3 仍保留旧本金键，未被本次生成覆盖；最终浏览器 QA 应使用 v4，并单独通过 UI 保存/清空后重开验证真实契约。
