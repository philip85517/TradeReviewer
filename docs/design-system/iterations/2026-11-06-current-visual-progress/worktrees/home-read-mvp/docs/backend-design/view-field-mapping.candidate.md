# 四页面字段映射（候选）

日期：2026-10-31。用于回应独立审查 [Q01][Q01]，作为[视图驱动数据模型候选稿][MAIN]的逐项附件。**这是字段与证据交叉表，不是批准表结构、迁移方案或实现验收。** 范围为首页 H01–H32、交易库 T01–T19、复盘 E01–E22、导入 I01–I17，共 90 项历史调查编号；H/T 编号对应原报告带连字符的 H-/T- 编号，I 编号是调查索引，不是已批准元素 ID。2026-11-04 修正已发现的交易库 V2.0 差异，但这套旧编号尚未对新版交易库及复盘提案重新完整盘点，不能据 90 项认定新版覆盖通过。

复用三份调查：[首页/交易库][HT]、[复盘/导入][EI]、[当前模型][CURRENT]。本次仅为精确区分字段，又读取了它们所引的 `db/sqlite-schema.ts`；没有连接数据库、初始化存储、运行应用或验证页面。下面的“当前”指静态源码定义，不证明实际数据库已迁移、行值完整、控件接线或运行正确。仅本文件由本次补充创建。

## 1. 怎样读取本表

| 标记 | 严格含义 |
| --- | --- |
| **S：已核对表字段** | 已核对建表/迁移源码中的列名及约束。只证明 schema 定义；JSON 容器存在不证明内部字段、数据或业务语义已完整。下表 S01–S12 是可复用的字段字典。 |
| **B：浏览器计算/临时状态** | 调查直接观察到当前浏览器计算链或组件临时状态；不是新增持久表。静态观察不证明 UI 运行或持久化通过。 |
| **U：未核实** | 没有足够证据确认现有字段、JSON 内部形状、接线或持久化。即便批准设计要求它存在，也不升级为 S/B。表中“候选”列的字段一律是逻辑建议名，不能当作现有列。 |

**候选输出共同合同 `M`。** 每个金额/计数/比例结果携带 `metricKey, grain, groupKeys, dateBasis, from/to, timezone, nativeCurrency, reportingCurrency, value, components, validity, coverage, missingReason, formulaVersion, sourceManifest, asOf`；比例额外有 `numerator, denominator, denominatorDefinition`，不适用字段显式说明。`validity` 区分完整、部分已知、总量不可算、无对象、未来及失败；精确十进制与显示缩写分开。它是候选合同，现存实现不能据此认定齐备。只有同币种、范围/规则/覆盖相容的基础量才允许合并；比例不能求和或平均，市值截面不能跨日相加。

**候选依赖简称 `V`。** `Vt`=现有 `BookVersion={databaseId,epoch,sequence}`；`Vi`=证券展示资料；`Vm`=行情/复权/覆盖/可知边界；`Vf`=FX 及适用时点；`Vr`=复盘文档修订及完成证据；`Vrule`=算法、配对、字典、结果结构版本；`P`=候选相容发布版本；`Q`=候选查询身份（范围、日期口径、搜索、排序、币种）；`N`=导航/草稿快照。**当前只有 Vt 的完整三元组及其覆盖范围被调查证明；不能把 Vi/Vm/Vf/Vr/Vrule/P 当作已有统一版本列或通知机制。** Vt 不含证券名称/本地化、行情、FX settings、review/recall；见[版本边界][CVERSION]。每行写“依赖”表示必须绑定的候选依赖，不代表已实现。

## 2. 可反查的当前字段字典

| 引用 | 已核对的当前表/列（S） | 未获证明的语义或映射 |
| --- | --- | --- |
| S01 证券 | `instruments.id,symbol,name,market,currency,metadata_json,localized_name_json`。[定义][SC-INSTRUMENT] | 独立 `exchange`、`assetClass` 列未在所读 schema 发现；不能仅因有 `metadata_json` 断言其内部规范和完整性。证券名称不在 Vt 中。 |
| S02 成交/活跃性 | `executions.id,import_batch_id,instrument_id,account,side,executed_at,quantity,price,fee,currency,evidence_json,trade_nature,simulation_run_id`；`execution_fact_states.execution_id,state,revision_id,reason,recorded_at`，缺状态行按 active。[成交][SC-EXEC]、[性质][SC-NATURE]、[状态][SC-FACT] | account/fee/currency 可空；数量/金额 TEXT 不等于已验证十进制。没有从所读列证明全局账户主表、时间精度/源时区、practiceId、稳定 roundId 或每条费用分摊。 |
| S03 批次 | `import_batches.id,source_fingerprint,source_name,source_type,imported_at,record_count,reconciliation_json,evidence_json,trade_nature,simulation_run_id`。[定义][SC-BATCH]、[性质][SC-NATURE] | `record_count` 不能未经映射当 rawRows/pairs/executions/rounds/practices 或实际新增数；`imported_at` 不能代替实际练习日期；文件名不是账户/证券/成交日期。 |
| S04 来源谱系 | `source_materials.id,current_version_id,created_at`；`source_material_versions.id,material_id,supersedes_version_id,parser_version,source_kind,locator_json,file_fingerprint,scope_json,diagnostics_json,content_json,legacy_batch_id,recorded_at`；`source_observations.id,version_id,observation_key,identity_status,locator_json,raw_json,original_account_id`；`source_execution_links.observation_id,execution_id,reason,recorded_at`。[定义][SC-SOURCE] | JSON 内部的源行、库存、cash、TV pair/report 指标及时间精度字段尚未逐型核实。source observation 不应被假定总是一行成交。版本、观察、关联独立于 execution。 |
| S05 来源账户映射 | `source_material_account_mappings.material_id,original_account_id,canonical_account_id,reason,audit_reference,recorded_at`。[定义][SC-ACCOUNT] | 是来源范围映射，不是通用账户目录；不能用显示标签推断稳定账户身份或模拟练习身份。 |
| S06 审核/回执 | `trade_change_plans.id,policy,created_at,expires_at,body_json,body_digest,receipt_id,choices_digest`；`trade_change_receipts.id,plan_id,receipt_json`；`trade_change_requests.request_id,request_digest,receipt_id`。[定义][SC-PLAN] | 计划/回执 JSON 中各业务计数与控件字段尚未逐字段核实；不能声称存在 `inputDigest/bookRevision/allowedChoices` 物理列。已有不可变约束、幂等请求与保存后读状态机见[当前调查][CWRITE]。 |
| S07 行情/覆盖 | `daily_candles`：instrument/date/adjustment、OHLCV；`market_candles`：instrument/interval/timestamp/adjustment、OHLCV；两者有 `provider,provider_symbol,currency,fetched_at`，区间有 `knowledge_at`；`coverage/interval_coverage` 的范围、`details_json,updated_at`。[行情][SC-MARKET]、[补充列][SC-PROVIDER] | 覆盖范围不证明边界价格合法；没有从这些列推断统一 Vm 或业务日估值政策。每日与区间时间、fetched/knowledge/业务时点不能混用。 |
| S08 设置 | `app_settings.key,value_json,updated_at`；调查已定位现金基准、临时本金和 FX 设置读写。[定义][SC-SETTINGS]、[用途][CSETTINGS] | JSON 中完整字段合同未在本表补核；参考资金不是可信净值/完整现金流，当前 FX 不是历史任意日 FX。 |
| S09 复盘文档 | `recall_documents.episode_id,draft_json,finalized_json,revision,updated_at`；legacy `reviews.episode_id,instrument_id,cursor_json,plan_json,review_json,drawings_json,revisions_json,confirmed_tags_json`。[定义][SC-DOC]、[legacy][SC-LEGACY] | episodeId 与候选 roundId 的稳定迁移关系未定；draft/formal 是已有容器，Text/drawing/decision 的 JSON 内部逐字段持久化未核实。 |
| S10 计划/风险 | `recall_plan_versions` 的 episode/version_kind/document_revision/entity_id、plan/decision/parent IDs、state/kind/direction/currency、entry/initial_stop、size_input_mode/value、resolved_quantity、capital_*、recorded_phase/at、knowledge_cursor/execution_cursor/has_seen_future、retained_at；`recall_plan_targets` 的 price/quantity/ratio/ordinal；`recall_risk_baselines` 的 plan_version_id、scope、decision_id、amount/currency/method/method_version/frozen_at；还有 rounding/quantity_step/budget_* 等迁移列。[计划][SC-RECALL-PLAN]、[补充][SC-RECALL-SIZING] | 字段存在不证明所有控件使用同一数值权威、初始分母冻结或回放边界运行正确。现有 `method_version='risk-v1'` 不自动成为候选全局 Vrule。 |
| S11 评价/关联 | `recall_exit_evaluations` 的 evaluation/captured_decision IDs、early_exit/adherence/reason/reason_detail、compared_plan_version_id/target_id、dictionary_version/source/recorded_*、knowledge_cursor/execution_cursor/has_seen_future；关联表含 evaluation→decision status、execution IDs、Text/snapshot evidence 及 tags；selection 按 decision→evaluation。[定义][SC-EVAL] | completion predicate 与库内 pending 的单位/接线未核实；人工原因不是自动因果推断，null 与否分开。 |
| S12 留存/实际指标 | `recall_retained_bundles` 的 episode/version_kind/document_revision/entity_id/snapshot_id/capture_revision/retained_at/evidence_digest/evidence_json/decisions_json、capture_phase/cursor/execution_cursor/timeframe/viewport_json/has_seen_future；bundle→plan/baseline/evaluation 关联。`recall_actual_metric_sources` 的 status/missing_reason/method_version/capture_revision/evidence_digest/computed_at、risk_*；`recall_actual_metrics` 的 scope/scope_id/metric_key/value/reason/currency/unit/method_version，另有 refs/exits。[留存][SC-BUNDLE]、[捕获][SC-CAPTURE]、[指标][SC-ACTUAL] | 图像、Text/绘图身份修订、导出流水的完整物理映射未核实；不是每次当前游标计算都已存在一条实际指标记录。 |

