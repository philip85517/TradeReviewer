# Luna B：V2.0 最终独立数字／单位复核

日期：2026-10-26（Asia/Shanghai）
复核模型／努力级别：`gpt-5.6-luna / max`
角色：未参与实施的独立文档数字、单位、版本复核
结论：**PASS WITH COVERAGE LIMITS**

F02–F07 的初检阻断已在当前冻结包中清除。F08–F10 的独立手工 oracle 均通过，但自动测试没有覆盖全部反例，仍记为 **自动覆盖 NOT VERIFIED**。本报告可以作为 root 的包级检查输入，不代替产品、浏览器或持久化验收。

## 范围、依据和保留的初检记录

实际核对了：

- [V2.0 验收计划](../../../.scratch/trading-library-v20-spec-sync/acceptance-plan.md)；
- [confirmed-findings 裁决](../../../.scratch/trading-library-v20-spec-sync/confirmed-findings.md)，包括 C01–C10 与 B06 收窄说明；
- [交易库设计规范](../../../docs/design-system/trading-library-design-spec.md)，尤其练习／账户／编号（第 7–45 行）、三种日期（第 47–61 行）、实盘回合（第 63–79 行）、模拟统计与收益口径（第 81–109 行）；
- [独立数字 oracle](luna-b-oracle.md) 与本次可执行的 [oracle 脚本](luna-b-v20-oracle.py)；
- V2.0 README、正文 source、fixture、generator、metrics test、homepage test、41 张 SVG、`visual-spec.html`、`document-identity.json` 和 `document-manifest.json`。

相对链接已用 `Path.resolve()` 实际核对；从本报告目录回到仓库根使用 `../../../`。本次只新增本报告和独立 oracle 脚本，没有改动 V2.0 实施资产。初检报告 [luna-b-v20-acceptance.md](luna-b-v20-acceptance.md) 保持原样，原报告 SHA-256 为 `69e16b6f9c30f2fa75bac6a7bb069797beb87a2f5c73deccb54517bcbb08a520`。

## F02–F07 最终复核

|编号|当前核对证据|结论|
|---|---|---|
|F02 稳定编号|正文 `source/visual-design.candidate.md:162–168` 保留同标的同日 `#01/#02`，并将内部配对与独立练习分开；`visual-spec.html`、identity、manifest 中旧 `#01 与 #05` 出现数均为 0，当前 `#01 与 #02` 语义与 sourceLine 映射一致。|**PASS**|
|F03 source／SVG／reader 同步|当前 generator 对 `FRAMES` 的 41 个名字逐张重建，缺失 0、字节差异 0；manifest 的 44 个图片引用对应 44 个唯一图片，指纹差异 0。reader 已由当前正文重建，manifest 的文档语义 fingerprint 为 `dd25c5…aca43`。|**PASS**|
|F04 趋势统计单位|`generate-library-frames.py:623–630` 按 `simulation` 分支选择 tooltip：模拟盘按练习日期汇总练习净盈亏，实盘按回合平仓日期累计有效回合；`02-simulation-normal.svg` 使用练习口径，`03-distribution-selected.svg` 与 `04-return.svg` 使用实盘口径。|**PASS**|
|F05 费用只扣一次|正文 `source/visual-design.candidate.md:200` 明确“未扣费的已实现毛盈亏 + 未扣费的残余持仓浮动毛盈亏 − 练习费用一次”，含费来源不二次扣费。`generate-library-frames.py:299–308` 保持浮动毛额后统一减费用；A 结束价 140 的结果为 `1900 + 2800 − 23 = 4677`，reader 中旧“已收取费用”表述出现数为 0。|**PASS**|
|F06 回合／练习／内部配对单位|正文 `:155` 明确 50+30 形成两条内部配对但一次主动卖出仍是一条实盘回合；`:162–168`、`:258–261` 使用“练习详情／内部配对／配对回放”路径。已确认的实盘最近开仓优先及 50+30 例子保留；没有把该例子降为未决。|**PASS**|
|F07 日期维度|正文 `:183、:204、:212、:398–400` 使用确认的练习日期／回合平仓日，并允许从明确文件名识别练习日期；reader 中“按保存日期”“保存日期”以及旧风险指标表述出现数均为 0。|**PASS**|

reader 的关键旧词扫描结果：`#01 与 #05`、`已收取费用`、`按保存日期`、`保存日期`、`进入其回合复盘`、`第一个回合` 均为 0。`第一个内部配对`、`第二个内部配对`、`进入配对回放` 与正文 sourceLine 均存在，说明模拟层级没有被清空来规避冲突。

## F08–F10 独立 oracle 与覆盖边界

执行命令：

```text
python3 .scratch/trading-library-v20-spec-sync/reviews/luna-b-v20-oracle.py
```

实际输出末行为 `ORACLE_STATUS=PASS`。关键手工结果如下：

