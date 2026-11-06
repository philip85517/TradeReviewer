# 市场身份修复：独立验收记录

日期：2026-10-25。协调者 root；实现者均为 gpt-6.1-sol / ultra。M01、M02 第 **1/3** 轮独立验收通过；未继续迭代或规避暂停上限。代码版本绑定：[HEAD 与七个文件 SHA](evidence/FINAL-SOURCE-VERSION.json)。保留工作区原有 182 项变更，本轮未提交或推送。

## 根因及修复范围

主库 **1,866 笔成交全部具有市场**：沪市 291、深市 131、港股 248、美股 1,196。缺失发生在月结辅助事件，不能将这类事件等同于成交。

297 条辅助事件中，109 条缺少证券身份。原始 PDF 的 3 条现金事件明确写有 `HKEX 01211`；旧现金表回退分支只识别部分 `SEHK`／`#五位代码`，遗漏 HKEX 别名和一条缺闭合尖括号的完整证券代码，身份字段在解析时就没有生成，随后存储忠实保留了该缺失。不是数据库丢列或 HTTP 丢字段。

本轮增加共享的明确身份解析函数，由导入与历史修复工具共同使用。保留合法 SEHK 旧格式，对歧义、冲突、期权等不推断；账户币种、券商来源、目录名和公司名称不作为补证券身份的依据。

原始资料复验：[2019-07 / 2020-08 PDF 的旧失败](evidence/ORIGINAL-PDF-BEFORE.json)、[修复后回放](evidence/ORIGINAL-PDF-REPLAY.json)。三条记录分别为两条费用与一条原分类 `other`，仅补 `market=HK`、`symbol=01211`，日期、金额、种类、数量、来源等保持不变。原文的“500股”没有被改造成库存数量。

## 实际持久化与更新后的漏斗

原始 PDF → 交易所识别 → 辅助事件身份 → import_batches.reconciliation_json → SQLite 生产 mapper → 首页 source JSON 与摘要校验 → 领域证据投影。

|环节|结果|证据|
|---|---|---|
|PDF 识别|3 条均识别 HK/01211，其他事件字段与旧解析一致|ORIGINAL-PDF-REPLAY.json|
|全部原始资料回放|191 PDF、1,055 页；1,401 records、146 positions、288 events；blocked=0，原有 review=10 保留|ORIGINAL-CORPUS.log|
|修复前备份及副本预检|在线备份含 WAL；完整原始/目标快照；冲突检查、可恢复审计先于事务更新|ONLINE-BACKUPS.json、LIVE-PREFLIGHT-COMPARE.json|
|主库与当前预览库|各实际应用 3 条；身份缺失 109→106；所有成交与其余表摘要保持不变，仅目标 reconciliation_json 的三对身份字段变化|BUSINESS-APPLY.log、PREVIEW-APPLY.log、ACTUAL-PERSISTED-CHAIN.json|
|重开读取及生产协议|关闭重开实际库，经过 mapper、序列化、客户端协议和摘要校验，三条身份均保留|ACTUAL-PERSISTED-CHAIN.log / .json|
|运行中的真实 HTTP|200；3 条 HK/01211 均存在，摘要校验通过；1,254.347ms|PREVIEW-HTTP.json / .log|
|领域承载|三条均挂接既有 HK/01211 记录；Q02 representability gaps 231→228|ACTUAL-PERSISTED-CHAIN.json|
|桌面首页|仍显示“读取已超时，新范围未应用。”，交易/持仓未完整展示；FAIL|下方桌面核查|

剩余 106 条没有足够明确的证券身份，包含账户现金、利息、借贷费用、换汇等，也包含只有发行人名称的事件。**没有证据不等于导入必然漏市场，也不等于可以给它们强填某一股票市场。** 后续需继续审查 Q02 如何区分账户级与证券级证据。本轮未降低完整性校验、未修改事件财务性质或制造交易。