## 3. 首页：H01–H32

每行编号链接落在 [H/T 原调查][HT] 对应行，仅用于追溯当时依据；交易库当前依据见第 4 节的 V2.0 正文和业务规范。候选对象名与字段均为逻辑名，同一结果可服务多控件。

| 历史调查编号（旧版链接） | 候选对象、键与关键字段 → 读结果 | 当前现状（S/B/U） | 计算、范围、缺失与依赖 |
| --- | --- | --- | --- |
| [H01 市场][H01] | `Scope(scopeId).market,nature,accountRefs,reportingCurrency` → 全页范围 | S01 的 market/currency，S02 的 nature/account 可作输入；U 当前控件接线与 Scope 持久化。 | all/a→CNY、hk→HKD、us→USD；同一 Q/P 原子换组；Vt/Vi/Vm/Vf/Vrule，未知市场不推断。 |
| [H02 账户][H02] | `AccountReference(accountRef).label,nature,status` + Scope.accountRefs → 当前值/选项 | S02.account、S05；U 全局账户主表、目录完整性、ID 归一规则。 | 不把来源账户/显示名当全局主键；选项失败保留当前选择；账户映射变更影响 Vt，label 需 Vi 类依赖。 |
| [H03 全局搜索][H03] | `InstrumentSearch(instrumentRef).name,symbol,exchange,assetClass,currency`；`N.query,selection` → 候选集 | S01 基础资料；U exchange/assetClass 的 JSON 字段、搜索范围/索引/接线；300ms/IME 是浏览器交互要求，非已验证 B。 | 实体粒度，不能只按 symbol 合并；覆盖无交易标的及是否受 scope 限制待决；Vi/Q，候选响应须对应当前查询。 |
| [H04 搜索详情][H04] | `PositionDetail(instrumentRef,scopeId,asOf,P)` + `N.searchSnapshot` → 数量/成本/价/市值/浮盈、返回 | S01/S02/S07 输入；B 当前持仓模型已有分项状态[见调查][CCALC]；U 搜索详情完整接线与 N。 | 复用持仓结果不另算孤立数字；N 含 query/scroll/focus；缺价/成本带原因；Vt/Vi/Vm/Vf/Vrule/P。 |
| [H05 附加筛选][H05] | `FilterDraft(scopeId).assetClasses,openOnly,pendingReview` 与 `AppliedFilter` → 条件计数/结果 | S01 元数据容器、S02 成交、S09 文档存在；U 类别/完成谓词及当前草稿接线。 | 待复盘是显式的成交复盘状态，与是否留仓无关；状态与回合、标的的映射仍需细化。维内 OR/维间 AND；openOnly 看剩余仓位，含浮盈零；不按 PnL 非零筛；Vt/Vi/Vr/Vrule/Q。 |
| [H06 应用/清除/默认][H06] | `FilterTransition(requestId).draft,applied,previous,status,error` → 原子切组/标签 | U 当前事务式 UI 状态、默认全集与标签移除时机；不应新增成交列。 | 成功换 Q/P，失败保留 prior applied+draft；clear-extra/reset-default 边界按规范，N 记录草稿作用域。 |
| [H07 期间][H07] | `PeriodSelection.rangeMode,from,to,draft,error` → 三项期间 KPI/日曲线/当前贡献 | B 当前收到 source 后可重投影期间[见调查][CCALC]；U 全部控件/日期草稿接线。 | 上海业务日期；不影响最新持仓或历史范围；Vt/Vm/Vf/Vrule/asOf/Q；非法区间不应用。 |
| [H08 当前四卡][H08] | `PeriodResult(groupKeys,from,to,P).realized,openingUnrealized,closingUnrealized,unrealizedChange,net,fees` + `PositionSummary(asOf).marketValue`，均带 M | S02/S07/S08 输入；B 当前 browser financial endpoint[见调查][CCALC]；U 持久 PeriodResult/P。 | 前三：R + Uend − Ustart，R 按实际平仓日扣费含部分平仓/空头；第四最新截面非现金/负债；不同计算时点统一采用最新汇率，成本规则仍需设计；缺值非零；Vt/Vm/Vf/Vrule。 |
| [H09 市值说明][H09] | `PositionSummary(asOf).unrealized,nativeMoney,quoteRefs,fxRefs,coverage,missingReason` → 说明 | S07 价/来源时间，S08 FX 容器；B 当前持仓状态/coverage；U 统一历史 FX、物理汇总表。 | 最新合法价×剩余数量；保留原币及 FX source/asOf/direction；空头市值净额/绝对额待决；同 H08 依赖。 |
| [H10 日曲线][H10] | `DailyResult(groupKeys,businessDay,P)`：dateBasis=valuation、positionValue/unrealized/realizedToDate/netToDate/periodNet/fees + M → 点/读数 | S02/S07/S08；B 当前 financial view 计算链；U 预存每日结果、完整累计基准。 | 每日边界估值，不能最新价回填；periodNet 与累计两字段分开；累计起点/基准待决；Vt/Vm/Vf/Vrule/from/to/asOf。 |
| [H11 缺口/未来/零][H11] | `DailyResult.validity,missingReason,coverage` + `GapRange.from/to/reasons` → 断线/灰区/0 | B 当前边界 future/source-missing/value 与 unavailable 输出[见调查][CCALC]；U 逐设计状态完整接线。 | 缺失不插值不补零；自然日/交易日轴与有效点分开；累计受前置缺口影响，不猜生命周期起点；同 H10。 |
| [H12 持仓行][H12] | `PositionResult(accountRef,instrumentRef,nature,runRef,settlementCurrency,asOf,P).quantity,costPrice,holdingDays,quote,marketValue,unrealized` + M | S01/S02/S07；B 当前 grouping/holdings model 保留数量、成本、quote/PnL 状态[见调查][CCALC]；U 已发布表。 | 只剔除已知零仓位，保留未知；实盘同一证券跨所选账户按交易时间合并到同一标的；相反方向的数量和成本计算、持仓天数起算仍需设计验证；Vt/Vi/Vm/Vf/Vrule。 |
| [H13 持仓汇总][H13] | `PositionSummary(scopeId,P).marketValue,unrealized,totalCount,coverage` → 标题并列值 | B 当前模型汇总来自完整 current facts；U 局部查询是否应进入 summary scope。 | 不能汇总当前页；局部搜索与汇总关系待决，不预设；同 H12，Q 须表达采用的 scope。 |
| [H14 局部搜索][H14] | `PositionQuery.query,matchedCount` + `PositionIndex(P,positionKey).searchValues` → 行集/无匹配 | B 当前持仓结果是可用输入；U 匹配字段/规范化/索引、控件接线。 | 只过滤表，300ms/IME；改变查询回第一页；区分零持仓与无匹配；Vi/P/Q/N。 |
| [H15 持仓排序][H15] | `PositionIndex(P,positionKey).sortValues,sortValidity` + `Q.sort,tieKey` → 全量排序后页 | S02/S07/S08 原始输入，B 当前持仓金额可算状态；U 允许列、默认/tie-breaker、物理索引。 | all 先统一 CNY 再排金额；FX/coverage 不足禁用并说明；稳定末级键为候选要求，具体键待决；P/Q/Vf。 |
| [H16 持仓导出][H16] | `ExportSelection(Q,P).allFilteredPositionKeys,columns,precision,sourceManifest` → 全筛选集文件 | S/B 输入同 H12；U 文件格式/列序/元数据及实际导出链。 | 非当前页，保留完整精度，0 条禁用；冻结 P/Q，防下载期间版本混合。 |
| [H17 持仓分页][H17] | `Page(Q,P).pageSize=8,page,totalMatched,pageCount,rows` → 8 槽/边界 | U 现有分页接线及 cursor 存储；不能用来源 API 的1000条页代替 UI8行。 | 全量筛选排序后分页；0 不伪1/1；50→7页；删除后的 clamp/恢复待决；P/Q/N。 |
| [H18 持仓详情/返回][H18] | `PositionDetail` + `N.originRow,query,sort,page,scroll,focus` → 完整身份/查看交易 | S01/S02/S07，B 持仓模型；U 详情及跨导航恢复接线。 | 缺成本“暂无”、缺价“待更新”；行消失回标题；按 source scope 查询而非固定首标的；P/Q/N。 |
| [H19 历史范围][H19] | `HistorySelection.yearMode,from,to` → 历史闭合范围 | S02.executed_at 只是成交时间；U 稳定 closedRound/closeDay 和当前历史读取；当前 history seed 明示 not-wired[见调查][CCALC]。 | 按真实平仓日，开放不入；仅影响历史组/历史贡献；Vt/Vrule/Q，补录修正须重建。 |
| [H20 历史四卡][H20] | `ClosedRoundResult(roundRef,ruleVersion).closeDay,net,fees,validity` → `HistorySummary.net,closedCount,winCount,winRate,fees` + M | S02 原始事实；S12 captured 实际指标不是全库历史回合表；U 稳定回合/费用分配与历史读结果；历史 not-wired。 | winRate=Σ(net>0)/Σ合格闭合回合，0分母 null；含平手不能平均百分比；净额/费用只在币种及规则相容时加；Vt/Vf/Vrule。 |
| [H21 历史曲线][H21] | `HistoryBucket(scope,bucketStart,bucketEnd,dateBasis=closeDay,P).net,fees,winCount,closedCount,cumulativeNet` + M | U 持久分桶与页面接线；S02 可作输入但不直接按 execution 日求和。 | 单年按月、多年按年；累计从选定范围起点，缺口向后传播；胜率分子/分母重算；同 H20，不能按月序号作日期。 |
| [H22 历史状态][H22] | `HistoryBucket.state=noRounds/validZero/missing/future/failed,reason,unit,grain` → 提示/断线 | U 全部状态接线；B 当前公共 financial boundary 有状态概念，不证明历史完成。 | 无回合≠净0，保留真实回合数；失败留 prior scope/P；tooltip 不导航；同 H19–21。 |
| [H23 贡献模式][H23] | `ContributionQuery.mode,periodRef/historyRef,perModeState` → 同一区域两种数据 | U 持久/当前接线；B 当前期间 financial 计算可复用。 | 无第三套日期；当前用期间，历史用 closeDay 范围；Vt/Vm/Vf/Vrule/P/Q/N。 |
| [H24 市场/标的下钻][H24] | `ContributionResult(P,market/instrumentRef).components,total` + `N.drillPath` → 3市场→标的→详情 | S01 market，B 财务源输入；U 贡献汇总及钻取接线。 | market→symbol 同源同 Q/P；局部下钻不改全局 all；3市场不套8行；Vi/Vt/Vm/Vf/Vrule。 |
| [H25 分类/未平仓][H25] | `ContributionClassification(groupRef).long/short/ipo,evidenceRefs` + `Q.openOnly` → 分类集合 | S02 side/nature/evidence 容器；U IPO获配分类、残仓与审计映射。 | long/short/ipo 互斥；IPO限获配及后卖；普通上市买入归 long；历史禁用但记忆 openOnly；不按浮盈非0；Vt/Vrule。 |
| [H26 贡献排序分页][H26] | `ContributionIndex(P,objectKey).net,sortValidity` + `ContributionSummary.allFilteredTotal` + Page8 | U 全量索引/接线、同值及缺值位置；输入同 H24。 | 盈利降序/亏损升序，全量合计非当前页；明细8/页、市场3行；P/Q/N，币种及金额口径同 H27。 |
| [H27 贡献组成][H27] | `ContributionResult(groupKeys,range,P).realized,unrealizedChange,total,partialKnown,totalValidity` + M | B 当前 endpoint 分 realized/opening/closing/change/net[见调查][CCALC]；U 贡献持久结果与完整对账。 | 当前 R+Uend−Ustart，包括已平部分期初浮盈；历史仅合格闭合回合净额；按分判真0只属显示，不改原精度；历史 symbol/round 展示粒度冲突待决；Vt/Vm/Vf/Vrule。 |
| [H28 贡献返回][H28] | `N.mode,category,sort,drill,page,scroll,focus,sourceScope` → 原上下文 | U 当前详情容器与返回接线；原型详情只是占位。 | 对象消失回贡献标题，其余有效条件保留；目标实体+P/Q 独立于来源 N。 |
| [H29 普通库入口][H29] | `LibraryTarget.scope=live,rangeMode,from/to,market,accountRefs,instrumentRef` + 独立 N → 目标查询 | S01/S02 可定位输入；U 完整 URL/状态接线。 | 普通无 queue、无数量徽章；all不带起止；身份保留交易所等歧义信息；Q/N，不能用来源快照代替 target。 |
| [H30 日期入口][H30] | `LibraryTarget.dateBasis=executionDay,day,market,accountRefs` + N.dateFocus → 当日成交 | S02.executed_at；U 日期动作展开位置、业务日归属转换与导航接线。 | 保留未平仓成交；不是 closeDay；历史 tooltip 不自动成为入口；Vt/Q/N/时区。 |
| [H31 刷新/返回][H31] | `N(home).appliedFilters,period,history,holdingQuery,contributionStates,scroll,focus` + Target URL → 重建 | U 当前完整快照序列化/兼容性；S/B 财务来源可重新读取不证明状态恢复。 | N 与 target Q、数据 P 分开；需 snapshot schemaVersion；对象消失回所属标题，不随机选行。 |
| [H32 加载/修复][H32] | `ReadState(Q,P).initial/stale/empty/error,asOf` + `RepairJob(id).scope,gaps,completed,total,status,remainingReasons` → 全页一致状态 | S07 覆盖/job定义可作输入[见调查][CURRENT]；B 当前财务缺失状态；U 统一修复任务、范围、控件接线。 | 唯一全局修复；不改原始成交；更新后整体读同 P，进行中防重复；失败保留旧完整结果与原因；Vt/Vm/Vf/Vrule。 |