|Oracle|手工结果|语义结论|自动覆盖|
|---|---|---|---|
|O-01／F10：人体行为与配对份数|100+50 后卖 80：1 条人的主动平仓、2 份内部配对、余 70；再卖 70 后累计 2 条主动平仓、3 份配对、余 0。|成交／内部配对／实盘回合三个分母分开；不能把 2 份配对画成 2 回合。|**NOT VERIFIED**：metrics test `:80–100` 覆盖替代的 50+50／80+20 及同 `human_action_id` 技术拆单，没有锁定规范精确 100+50／50+30 输入。|
|O-03／F09：模拟总数、可算、未知、持平|`[60,-20,0,None,10]` → 总 5、可算 4、未知 1、胜 2、负 1、持平 1、总体胜率 50%。|未知不变持平；持平进入胜率分母；全未知时应为“—”。|**NOT VERIFIED**：默认 fixture 无持平，也没有全未知零分母断言。|
|O-04／F08：金额与收益率独立|`net=[60,40,0,None]`、收益率 `[6,None,0,None]` → 总体练习胜率 `2/3=66.67%`；金额样本 3；收益率样本 2。|收益率缺本金不改变总体胜率，不能把 2/3 改成 1/2；收益率分布只使用自己的样本数。|**NOT VERIFIED**：`generate-library-frames.py:363–371、404–411` 已分开实现，现有 test 主要锁定默认金额分母 5，没有精确断言该 2 的收益率分母。|
|O-05：剩余估值与费用|已实现毛额 1900、余仓浮动毛额 2800、费用 23，估值净额 `4677`；无结束估值时整体金额未知。|余仓不能当 0；来源已含费时不再扣费。|默认 test `:31–37` 已锁定 1900／23／2800／4677；独立 oracle 再复算通过。|
|O-06：缺本金仍可算金额|资本 `None、0、-100` 均保持净额 4677，收益率为未知。|金额、胜负和练习计数与收益率分开；正初始资本才是收益率分母。|**NOT VERIFIED**：当前自动测试没有把缺失、零、负本金三种输入逐项断言。|

本次还核对了缺输入状态：普通 fixture 为总 6、可算 5、未知 1、累计净盈亏 388、胜率 60%；missing 图为 **6／4／2**，gap 图为 **6／3／3**。缺费练习仍保留在总数中，只从金额、胜率和分布的可计算分母排除。负净额 metric card 使用负色（独立检查得到负色 2、正色 0），没有把负值按 label 误着成绿色。

F08–F10 的“NOT VERIFIED”只表示自动测试覆盖缺口，不表示手工 oracle 失败。这里不新增产品规则，也不把 `human_action_id` 样例解释为生产环境已经完成真实行为识别；跨账户／证券边界、混合方向及模拟内部算法仍按规范保留为待设计。

## 自动检查与限制

已运行并记录：

- `python3 .../source/test-library-metrics.py`：8 tests，`OK`；
- `python3 .../source/test-homepage-template.py`：5 tests，`OK`；
- `validate_fixture(fixture)`：`[]`；
- 当前 generator 重建 41/41 SVG：缺失 0、mismatch 0；
- manifest 图片指纹：44 次引用、44 个唯一图片、mismatch 0；
- reader 关键词、sourceLine 和 manifest fingerprint 核对通过。

这些是文档、fixture、生成器和静态构建物检查。本报告没有运行浏览器、产品数据库、保存／回导航或真实导入验收；这些范围由 root 的包级验收负责。

## 冻结指纹

以下是本次最终冻结工作树实际读取的 SHA-256；reader 以三个构建文件分别记录，manifest 内的语义文档 fingerprint 另列：

|资产|SHA-256|
|---|---|
|source/visual-design.candidate.md|`dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43`|
|source/generate-library-frames.py|`d3ad5ffd6a31fb7fa0f9b8bd9573e649d2998c97c9c16fdbd1a50cece8923d09`|
|source/library-design-fixture.json|`d3a9639acb518a95a94924c568d9b957831679838c8f43c8eb897e967e72951e`|
|source/test-library-metrics.py|`a5f0fb0efe290b9368d6b364e0772881774430ab9d6c7ee918a63d5f5dbe0d6c`|
|visual-spec.html（reader）|`335fe8cb787f7f13602012238bff33bb702acf7980a1a82b000de2d9ddea8e4c`|
|document-identity.json（reader）|`c9f6251e143a5c72d2a67295d9d36cff0bc32c13d804cd1aa7a554e072bf530e`|
|document-manifest.json（reader）|`9fe687bb9b23ba8b60af40635798447d65a09b43d51e48396cbcdb61e1e069da`|
|manifest `fingerprint`（正文语义）|`dd25c5dab416ff1c24b1abd02fdd8212b79ae90eb5456846a7c3e59f751aca43`|
|luna-b-v20-oracle.py（独立核验脚本）|`2ca0e6bddc942abfab4da56df84ac75480639381506e2a5ea17d1709851b71c0`|

## 最终边界

当前证据足以把初检 F02–F07 从阻断改为 PASS，并证明数字、单位、缺输入保留和 reader／SVG 同步在冻结快照内一致。F08–F10 的独立反例均可复算通过，但因自动测试尚未锁定精确反例，必须在后续验收记录中继续保留 `自动覆盖 NOT VERIFIED`。若正文、reader 或生成器再次变动，应重新运行本报告中的 oracle、41 张 SVG 重建和指纹核对，并保留本报告与初检 NOT READY 报告的历史记录。
