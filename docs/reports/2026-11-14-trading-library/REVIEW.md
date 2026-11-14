# 四类读取与后端设计评审

> 2026-11-14 正式归档：以下为原评审时点的结论；本次仅整理文档，没有重新执行产品验收。候选源码按 [来源与版本](SOURCES.md) 定位。

## 范围和评审依据

用户要求先 review 完成度，再看设计质量，最后判断迁移价值；长期性能与维护成本优先，本轮不迁移后端。当前分支 `codex/library-frontend-mock@1770178694f5815b699c23deef894888dac1abea`。25db/38a0/0dc6 存在未提交实现，HEAD 不能代表候选内容；[全文件来源快照](evidence/backend/source-freeze.json.gz)冻结工作区，专项研究另列关键文件 SHA256。

一级契约为[前端实际类型](../../../app/lib/library-preview/contracts.ts#L1)、[请求交接](REQUEST-LEDGER.md)、[当前业务规范](../../design-system/trading-library-design-spec.md)及[业务覆盖表](../../design-system/iterations/2026-11-06-current-visual-progress/BUSINESS-UPDATES.md)。本轮未重新 fetch 远端；以现有候选源码为对象，不宣称覆盖未来/新增远端提交。

评审顺序：横向确认业务规则、完整读取链、模块职责，再定位高成本节点。来源研究是静态证据；root 另独立运行真实代码的隔离探针。既有报告仅作线索，不替代本轮核查。

## 必须保留的业务规则

|规则|要求|代码完成度与界限|
|---|---|---|
|一份练习的身份|一文件一练习，单账户单标的；不是一个账户，也不是一份配对|25db source/practice/revision 模型已有支撑；不能换成38a0旧实盘回合模型|
|三类时间|练习日期、原始交易区间、导入时间分开；人工更正不改原件|25db 已有独立字段、历史和 CAS，值得保留|
|金额范围|闭合小计、整份练习净额、残余估值及费用分开；unknown 不能当0|纯投影较清楚；存储适配只覆盖部分支持报表，不等于结束估值已接入|
|统计样本|总体胜率按练习；详情按内部配对；数量单位不同|25db 纯统计可保留；全量统计响应不等于范围聚合 API 完成|
|版本一致|页、全范围汇总、详情和配对不能跨版本拼接|单事务快照已有价值；四读之间统一可过期快照尚缺|
|来源保护|原件、账户/标的、修订、历史、人工成果关联必须可核验|已有守卫与反例测试；优化不能删除校验、强行推断配对或吞掉损坏|
|跨市场|按实际币种资本；总盈亏的人民币换算与历史结束估值不同|类型覆盖不等于生产数据流完成；未知币种/FX兜底仍有开放设计|

## 四类读取：完成度先于迁移判断

|前端真实需要|25db 实际链路|38a0/旧候选能提供什么|评审结论|
|---|---|---|---|
|`readOptions(mode,from,to)`：少量市场/账户选项、默认范围及快照|旧列表从所有练习与宿主 instruments/accountOptions 派生选项，没有这个独立读取；宿主还依赖旧 bootstrap|38a0 readiness/catalog 是旧实盘发布元数据，不是新模拟练习选项|**缺独立服务**。可复用命名/身份规则；不接全量 bootstrap 充当选项 API。默认范围的日期语义和空范围选项需明确|
|`readPracticePage(query)`：6行 + 全匹配范围汇总/覆盖率|`GET /api/storage/practices?metrics=1` → `readPracticeListWithMetrics` → 全量 list → 每份原件认证/配对；浏览器再筛选、排序、slice。财务摘要另走全库 statistics|38a0 `summaryAndPage` 只支持固定旧实盘选择、100行；分页前验证全发布。0dc6 raw read 复制完整源集后内存分页|**不具备有界实现**。重写查询/范围聚合职责；保留规则，不把 old API 包一层 adapter 当迁移完成|
|`readPracticeDetail(key)`：一个对象财务/资本/来源名称/估值/配对首页|ID GET 在单事务中取当前详情，但包含整个 revision/source、base64原件、历史和旧引用；`readDetailFinancialBundle` 又取全库 statistics v2 后按ID找对象；pairing另请求|38a0 rounds 是旧实盘对象，非练习DTO；原始证据接口不能代替页面详情|**部分对象读取存在，组合接口缺失**。单ID路径值得作索引入口参考，但要拆轻详情/审计原件，消除财务全库依赖，并把派生项放同一可核对版本|
|`readPairPage(key,page)`：当前对象最多6条、稳定pairId、完整性及快照|`pairing-status?projection=tradingview-v1` 带revision/version认证后重建整份source投影，返回全部executions/allocations；无page参数，也无现成分页pairId协议|38a0 rounds/evidence 的身份、分页单位不同|**配对规则部分存在，分页服务缺失**。保留来源行/record身份与支持报表分组规则，重做读取/持久投影与翻页版本契约；不能对全量响应 slice 后称服务端分页|

源入口：[25db 列表路由](SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/route.ts:7`）、[指标服务](SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-list-metrics.ts:8`）、[旧客户端分页](SOURCES.md#25db)（冻结定位：`25db:app/components/library/library-practice-list.tsx:95`）、[详情财务](SOURCES.md#25db)（冻结定位：`25db:app/components/library/practice-detail-financial.ts:62`）、[配对路由](SOURCES.md#25db)（冻结定位：`25db:app/api/storage/practices/[practiceId]/pairing-status/route.ts:10`）、[0dc6 全量源读取](SOURCES.md#0dc6)（冻结定位：`0dc6:app/api/storage/trades/read/handler.ts:48`）、[38a0 发布验证](SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-store.ts:519`）。详细调用链及返回协议见两份 research。

“6行”只约束页面行和明细返回量。**完整范围汇总可以访问全部匹配的轻量指标，不能只加总当页6行。**问题是当前反复解码/认证所有原件、读取无关历史及明细；不能承诺任意范围汇总都只做6条数据库工作。查询索引、轻量投影、按需聚合或预聚合需在真实规模上比较。

前端 Mock 的 options→page 是两个串行端口调用，不是已选定的真实 HTTP 方案。将其复制到生产会额外增加往返和版本协商成本。选项小查询按日期缓存、页响应携带必要目录、会话快照三种方式仍是待比较选项；本轮没有批准其中之一。

## 数据模型评审

|事实/派生对象|现有设计价值|主要问题与迁移边界|
|---|---|---|
|`practices`|稳定ID、账户/标的、版本、当前revision、独立日期/编号|好事实根。不要直接承载整页财务与来源原件；当前索引不能覆盖默认全局日期排序|
|`practice_sources`|原始bytes、长度/hash，写后不可变|保留事实与保护。日常列表不应每次下载/解码所有原件；任何认证结果复用必须有正确失效和损坏策略|
|`practice_revisions` + import history|修订/来源/导入历史复合关系，deferrable FK、不可变trigger|revision_json嵌整份文本/记录/字段，和原件存在重复；连轻量list都解析大JSON。保留语义，拆查询职责；不能机械复制旧migration编号/checksum进当前基线|
|date/sequence history、command receipts|人工更正可追溯、命令幂等、目标版本CAS|保留。四读必须把更正引起的筛选/排序/缓存失效纳入，不能只改一个详情字段|
|`app_settings`资本|全局默认/练习覆写、ETag、独立删除修订防ABA|可保留实现思想；getPractice/单练习写默认CNY，未形成多币种练习数据流。统计返回资本值，但没有全局读取快照/资本版本供四读一致性使用|
|配对投影|原始record ID/行与开平映射，不冒充原委托|按组重新组CSV并解析；仅支持A股两行完整组。不是覆盖未平仓、部分配对、多市场的通用模型|
|财务投影|小计/完整练习、known/unknown、费用一次归属、算术预算|纯函数值得保留；结束bar价格、FX、权益轨迹与capital依赖要来自已认证输入，不能由展示DTO补事实|
|legacy refs /人工成果|保留旧人工内容关联，损坏不能悄悄丢弃|读详情隐式牵入旧引用验证，bound路径成本另需测。应是兼容/证据边界，不能定义新练习事实或成为全部只读的前置|
|38a0发布/队列/证据表|generation、claim、databaseId/epoch/sequence、规则版本、原子head、保留旧pub|有价值的缓存设计资产；依赖registry未覆盖25db新practice表，投影仍旧模型；不能直接串接两套schema就声称新练习已自动失效重算|

模型一级来源：[schema](SOURCES.md#25db)（冻结定位：`25db:db/sqlite-schema.ts:403`）、[PracticeStore](SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-store.ts:44`）、[资本](SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-capital-store.ts:29`）、[财务适配](SOURCES.md#25db)（冻结定位：`25db:app/lib/storage/practice-statistics-financial.ts:16`）、[配对](SOURCES.md#25db)（冻结定位：`25db:app/lib/trades/tradingview-practice-pair-projection.ts:35`）、[依赖注册](SOURCES.md#38a0)（冻结定位：`38a0:app/lib/storage/trade-library-read-schema.ts:6`）。

## 版本与一致性：不要把三种保证混为一谈

1. **事实认证**：原件、身份、修订、费用/范围是否可信。bytes hash 不能单独证明字段语义；发布完整性也不能证明来源认证正确。
2. **快照完整性**：同一次发布的页、全量计数、配对、详情是否来自同一完整集合。原子换head只解决可见切换，不自动证明集合完整。
3. **新鲜度**：当前事实/资本/行情/FX/规则变化后，此快照仍否适用。未变化的practice.version不代表资本或估值没变。旧pub是否仍保留，和是否代表当前输入也是两个问题。

25db 的 `CONTRACT_VERSION` / `statisticsVersion:2` 是协议版本，不是输入快照版本；practice/revision/version 是对象身份，不是全范围读取证明。资本ETag解决资本写入并发，不能自动充当整个页的snapshotVersion。38a0 的 readVersion、保留pub与依赖检查可作参考，但没有实现这四读的新练习合同。

若后续采用认证缓存/读投影，至少要证明：何种来源和规则已认证、事实/日期/资本/结束bar/FX变化如何失效、并发构建不得发布旧输入、旧页如何明确过期、合法原件可读取、损坏如何检测与隔离。**把校验移出每次全库热读，不等于取消这些校验。**具体表与API形态待后续方案比较。

## 完成度的实际边界

- 当前有来源保存、来源证明、日期更正、资本并发保护、部分支持报表的配对和财务规则；这些是可复用资产，不是四类生产读取已完成的证据。
- current F1只证明展示契约和Mock旅程。35k/20k等历史合成数据，以及38a0旧实盘发布都不能替代新模拟模型的真实端到端预算。
- 未对当前真实业务库打开/测量；没有25db真实数据完整冷/热/重启/写后关键路径，也没有bound legacy大规模并发证据。本轮能确认结构性浪费及指定样本超时，不能给出真实生产各阶段百分比或容量承诺。
- 整个回放写入、图表、人工成果迁移、实盘动作识别不属于四读动态验收；旧回合“清仓才闭合”的语义也不能替代当前主动平仓回合要求。迁移价值在 [VERDICTS](VERDICTS.md)单列，未审部分明确暂不迁入。
