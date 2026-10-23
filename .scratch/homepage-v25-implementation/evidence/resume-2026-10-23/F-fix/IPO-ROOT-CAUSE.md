# F IPO 费用边界根因与最小修正

2026-10-23；原F四项时间根因修复后的独立补查，范围仍为原F，未新增共享ledger或成本分摊引擎。以下均真实 summaries→library entries→F；canonical ledger直接作为同边界对照，不mock。

## 复现环境与RED

同report.md固定Node26/Vitest4.1.10。原始命令：

```sh
F_TRACE_PHASE=red /Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/resume-2026-10-23/F-fix/focused.vitest.config.ts -t 'projects attributable canonical fees'
```

26-ipo-red.log：6项3FAIL/3PASS，IPO现金/费用/成本证据完整，canonical六组均可算。27-ipo-expanded-red.log：补晚退款/跨期后9项6FAIL/3PASS。32-ipo-execution-backed-red.log：真实买入与allocation重复的1项另先RED。每个阶段原输入、summary、entry、canonical、F结果分别保存`ipo-traces-red.json`、`ipo-traces-red-expanded.json`、`ipo-traces-execution-backed-red.json`。最终`ipo-traces-green.json`含10项完整对照，日志33全96项GREEN。源版本与文件哈希见source-manifest.json；26/27在最初IPO修正前，32在同一因果中补去重知识前，未覆盖原证据。

## 已验证因果

旧F fee pool仅迭代executions，将canonical在两个execution之间/最终新增的fees整个加到未平仓池。canonical IPO allocation本身会改变quantity、产生毛实现并增加费用，可能覆盖已有short。因此发生IPO cover时，F既未释放旧short开仓费，又将IPO fee覆盖部分留在U：

|情形|旧F实现 / UF / U / net|正确值（canonical毛实现/费用+比例归属）|
|---|---|---|
|short1@120，IPO1@100费2|20 / 0 / 2 / 20|18 / 0 / 0 / 18|
|short2@120开费4，IPO1@100费2|20 / 4 / 6 / 24|16 / 8 / 2 / 24|
|short1@120开费2，IPO2@100费2|20 / 6 / 4 / 26|17 / 9 / 1 / 26|

后两项只验`net=R+UF-startUF`或只和canonical net比对都会漏掉错分；HP02与HP05按同样分项口径消费时会形成不一致。新开IPO、已知退款后再卖出恰巧经过before-execution snapshot，旧方案可通过；不是它们证明架构正确。

退款晚于allocation甚至出售时，canonical在最终已知cursor重播能完整计算allocation成本/费用。单取allocation当时cursor会丢掉本次已经知道的退款，不能把完整证据永远归类未知。

另外，canonical按selected actual execution IDs跳过execution-backed重复allocation。若F计算买入前库存时仅按prefix IDs查询而不保留本次去重知识，会短暂把重复allocation当真，误认为short已被覆盖。32实值：short开费2，真实买入费3，canonical总fee5/net15；旧fee prefix U=5/net20。最终使用本次同一selected IDs抑制fee prefix的重复allocation。

## 修正与可用性政策

1. 最终数量、平均成本、毛实现、总费用、accuracy仍全部来自同一canonical ledger。F不重算执行成本或事件收购成本。
2. fee pool现有比例规则只增加canonical已支持IPO movement checkpoint。生产resolveIpoAcquisitionCost以该boundary已知原cash/evidence解析可归属fee；事件时间/rank及每一步库存由canonical movement-prefix snapshot提供。
3. prefix的数量事件/statement positions按canonical顺序截取，现金知识保持本次cursor已知集合；不会引入cursor之后的现金。IPO作为buy增量，覆盖部分释放旧U，其本次fee仅新开剩余份额留U。ordinary execution也读取同一prefix库存。
4. selected execution-backed allocation在每个fee prefix中抑制重复，最终ledger仍使用原证据按原政策去重。原成交和现金证据未改写。
5. 对照投影累计fee与canonical fees；不一致时fee-allocation-unavailable。缺失/歧义IPO归属为ipo-fee-allocation-unavailable并保留canonical原因。该护栏不替代完整可算IPO，已知10场景均返回正确分项。可信quantity/MV仍独立，不用费用未知摧毁市值。

最终10场景独立断言实现、开期UF、期末UF、net、MV、U以及canonical quantity/grossR/grossUF/fees/net。包含晚退款前售出部分/全部、跨期short开费、raw真实IPO buy去重，非仅检查恒等式。单次边界缓存与有限耗时详见report.md，UI仍NOT VERIFIED，恢复验收仍待协调者。