计划、审计与完整 SQLite 备份保留在 evidence/，包含原始交易证据，不应公开或推送。工具不是自动启动迁移；必须指定现存数据库、生成计划，再显式 apply。重复应用不再更新；数据变动与过期计划拒绝。恢复材料包含原始与目标快照及完整备份，本轮未执行恢复。

## 验证与独立验收

|检查|结果|证据|
|---|---|---|
|root 解析器独立审查及测试|PASS，113/113|01-INDEPENDENT.log；与任务前 .before 对比仅引入身份帮助函数|
|root 历史工具独立审查及隔离 SQLite 测试|PASS，19/19；并发/过期计划、手工改动保护、原金额不变、事务回滚、损坏审计、短写、fsync/rename 失败、提交后中断恢复、幂等与原生 CLI|02-INDEPENDENT.log|
|原始失败→修复验证|PASS，worker RED/GREEN、root 两份实际 PDF 基线复现及修复重放|01-worker.md、02-worker.md、ORIGINAL-PDF-BEFORE/REPLAY.json|
|生产构建|PASS|BUILD.log|
|全量单测|**FAIL**：366 文件，20 失败；215 失败、4,399 通过、6 跳过|FULL-UNIT.log|
|失败来源核对|修复前解析代码注入全部 20 个失败文件，215 个同名失败全部复现；无 onlyCurrent。保留项目 FAIL 状态|REGRESSION-COMPARISON.json、BASELINE-ALL-FAILURES.log|
|全量类型检查|**FAIL**，8 个 Recall 测试既有类型错误，文件 SHA 与此前记录相同；无本轮新模块报错|TYPECHECK.log、TYPECHECK-BASELINE.json|

接受的是本轮两项市场身份任务，不是整个工作区健康或完整首页交付。已知全量失败记录在 [03-existing-regressions](issues/03-existing-regressions.md)，没有为通过验收而顺带修改不相关代码。

## 桌面核查与预览

触发：后端市场元数据影响页面读取；未修改 UI 控件、布局或交互。范围：真实服务的桌面只读 smoke，1280×720；未以窄屏替代桌面。没有浏览器写入操作。

|范围/旅程|状态|直接证据与限制|
|---|---|---|
|首页读取与超时反馈|FAIL，既有阻塞仍在|真实桌面显示超时提示及未就绪数据；HTTP 成功不等于完整首屏成功|
|首页→交易库导航|PASS|真实浏览器点击“交易库”，进入实际历史列表|
|交易库历史读取|PASS，限只读 smoke|本次构建 live/all 范围显示 226 标的、726 回合，列表包含沪/深/港/美市场；不将此计数与其他旧版本或不同过滤条件混比|
|文件导入的完整浏览器写入旅程|NOT VERIFIED|本轮以原始 PDF 回放、隔离 SQLite 写入及实际落库链路覆盖；不宣称完整 UI 导入验收|
|整体视觉与全控件清单|NOT APPLICABLE|无 UI 元素或布局修改；未声明全页交付|
|浏览器控制台检查|NOT VERIFIED|本轮不据此宣称无前端异常|
|窄屏及触摸|排除|本轮桌面核查范围|

预览：[首页](http://127.0.0.1:4392/home)、[交易库](http://127.0.0.1:4392/trades?scope=live&market=all&accounts=*&rangeMode=all)。当前服务继续运行，使用明确指定的隔离 preview.sqlite，不直连主库。需重启时运行：

```sh
sh .scratch/homepage-nature-contract/START-PREVIEW.sh
```

默认工作树调试仍按项目规范使用 `make dev`（固定 3333、从主库新建在线备份）。4392 为本次自动化验收服务，不能用于证明 ≤1 秒性能目标已完成。

财务 P1/F07 与 Bars 保持原 **3/3 FAIL 暂停**。本轮未恢复，也未修改 Q02 校验规则；剩余 Q02 228 个承载缺口与首页超时仍需独立处理。