## 4. 交易库：T01–T19

**版本说明：** 以[交易库业务规范](</Users/zhoulin/Documents/TradeReview/docs/design-system/trading-library-design-spec.md>)和[视觉 V2.0 正文](</Users/zhoulin/Documents/TradeReview/docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/visual-design.candidate.md>)为当前规则，配合[视觉 V2.0 画面](</Users/zhoulin/Documents/TradeReview/docs/design-system/baselines/2026-10-26-trading-library-v2.0/visual-spec.html>)审阅。T 编号的链接仍指向旧调查以保留追溯，不作为新版权威；以下修改不等于已完成新版全部控件清点。

| 历史调查编号（旧版链接） | 候选对象、键与关键字段 → 读结果 | 当前现状（S/B/U） | 计算、范围、缺失与依赖 |
| --- | --- | --- | --- |
| [T01 来源/返回][T01] | `LibraryTarget` + `N.origin` → 只读条件摘要/返回 | S01/S02 输入；U 到达即生效、URL及返回接线。 | target Q 与 source N 分离；库内调整不回写首页；P/Q/N。 |
| [T02 实盘/模拟][T02] | `LibraryQuery(viewScope).date,market,accountRefs,search,sort,page` + per-view N | S02/S03 nature/run；U practice/account/run 的完整身份映射及控件记忆。 | 不混实模拟；一份独立文件代表一次练习，等价重复文件归原练习，账户可包含多次练习；各视图独立状态。 |
| [T03 日期][T03] | `LibraryQuery.from/to,rangeMode,timezone,dateBasis`；练习含 `practiceDate,dateSource,tradeRange,importedAt` | S02.executed_at、S03.imported_at；U 练习日期及来源和 closeDay 持久映射。 | 实盘列表按成交日、实盘统计按平仓日、模拟列表和统计按已确认练习日期；历史交易区间及导入时间不能代替练习日期。 |
| [T04 市场/账户][T04] | Scope + `LibraryQuery.viewScope` → 当前集合 | S01/S02/S05；U 通用账户目录/模拟控件完整设计。 | 连同日期进入 Q；切视图不覆盖另一视图；不得因分布下钻更改顶部条件；Vt/Vi/Vrule。 |
| [T05 搜索/刷新][T05] | `LibraryIndex(P,rowRef).searchValues,sortValues` + ReadState(Q,P) | U 搜索字段/默认排序/pageSize/索引接线；不能宣称首页8行规则通用。 | 局部搜索，刷新保留 Q/N，最后有效请求胜出；Vi/Vt/Vr/Vrule/P；空/错误不改工具几何。 |
| [T06 待复盘][T06] | `ReviewMembership(targetRef,reviewRevision).status,reason,completionEvidenceRef` → pending筛选 | S09/S11/S12 存在文档/评价/留存；U target单位、完成谓词及 queue 接线。 | 普通入口不隐式 pending；必须决定成交/回合/标的哪个单位，不能用“有文档”代替完成；Vt/Vr/Vrule/Q。 |
| [T07 实盘列表][T07] | `ExecutionListItem(executionRef)` 或经批准的 `InstrumentListItem`：date/symbol/side/price/qty/status → 标的回合集 | S01/S02 直接字段；U 一行每成交还是标的聚合的最终契约、status派生。 | 过滤按逐成交日且保留开放；列表行粒度未定，候选不提前聚合丢成交；Vt/Vi/Vr/Vrule/P/Q。 |
| [T08 标的回合集][T08] | `RoundCollection(instrumentRef,scope,Q,P).roundRefs,openingContextRefs`；`LiveRound.closeActionRef,allocationRefs` | S02 原始事实；U 主动平仓识别、稳定 roundId、物理结果与关联。 | 一次主动平仓是一回合，即使有多份配对或技术拆单；范围外开仓仅补上下文；操作识别规则待定。 |
| [T09 练习列表][T09] | `Practice(practiceId).instrumentRefs,accountRef,runRef,materialRef,practiceDate,dateSource,tradeRange,importedAt,stableOrdinal,executionCount,internalMatchCount,openPositionStatus` + 练习数与内部配对预览 | S02/S03 simulation_run_id、source 谱系；U practiceId、练习日期、稳定编号与来源映射。 | 一个独立导入文件是一练习；实际成交条数、内部配对数与未平仓状态分别显示；等价重复不新增；一练习可含多标的，多标的显示名称待定；同标的同日不同练习用稳定序号区分；日期须导入前确认。 |
| [T10 练习内部配对][T10] | `MatchAllocation(matchId).practiceRef,openExecutionRef,closeExecutionRef,quantity,allocationOrdinal,feeAllocation,ruleVersion` 与 `openRemainder.quantity,status` | S02 原事实；U 配对物理持久、稳定身份与来源规则。 | 内部配对用于练习详情，不能作为练习汇总样本；保存顺序、余量及费用依据，各来源规则须核实。 |
| [T11 复盘/返回][T11] | `ReplayTarget.liveRoundRef` 或 `ReplayTarget.practiceRef,matchRef`，以及成交上下文和 `N.returnChain` | S09 episode 文档；U 回合/练习配对到 episode 的映射及逐层恢复。 | 实盘进入回合复盘；模拟从练习详情进入内部配对回放。具体关联与稳定身份待核实。 |
| [T12 列表/统计][T12] | `ExecutionQuery(executionDay)`、`LiveRoundQuery(closeDay)`、`PracticeQuery(practiceDate)` | S02 可供成交列表；U 回合/练习结果和接线。 | 实盘列表保留开放成交，统计按已完成实盘回合；模拟列表与汇总以练习为单位，开放剩余持仓不取消练习资格。 |
| [T13 趋势][T13] | `LibraryBucket(scope,bucketStart/end,dateBasis,P).net,fees,liveRoundCount,practiceCount,computableCount` + M | U 预存分桶/曲线语义；S02 输入不能直接成为统计净额。 | 实盘按平仓日和回合，模拟按练习日期和练习；缺失数单列；趋势周期和边界按 V2.0 核对。 |
| [T14 统计卡][T14] | `LibrarySummary(scope,P).liveRoundCount,practiceCount,computableCount,missingCount,winCount,flatCount,net` + M | S02 事实，S12 仅 captured 指标；U 全库回合/练习聚合。 | 模拟胜率=盈利练习数/净额可计算练习数；平持计分母、不可算单列；总练习数含不可算。实盘另按有效已完成回合。 |
| [T15 分布][T15] | `Distribution(scope,unit,metricKey,definitionVersion,P).populationRefs,denominator,validCount,missingCount`；`Bucket(bucketId).bounds,count,share` + M | U 收益率输入、桶边界/金额阈值/物理结果。 | 实盘按合格回合，模拟按练习；金额与收益率可计算资格分别统计。收益率需该练习初始资金大于零；桶端点及具体展示按 V2.0 复核。 |
| [T16 桶下钻][T16] | `BucketMembership(distributionId,bucketId,subjectRef)`，主体类型为实盘回合或模拟练习；附标的、净额、收益率、状态 | U 稳定成员集与导航；S01/S09 为部分输入。 | 下钻不修改顶部范围与原分母；实盘和模拟的主体不能混用；同一发布版本、规则版本与返回状态。 |
| [T17 缺失/极值][T17] | `Computability(subjectRef,metricKey).validity,reasons` + `DistributionCoverage.total,valid,missing` | B 财务源有不可用语义；U 交易库各指标可算性/分母接线。 | 有剩余持仓却无练习结束价时整体净额不可算；净额已知但初始资金缺失时仍可计金额胜率，收益率不可算；不能当零。 |
| [T18 请求状态][T18] | `ReadState.requestId,Q,P,status,stale,error,retry` → 整组一致显示 | 现保存链有后读状态[见调查][CWRITE]，U 交易库全读取接线。 | 首载占位，后台留旧完整组；仅最后有效请求应用，失败留旧范围；P/Q/N，不拿 save回执代替页面 ready。 |
| [T19 保存/刷新/重开][T19] | `ReviewSaveReceipt(reviewRef,revision)` → ReviewMembership/round collection invalidation + N | S09 revision、S11/S12；U 全流程与稳定重绑；本次未做持久化验收。 | 保存→返回→reload→reopen同对象；Vr 与 Vt 分别依赖，重组需确认不能静默换绑定；P/N。 |

## 5. 复盘：E01–E22

旧版元素及时间/计算合同见 [E/I 逐项证据][EI]；[较新复盘工作区提案](</Users/zhoulin/.codex/worktrees/80b0/TradeReview/docs/design-system/baselines/2026-10-22-review-workspace-v1.0/README.md>)仍待审阅且新版逐项映射未完成。字段存在与防未来信息、保存原子性、视觉接线三项不可互相代替。

| ID／批准需求依据 | 候选对象、键与关键字段 → 读/写结果 | 当前现状（S/B/U） | 计算、可见性与版本依赖 |
| --- | --- | --- | --- |
| [E01 顶栏][E01] | `ReplayContext(roundRef).instrumentRef,nature,sourceRefs,period,saveState` + N.return | S01/S02/S09；U round身份、时间精度、顶栏/返回接线。 | period切换不推进 execution cutoff；保存状态来自服务端结果；Vt/Vi/Vr/Vm/Vrule/N。 |
| [E02 阶段语境（旧编号）][E02] | `ReplayState.phase,marketCutoff,executionCutoff,hasSeenFuture,snapshotRef` | S10双cursor/phase/future，S12捕获字段；U 当前游标/phase JSON及完整行为。 | 新版提案不再以阶段作为常驻导航；阶段仍用于内容、导出和快照语境。行情与成交截止分开，还原不抹已看未来；具体新交互待设计批准。 |
| [E03 绘图工具][E03] | `Drawing(drawingId,revision).type,params,anchor,ownerDecision/global,style` → 文档/留存引用 | S09 drawings/文档JSON容器；S11 evidence有drawing_id/text_revision/owner_id；U 完整Drawing内部字段与持久映射。 | 工具/撤销不推进回放，编辑按焦点；旧快照不被后改；Vr/N，按稳定ID不按内容去重。 |
| [E04 K线/量][E04] | `ReplayBar(instrument,period,timestamp,adjustment,Vm).OHLCV,completed,knowledgeBoundary` → 当前可知bars | S07实际字段；U completed判定/严格cutoff查询、当前图接线。 | 不画透明未来/未完成当前周期bar，不借未来极值定轴；缺行情不合成；Vm/Vrule/marketCutoff/timezone。 |
| [E05 轴标签][E05] | `PlanVersion` 价格 → 浏览器 `ChartCoordinate(price,viewport)` → 轴/图标签 | S10价格字段；U 侧栏/图同源及resize坐标接线。 | 不另存一份权威price；空/非法不画；N.viewport变化只重投影不改Vr/cutoff。 |
| [E06 计划线][E06] | `PlanVersion(planId,versionId).direction,entry,initialStop,targetRef` → 虚线/输入双向 | S10 direction/entry/initial_stop、targets.price、parent_version_id/kind；U图上联动。 | 初始留存冻结，调整/修正新版本，不倒改risk；Vr/Vrule，缺值非法不造线。 |
| [E07 成交标记][E07] | `ExecutionMarker(executionRef).time,precision,side,qty,price,fee,sourceRef,decisionRef` | S02事实、S11评价execution关联；U通用decision→execution grouping/timeprecision字段。 | readonly，executionCutoff与showExecutions共同约束；首买不提前画，未知fee非0；Vt/Vrule/Vr。 |
| [E08 图上Text][E08] | `Text(textId,revision).raw,style,owner,anchor,occurredAt,recordedAt,knowledgeCutoff,hasSeenFuture` | S09文档/绘图JSON；S11 evidence身份列；U Text完整shape/存储与时间来源。 | 按ID+rev继承/导出不按字符串；离屏仍保存；已看后续后补记留标签；Vr/N，snapshot冻结引用。 |
| [E09 侧栏开关][E09] | `N.leftOpen,rightOpen,autoExpand,manualPin,focus,viewport` + 临时草稿 → layout/resize | U 现有状态及焦点接线；设计要求浏览器布局状态，不新增事实列。 | 新版提案左右栏独立开合，并区分自动展开和手动固定；不推进双cursor、不fit-all、不丢输入；Vr草稿与N布局分开。 |
| [E10 事前价格][E10] | `PlanDraft/PlanVersion.entry,initialStop,target,direction,validationReasons` | S10价格/方向/targets；U草稿校验与保存接线。 | long stop<entry<target，short反向；可空继续看图，非法不保存为有效；Vr/Vrule。 |
| [E11 规模][E11] | `PlanVersion.sizeInputMode,rawValue,resolvedQuantity,quantityStep,rounding,derivedUnroundedQuantity` | S10有size/resolved/step/rounding等列；U完整换算/元数据及UI接线。 | qty×entry×multiplier（stock/ETF=1）；按交易单位；缺资本/币种/价格输出原因，不猜杠杆；Vr/Vi/Vrule。 |
| [E12 资金基数][E12] | `CapitalReference(amount,currency,asOf,source,evidenceRef)` 引用PlanVersion | S10 capital_amount/currency/as_of/source/snapshot_ref；S08设置；U可信净值资格和实际来源链。 | 手填参考资金≠净值；null保留；不得未来账户快照填事前；Vr/Vrule/knowledgeCutoff。 |
| [E13 计划派生][E13] | `PlanMetrics(planVersionRef,riskBaselineRef).notional,positionRatio,risk,riskRatio,expectedR,reasons` + M | S10风险分母/方法版本；U所有派生值存储与接线；不是现有独立列声明。 | 先方向/正风险校验；风险=abs(entry−stop)×qty×multiplier，不能abs救非法；同币种分母；冻结R0，不同币种不可除；Vr/Vrule。 |
| [E14 持仓侧栏][E14] | `ReplayPosition(roundRef,executionCutoff,marketCutoff).inventory,avgCost,realized,unrealized,visiblePrice/time` + 原PlanRef | S02/S07/S10输入；U cutoff账本持久结果与当前侧栏接线。 | 只可知执行/行情，原计划readonly；多次入场风险独立，无预定全回合budget不冒算唯一R；Vt/Vm/Vf/Vr/Vrule。 |
| [E15 事后摘要][E15] | `CapturedMetrics(bundleRef).actualEntry,exitWeightedPrice,gross,fees,net,actualR,completeness` + formal/capturedPlanRef | S12实际指标/来源/refs、S10baseline、S02事实；U metric_key具体清单/当前显示链。 | 显式看结果才放出；未闭合只partial，fee缺失gross可知/net待补；加权退出、移动均价/费分配按批准公式，Vr/Vt/Vf/Vrule。 |
| [E16 退出决策][E16] | `Decision(decisionId).executionRefs,action,date,precision,quantity,price` + `EvaluationSelection` | S11 captured_decision_id、executions、selections；S02事实；U通用Decision持久shape/时间精度。 | 每退出独立评价，不按原因列表代替；同日date-only不造时刻；Vt/Vr/Vrule/executionCutoff。 |
| [E17 提前退出][E17] | `ExitEvaluation(evaluationId,revision).earlyExit=yes/no/uncertain/null` | S11 early_exit明确枚举可空；U控件运行/计划比较接线。 | 不到target不自动yes，OHLC同bar先后未知；提前≠错误；Vr/Vrule/comparedPlanRef。 |
| [E18 原因/符合度][E18] | `ExitEvaluation.reason,detail,adherence,comparedPlan/target,recordedAt,phase,source,evidenceRefs,dictionaryVersion` | S11直接列及tags/evidence/associations；U原子文档接线。 | 人工评价，未知不等于否；无原计划单独枚举；长叙事Text；Vr/manual字典版本，不自动推断因果。 |
| [E19 底栏回放][E19] | `ReplayState.marketCutoff,executionCutoff,decisionCursor,playing,period,viewport,hasSeenFuture` → bars/markers/Text owner | S10/S12留存双cursor；U当前播放状态shape、稳定事件顺序与真实图可见结果。 | 默认1已完成bar/秒；bar不改Text归属，nextDecision改；period/pan不推进执行；编辑暂停、空档不填；Vt/Vm/Vr/Vrule/N。 |
| [E20 保存][E20] | `ReviewSaveRequest(requestId,expectedRevision,roundRef,document)` → `ReviewSaveReceipt.revision,status,conflict` | S09 revision/draft/finalized，S10–S12多表；U请求幂等字段及所有子对象原子保存接线（不得套用成交S06当复盘回执）。 | 服务端权威，409不覆盖，失败留draft；重导/重组保留原关联并需确认；Vr/Vt/Vrule，reload再核实。 |
| [E21 导出][E21] | `ExportBundle(exportId).snapshotRefs,documentRevision,executionVersion,metricVersion,images,textRefs,editableTables` | S12 snapshot/bundle/metrics refs；U导出流水、图像与可编辑表的实际存储/产物。 | 新版提案为三图一表的主叙事加全事件附录；导出格式及冻结内容按新稿复核。只用已留存内容，不混未存草稿；缺项不回造；Text 按 ID+版本去重。 |
| [E22 决策/快照][E22] | `Snapshot(snapshotId,ordinal).decisionRef,phase,context,view,documentRevision,drawing/TextRefs,image,completeness` + `CompletionEvidence` | S12留存/capture/decisions JSON，S10/S11关联；U独立decision/snapshot完整shape、图像、完成谓词。 | 新版提案中节点不自动生成快照；每个真实决策至少一份快照且回合闭合才完成；三图非完整证据；不得漏未来决策日期；重分组标需确认保留旧成果；Vt/Vr/Vrule。 |

### 新版复盘提案新增对象：待进一步逐项审阅

以下 N01–N04 是新版提案新增标识，并非已批准设计，也不代表新版控件清点已完成。

| 新增项 | 需要核对的数据与状态 |
| --- | --- |
| N01 交易列表 | 回合与独立交易身份、选中对象、待复盘状态和跳转上下文。 |
| N02 节点调度 | 当前节点、行情与成交截止、暂停原因、可见对象及已处理事件。 |
| N03 过程指标 | 指标值、适用时点、来源、规则版本、风险基数和缺失原因。 |
| N04 四维评价 | 各维评分及状态、系统建议依据、人工修改原因和规则版本。 |

## 6. 导入：I01–I17

批准的是各来源功能/限定；统一导入视觉、历史列表及材料新版本审核控件存在设计缺口。下面 I13/I15/I16 的组件观察不追认为已批准设计。导入逻辑对象必须分开：`Material`、`MaterialVersion`、`ImportBatch`、`SourceObservation`、`RawRow`、`SourcePair`、`SourceReportMetric`、`Execution`、`Practice`、`MatchAllocation/Round`、`ServerPlan`、`Choice`、`CommitReceipt`、`CompletionEvidence`；它们不是一条“import”记录的别名。

`RawRow` 指材料的原始输入片段或浏览器草稿；`SourceObservation` 指从某个材料版本识别的一项来源信息，保留原始位置引用。一行可产生多项观察，一项观察可引用多个位置；原始行是否独立持久化按来源规范决定，不改变截图原图、裁剪和未确认草稿仅留浏览器的约束。

| ID／需求及证据 | 候选对象、键与关键字段 → 读/写结果 | 当前现状（S/B/U） | 计算、确认边界与版本依赖 |
| --- | --- | --- | --- |
| [I01 入口/管理][I01] | `ImportSession(sessionId).sourceKind,files,status` → 来源入口/抽屉 | B现组件菜单/抽屉静态观察；S03/S04持久容器；U统一批准布局与session持久化。 | 确认前浏览器解析，不写成交；文件内容识别，不只后缀；N，不应为每次开菜单创建持久批次。 |
| [I02 券商解析][I02] | `RawRow(rowId,materialVersionRef,locator).rawValues,sourceOrder,fingerprint` → `NormalizedCandidate.instrument/account/time/precision/decimalFields,diagnostics,excludedReason` | S02/S03/S04外层列；U逐来源raw/normalized JSON字段与解析结果完整性。 | xls/xlsx/pdf内容识别；date-only不补秒；同源真实重数保留，仅精确主明细对合；parserVersion/源版本/Vrule，确认前draft。 |
| [I03 元数据补全][I03] | `MetadataResolution(candidateId).instrumentRef,name,type,status,source,reasons` → 可纳入/待确认/排除 | S01 metadata_json等；B现确认组件有补全/retry；U类型字段合同/可靠来源资格。 | proven stock/ETF按来源限定纳入；缺名不写代码冒名；失败重试不改已确认原成交；Vi/parserVersion/N。 |
| [I04 TV上下文][I04] | `SourceContext.materialVersionRef,instrumentCandidate,confirmedInstrumentRef,timePrecision,timezone,nature` | S01/S02/S03/S04；B现TV context组件；U精度/zone字段的持久shape。 | CSV无证券账户列，filename只候选，filename日期非成交日；冲突须处理；sourceVersion/parserVersion/Vi/N。 |
| [I05 TV行/配对/报告][I05] | `SourcePair(pairRef).tradeNo,entryRowRef,exitRowRef,quantity,roles`；`SourceReportMetric(pairRef,key).raw/value/unit,sourceVersion,visibleAfterExit` → candidates/counts | S04 raw/content容器、S02成交；U pair/report metric物理字段、match/round映射。 | rawRows/sourcePairs/executions/rounds各计；方向转换及组完整校验；同pair费只一次、现来源规则归退出；Pnl/MFE/MAE/cum/duration不当逐成交可加量，完整退出后才可见；parserVersion/Vrule。 |
| [I06 月结单审阅][I06] | `StatementReview(versionRef).month,template,timePolicy,zone,parseRevision,warnings/acks` + execution/inventory/aux rows | S04 content/diagnostics/locator；B现组件审阅/zone重解析；U库存/aux/timepolicy内部持久shape。 | zone变更必须重解析，结构/cash错误与未ack warning阻断；walltime/语义/zone/UTC/置信度分开；parserVersion/zonePolicy/N。 |
| [I07 17列/现金库存][I07] | `ReconciliationRow(rowRef).raw/normalized,gross,fees,netCash,balance,currency,status,reason`；`InventoryEvidence(snapshotRef).kind,date,qty,sourceCost`；`AuxEvidence` | S02部分成交列、S04 JSON容器；U cash/fee分项/库存/aux逐字段及其计数守恒。 | subtotal/detail费一次且分摊守恒；settlementDay不当executionDay，市值不当成本，snapshot/公司行动不造买卖；核心未表示阻断，来源限定排除；parserVersion/Vrule。 |
| [I08 截图队列][I08] | `ScreenshotDraft(imageId).order,status,progress,rowCount,issues,memoryRefs` + session counts | 批准要求原图/裁剪仅浏览器memory；U当前worker/内存行为本轮未直接核验；不能标S。 | ≤20张、25MiB/60Mp每图；取消释放，刷新丢未确认draft要告知；不持久原图/OCR全量；N/parserVersion。 |
| [I09 截图总表][I09] | `OcrDraftRow(rowId).fieldRaw/confidence/bounds/imageRef,normalized,status,confirmedFields` + local query/order | U逐字段当前实现/持久shape；S02仅确认后承接规范成交。 | all/pending/conflict/autodup、时间排序；<.85/修复/缺失/非法/元数据不确定人工；编辑核心后重做补全/重复；不能editable即事实；N/Vrule。 |
| [I10 证据/时区/账号][I10] | `FieldEvidence(rowId,field).crop/raw/confidence,confirmedBy` + `TimeResolution.walltime,zone,utc,precision,ambiguity` + accountChoice | S02.account/executed_at，S04原账户/locator/raw，S05映射；Ufield证据/timeprecision shape及截图接线。 | 日期秒缺失不猜，DST歧义待确认；显式确认账号/zone；截图旧不含account候选键不能推广到后续普通实盘；N/parserVersion/Vrule。 |
| [I11 重复/冲突][I11] | `Conflict(candidateRef,existingExecutionRefs).factDiff,scope,allowedChoices`；`Choice.choice,reason,targetRefs` | S02/S04事实谱系、S06审核容器；U各来源候选键/多重集合及choices JSON逐字段。 | 保留已有/候选/确实两笔；普通实盘跨account不匹配，源实例次数保留；替换只列明ID，未决禁存；Vt/sourceVersion/policyVersion。 |
| [I12 通用确认][I12] | `ImportPreview(sessionId).source/account/currency/timePrecision,range,rawRow/pair/execution/instrument/duplicate/excluded/unresolvedCounts,changes` | B现确认组件；S03/S04/S06容器；U preview各count与存储字段一一对应。 | preview是候选非commit；月结单0成交可有库存/aux写；确认前不写，取消不写；sourceVersion/parserVersion/Vt/policyVersion。 |
| [I13 材料/服务器计划][I13] | `ServerPlan(planId).material/version,inputDigest,bookVersion,identityScope,allowedChoices,expires,status,before/after` + `Choice(reason)` | S04材料版本/观察/撤回，S06列；B现plan组件；U这些语义在body_json的精确字段及统一批准视觉。 | material≠batch≠account；ready+必填choice/reason全才提交；identity待审重prepare；缺失保留/撤回、withdrawn保留/恢复分开；完整材料对比不凭旧fingerprint；Vt/sourceVersion/policy。 |
| [I14 保存/完成/失败][I14] | `CommitRequest(requestId,planId,choicesDigest)` → `CommitReceipt(receiptId).actualAdded/revised/evidenceOnly/duplicate/excluded/unresolvedCounts,bookVersion,completionEvidence` | S06持久请求/回执，S02/S03/S04事实；现有状态机已观察[见调查][CWRITE]；U回执各计数字段与completion精确shape。 | 同request查结果未知；回执后atLeast Vt读，读失败不否定已存；最终事务失败回滚，metadata/行情失败不回滚已存成交；preview≠actual。 |
| [I15 历史列表][I15] | `ImportHistoryItem(batchId).maskedName,source,nature,importedAt,dateCoverage,trade/instrumentCounts,actualDuplicate/excluded,status` + query/sort | S03直接列、S04legacy关联；B现历史组件本地搜索/sort；U counts/coverage/actual来源的JSON合同与统一批准视觉。 | 一条batch非round；名称/source/nature搜，importedAt/tradeCount排序；dateCoverage来自成交非filename；未读actual不假0；Vt/Vi/policy/Q。 |
| [I16 历史详情][I16] | `ImportHistoryDetail(batchId,bookVersion).sourceEvidence,exclusions,conflicts,previewCounts,actualReceipt,status` | S03/S04/S06外层字段；B现组件按batch懒取/失败重试；U完整commit结果字段映射。 | batch/count精确校验、过期Vt刷新；取消旧请求防串批；loading/failure不是0重复；不是重新导入；Vt/Q/N。 |
| [I17 入库→库→复盘][I17] | `Lineage(materialVersion→observation→execution→practice/match/round→review)` + `NavigationTarget/Context` | S04至execution已定义，S02 run/S09 episode存在；U practice/round/episode稳定映射及真实旅程。 | 保存回执后reload再入正确实体；date-only/源报告可见性与缺行情明确；不把callback或mock证明当旅程；Vt/Vi/Vm/Vr/Vrule/P/N。 |

## 7. 本表留下的决策与可验证边界

1. **身份未决。** 全局账户主表/来源映射、practice与simulationRun、实盘主动平仓回合、模拟内部配对与既有 episode 的关系没有被现有列自动解决。需要分别定义身份、生命周期、重导/重组后的关联策略；保留原来源与复盘成果，不能按名称、文件或证券+日期合并。
2. **财务设计与验证。** H08/H10/H20/H21/T13/T15 各自的 dateBasis、粒度与已批准公式已分列；不同计算时点统一采用最新汇率。最新汇率的取得与更新、成本与费用分配、日曲线累计基准、空头市值、实盘收益率分母、桶端点/金额阈值、部分缺失资格仍需结合已有依据设计和验证；模拟练习收益率已确定按练习初始资金大于零判断。不能提前固化一个通用 `pnl` 或 `returnRate` 取代这些问题。
3. **覆盖未决。** 当前 financial acquisition 的历史FX/lifetime资格有空输入，历史页 not-wired；枚举全部存储成交不等于期初/生命周期完整。[证据][CCALC] 因此“当前能算/历史已接线/已有持久读模型”均不能由本表推出。
4. **保存与就绪不同。** 成交审核请求/回执已有独立持久容器；复盘revision已有字段；候选 publication/task/依赖向量仍是设计。不能把成交S06回执直接声称为复盘E20回执，也不能把回执当作异步读结果已完整。
5. **来源粒度与计数。** rawRows、sourcePairs、normalizedExecutions、matchRounds、practices、previewCandidates、actualAdded/revised/evidenceOnly/duplicate/excluded/unresolved须分别定义；S03.record_count或JSON存在不证明任一计数已可靠。源报告指标保留来源/单位，不混作可加账本。
6. **证据状态。** 90项均有需求来源及候选对象，但大量当前接线/JSON内部/持久投影明确为U；这满足“可反查映射”的文档范围，不声称Q01或全部P1已由独立审查关闭。UI、数据库数据、性能、并发发布、导出渲染、触控均未在本次验证。最终规则、迁移与运行验收需另行审查。

[MAIN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/docs/backend-design/view-driven-data-model.candidate.md:3
[Q01]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/independent-review.md:15
[HT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:33
[EI]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:21
[CURRENT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:21
[CVERSION]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:42
[CWRITE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:55
[CCALC]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:65
[CSETTINGS]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/current-model-evidence.md:35
[SC-INSTRUMENT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:26
[SC-EXEC]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:49
[SC-BATCH]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:37
[SC-NATURE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:183
[SC-FACT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:618
[SC-SOURCE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:566
[SC-ACCOUNT]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:609
[SC-PLAN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:796
[SC-MARKET]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:80
[SC-PROVIDER]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:164
[SC-SETTINGS]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:157
[SC-LEGACY]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:67
[SC-DOC]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:194
[SC-RECALL-PLAN]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:204
[SC-RECALL-SIZING]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:261
[SC-EVAL]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:277
[SC-BUNDLE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:228
[SC-CAPTURE]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:247
[SC-ACTUAL]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/db/sqlite-schema.ts:328
[H01]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:39
[H02]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:40
[H03]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:41
[H04]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:42
[H05]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:43
[H06]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:44
[H07]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:45
[H08]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:46
[H09]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:47
[H10]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:48
[H11]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:49
[H12]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:50
[H13]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:51
[H14]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:52
[H15]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:53
[H16]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:54
[H17]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:55
[H18]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:56
[H19]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:57
[H20]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:58
[H21]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:59
[H22]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:60
[H23]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:61
[H24]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:62
[H25]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:63
[H26]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:64
[H27]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:65
[H28]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:66
[H29]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:67
[H30]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:68
[H31]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:69
[H32]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:70
[T01]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:76
[T02]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:77
[T03]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:78
[T04]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:79
[T05]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:80
[T06]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:81
[T07]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:82
[T08]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:83
[T09]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:84
[T10]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:85
[T11]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:86
[T12]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:87
[T13]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:88
[T14]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:89
[T15]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:90
[T16]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:91
[T17]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:92
[T18]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:93
[T19]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/home-trades-evidence.md:94
[E01]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:27
[E02]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:28
[E03]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:29
[E04]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:30
[E05]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:31
[E06]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:32
[E07]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:33
[E08]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:34
[E09]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:35
[E10]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:36
[E11]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:37
[E12]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:38
[E13]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:39
[E14]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:40
[E15]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:41
[E16]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:42
[E17]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:43
[E18]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:44
[E19]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:45
[E20]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:46
[E21]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:47
[E22]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:48
[I01]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:91
[I02]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:92
[I03]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:93
[I04]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:94
[I05]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:95
[I06]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:96
[I07]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:97
[I08]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:98
[I09]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:99
[I10]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:100
[I11]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:101
[I12]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:102
[I13]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:103
[I14]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:104
[I15]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:105
[I16]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:106
[I17]: /Users/zhoulin/.codex/worktrees/home-read-mvp/TradeReview/.scratch/view-model-design-2026-10-31/replay-import-evidence.md:107
