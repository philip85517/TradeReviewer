# Luna B：V2.0 最终数字／单位独立验收

日期：2026-10-26（Asia/Shanghai）
复核模型／努力级别：gpt-5.6-luna / max
角色：未参与实施的独立文档数字、单位、版本复核
结论：NOT READY

本报告只核对文档正文、fixture、生成器、静态 SVG、reader 构建物和已批准的数字／单位口径；没有修改 V2.0 实施资产，也没有把静态图稿当作产品功能验收。报告唯一新增文件是本文件。

## 范围、权威依据和链接核对

实际核对了：

- [V2.0 独立复核计划](../../../.scratch/trading-library-v20-spec-sync/acceptance-plan.md) 第 14–21 行；
- [V2.0 扫描裁决](../../../.scratch/trading-library-v20-spec-sync/confirmed-findings.md) 第 7–26 行，特别是 C01–C05 以及 B06 的收窄说明；
- [交易库设计规范](../../../docs/design-system/trading-library-design-spec.md) 第 7–45 行（练习边界、账户、稳定编号、去重和人工成果）、第 47–61 行（三种日期）、第 63–79 行（实盘主动平仓回合和 50+30 例子）、第 81–109 行（模拟统计、费用、余仓、胜率和收益率）；
- [Luna B 数字验收 Oracle](luna-b-oracle.md) O-01–O-06；
- V2.0 的 README、正文源 source/visual-design.candidate.md、source/library-design-fixture.json、source/generate-library-frames.py、source/test-library-metrics.py、全部 41 张 SVG、visual-spec.html、document-identity.json 和 document-manifest.json。

我用 Path.resolve() 验证了报告中的相对链接：

|相对链接|resolve 后存在|
|---|---|
|../../../docs/design-system/trading-library-design-spec.md|是|
|../../../.scratch/trading-library-v20-spec-sync/acceptance-plan.md|是|
|../../../.scratch/trading-library-v20-spec-sync/confirmed-findings.md|是|
|luna-b-oracle.md|是|

## 初检与当前复核

初检快照发现三类问题：

1. summarize_exercise 的旧分支会把残余开仓费用先扣到浮动部分，再从整体净额扣全部原始费用；A 在明确结束价 140 时会得到 4670，而 Oracle 要求 4677。
2. fixture／正文已转向同标的同日的本地 #01/#02，而当时的 reader 和三张模拟分镜仍含旧的全局 #05/#03/#04/#06。
3. reader 在正文后续修改前生成，保留了旧的 #05 身份描述和“已收取费用的残余浮动部分”公式；生成器和正文随后又发生了修改。

当前复核结果如下：

- 费用重复扣除的生成器逻辑已经修复：source/generate-library-frames.py:303–308 保留未扣费残余浮动毛额，整体只在 :308 减原始费用一次；A 的 140 估值结果为 4677，测试 source/test-library-metrics.py:35–37 也锁定了 2800／4677。
- 41 张 SVG 目前均可由当前生成器和当前 fixture 逐张重建，缺失 0、字节不一致 0；此前的三张旧编号分镜已重新生成并含 #01/#02。
- reader 尚未重建，仍在 visual-spec.html:185、document-identity.json:258、document-manifest.json:261 写着 #01 与 #05，并在 visual-spec.html:244、document-identity.json:506、document-manifest.json:509 保留旧费用表述。因此版本一致性和可读交付仍不通过。
- 正文和生成器仍有单位／日期逻辑缺陷：模拟例子写成“两回合”、模拟趋势 tooltip 使用实盘“回合”、风险指标把“保存日期”作为选择维度。它们不是 reader 生成时的偶然漂移，而是当前源描述或生成逻辑仍未合规范。

## 可复现命令和结果

在仓库根执行了：

    python3 docs/design-system/baselines/2026-10-26-trading-library-v2.0/source/test-library-metrics.py

结果：6 个测试通过，输出 OK。直接调用当前生成器的 validate_fixture(fixture) 返回空错误列表 []。

独立用当前 fixture 和生成器重算的核心结果：

|检查|独立结果|规范／Oracle 期望|状态|
|---|---|---|---|
|V2 模拟汇总|总 6、可计算 5、未知 1、净额 388、胜率 3/5=60%|同左|PASS|
|A 无结束估值|配对 2、余仓 70、已实现毛额 1900、费用 23、净额未知、收益率未知|O-05|PASS|
|A 明确结束价 140|浮动毛额 2800、整体净额 4677|1900+2800−23=4677|PASS|
|B–F|−104、354、−78、98、118|O-02|PASS|
|O-01 精确 100+50→卖 80→卖 70|第一笔 1 回合／2 份配对／余 70；第二笔后累计 2 回合／3 份配对／余 0|O-01|PASS（手工输入）|
|O-03|结果 +60、−20、0、未知、+10；总 5、可算 4、未知 1、胜 2、平 1、负 1、胜率 50%|O-03|PASS（手工输入）|
|O-04|总体练习胜率 2/3=66.67%；金额样本 3，收益率样本 2|收益率缺本金不改变总体胜率|PASS（手工输入）|
|O-06|完全平仓极值为 1,249,800 和 −980,200；收益率均未知|O-06|PASS（手工输入）|
|SVG 可重建|FRAMES 41 个，缺失 0，内容不一致 0|构建可复现|PASS（SVG 侧）|

O-04 的“收益率样本 2”只表示收益率分布自己的分母。它不能把总体练习胜率从 2/3 改成 1/2；当前手工算例保持这一点。

## 发现

### F01（已修复，初检硬缺陷）：A 的残余费用曾被重复扣除

- 初检问题：旧 summarize_exercise 分支先扣 open_fees，再从 realized_gross + floating 扣总费用；A 加结束价 140 时会少扣 7，得到 4670。
- 当前证据：source/generate-library-frames.py:303–308 明确把 floating 保持为未扣费毛额，net 在 :308 统一减 fees；source/test-library-metrics.py:31–37 检查 A 的 1900、23、2800、4677。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):89–95 和 [luna-b-oracle.md](luna-b-oracle.md):106–137 要求未扣费已实现加未扣费余仓浮动，费用只计一次。
- 当前结论：PASS。最终构建后仍需保留 4677 断言，避免后续 reader／图稿更新重新引入旧公式。

### F02（当前仍阻断）：稳定编号已经修到源和 SVG，reader 仍是旧 #05

- 当前 fixture：A 在 source/library-design-fixture.json:167–183 为 贵州茅台 · 2026-10-15 · #01，E 在 :309–347 为同标的同日 #02。
- 当前正文：source/visual-design.candidate.md:162 说明 #01 与 #02 独立保留；当前三张已重新生成的 SVG 也含 #01 与 #02。
- 当前 reader：visual-spec.html:185 仍写“#01 与 #05”；同一旧句嵌在 document-identity.json:258 和 document-manifest.json:261。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):27–35 要求同标的同日使用稳定本地 #01/#02，重复导入不新增样本。
- 根因：正文／fixture／图稿改变后没有重新执行 reader 构建。
- 修复建议：在正文和全部 SVG 确认后重建 reader、manifest 和 identity，检查三份构建物不再出现 #05，并重新记录图片指纹。不要把旧的全局序号恢复为当前规则。

### F03（部分修复，版本门槛仍失败）：SVG 已同步，reader 指纹和正文内容仍滞后

- 初检时，当前生成器与磁盘 SVG 的差异只有 hcr06-final-sim-ab.svg、journeys-view-simulation.svg、journeys-simulation-return.svg 三张；它们当时仍是旧 #05/#03/#04/#06。
- 当前复核已逐张调用 generate(name, fixture) 比对 41 个 FRAMES，结果为 41/41 一致。三张 SVG 的当前指纹分别为 2d8708bbf94155e1367775687c822bd971ccb8646790a5e15f133de2c1f09c2f、2d8708bbf94155e1367775687c822bd971ccb8646790a5e15f133de2c1f09c2f、3147b5cfd85b974cf28f0ffa7df1a466eb751130010907ea22a1a70170a795ea。
- reader 的生成时间仍早于当前正文；其旧图片指纹和旧正文片段没有随 SVG／正文同步。当前 reader 文件仍为旧指纹：visual-spec.html 20c2522c3361327f99e30a6fb41b0772fac60545309139b8e8f1c4447827b9b7、identity 0c688eecf7fced63fccbde45d8ba1d90a02049a41ef22e17749b29312145cb6、manifest 86bb9b6eb502dd7ed3c4c5d514e58990cd8a396ce64e8b77029657d86254ba49。
- 依据：验收计划要求正文、fixture、图稿和版本构建物一致；裁决表第 25–26 行要求图表可复建且 root 校验链接和身份。
- 当前结论：SVG 侧 PASS，包级别 NOT READY。重建 reader 后再核对 sourceLine、正文 hash、image fingerprint 和链接。

### F04（硬冲突）：模拟趋势 tooltip 仍使用实盘“回合”单位

- 生成器 source/generate-library-frames.py:621–625 对所有趋势卡片使用同一 tooltip：按日期累计“已平仓有效回合”的净盈亏，再补充模拟盘汇总练习。
- stats_for_exercises 在 :349–372 明确以练习为样本，stats_frame 在 :667–677 按练习日期聚合，:712–717 的标题、日期粒度和分布单位也按练习。
- 当前 source/images/02-simulation-normal.svg:1、03-distribution-selected.svg:1 和 04-return.svg:1 仍含“按日期累计已平仓有效回合”的 tooltip。模拟图中这会把练习趋势描述成回合趋势。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):81–87；正文 source/visual-design.candidate.md:183–200。
- 根因：trend_card 没有按 live／simulation 传入单位，单一默认文案覆盖两个模式。
- 修复建议：为模拟模式使用“按练习日期累计可计算练习净盈亏”之类的口径，为实盘保留回合口径；重新生成全部受影响 SVG 和 reader。

### F05（硬冲突）：reader 的净额公式仍描述“已收取费用的残余浮动”

- 当前正文 source/visual-design.candidate.md:200 已写成“未扣费的已实现毛盈亏 + 未扣费的残余持仓浮动毛盈亏 − 练习费用一次”。
- reader visual-spec.html:244、document-identity.json:506、document-manifest.json:509 仍写“未收取费用的已实现部分 + 已收取费用的残余浮动部分 − 费用一次”。“已收取”会使残余浮动和总费用的边界不明，与 4677 费用幂等算例冲突。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):89–95；Oracle O-05。
- 当前生成器的数值分支已正确，问题在 reader 构建漂移。修复建议同 F02：重建后逐字检查 reader、identity 和 manifest 使用与正文一致的“未扣费毛额”表述。

### F06（硬冲突）：模拟练习示例仍把内部配对写成“两个回合”

- source/visual-design.candidate.md:142–157 明确处于“模拟盘练习列表”章节；:155 写“卖 80……形成两回合”，而同一章 :157 又说内部配对数不等于模拟练习数。
- 同一模拟分镜说明在 :164 写“第一个回合／回合身份”，:168 写练习 B “进入其回合复盘”。这些词会把模拟内部配对和实盘人的主动平仓回合混在同一旅程中。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):7–19、63–75、81–87；Oracle O-01/O-02。用户已确认 50+30 的实盘例子，不应因此把该已确认例子降为未决；本问题只针对模拟语境的单位传播。
- 根因：模拟 LIFO 详情复用了实盘回合用语。
- 修复建议：模拟例子改为“两份内部配对／两条配对分配，所属练习仍为一份”；模拟分镜 caption 使用“内部配对详情／练习回放”，把“回合”保留给实盘旅程。随后检查所有模拟 SVG 的标题、卡片、表头和 tooltip。

### F07（硬冲突）：风险指标仍把“保存日期”作为模拟选择维度

- source/visual-design.candidate.md:204 写“每次练习使用当前模拟盘筛选与保存日期独立选取”。当前同段的权益轨迹和汇总范围因此可能按保存日筛选。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):47–61；练习日期才用于标题、筛选、排序和统计，导入时间只作来源追溯，旧 saved_date 不能直接作为业务日期。
- 正文其他位置已经大量使用“练习日期”，所以这是残留术语，不能用免责声明抵消。
- 修复建议：改为“当前模拟盘筛选与练习日期范围独立选取”或等价的已应用范围表述；重建 SVG／reader，并搜索正文、SVG、reader 是否仍把保存日期当筛选或排序字段。允许保留“不是保存日期”的排除性说明。

### F08（缺漏：手工通过，自动覆盖不足）：金额与收益率的独立分母没有测试锁定

- 当前实现 source/generate-library-frames.py:404–411 对收益率另外排除 rate is None；手工 O-04 得到总体练习胜率 2/3、金额样本 3、收益率样本 2，语义正确。
- 当前测试 source/test-library-metrics.py:82–90 只断言默认金额分布为 5 个可计算练习，没有断言“缺初始资金但金额可算”的练习仍进入总体胜率，也没有断言收益率分布独立为 2。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):97–107；Oracle O-04。
- 当前结论：实现／手工 oracle PASS，测试覆盖 NOT VERIFIED。建议增加窄范围的 O-04 断言，或在最终验收记录中保留可复算命令；不应新增产品口径。

### F09（缺漏：手工通过，flat／零分母自动覆盖不足）：持平和全未知分支未锁定

- 手工 O-03 当前计算为总 5、可算 4、未知 1、盈利 2、亏损 1、持平 1、胜率 2/4=50%；未知没有变成持平。
- 当前默认 fixture 没有零净额练习，测试 :22–37 只覆盖 A 未知与 B–F 的正负结果；没有断言全体未知时可计算数为 0 应显示“—”而不是 0%。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):97–101；Oracle O-03。
- 当前结论：函数手工语义 PASS，自动测试覆盖 NOT VERIFIED。保留为验收缺漏，不扩大为新的产品功能。

### F10（缺漏：精确 canonical 行为例子只手工验证）

- 当前精确 O-01 输入由 100、50、卖 80、卖 70 独立重算通过：第一卖出 1 回合、2 份配对、余 70；第二卖出后累计 2 回合、3 份配对、余 0。
- 测试 source/test-library-metrics.py:52–73 使用的是 50+50 开仓、80+20 平仓的替代数据，能证明“一个卖出匹配两笔开仓仍是一回合”和同 human_action_id 的技术拆单合并，但没有锁定规范中的 100+50／50+30 精确例子。
- 依据：[交易库设计规范](../../../docs/design-system/trading-library-design-spec.md):63–75；Oracle O-01；B06 收窄裁决。
- 当前结论：手工 PASS，测试覆盖 NOT VERIFIED。human_action_id 只表达已标记的设计边界；aggregate_live_actions 的生产行为识别、跨账户和跨证券边界仍然不能从此样例推定。

## 已合规的数字与边界

- source/generate-library-frames.py:288–321 将一个导入文件汇总为一个模拟练习，内部配对只留在详情结果；stats_for_exercises:349–372 的总体分母是练习。
- A 有余仓但没有结束估值时仍保留为一个完整练习，整体净额未知；没有使用 0、当前报价或全局报价替代。明确假设 140 时为 4677。
- B–F 的金额、总 388、5 个可计算样本和 60% 胜率与 Oracle 一致；费用总额只扣一次。
- 缺初始资金不阻止已知金额和胜负分类；O-06 的完全平仓极值仍可算，只有收益率未知。
- O-04 的总体练习胜率和收益率分布分母已在当前手工复算中分离；不得因为收益率样本为 2 而改写总体 2/3。
- source/library-design-fixture.json:167–183 和 :309–347 保留同标的同日 #01/#02；重复导入、更新／新建选择、人工成果保护在正文 :146 和规范第 31–45 行有描述。

## 待设计边界，不作为本轮缺陷定型

以下与确认表及规范一致，不能从当前图稿扩展成生产规则：

- aggregate_live_actions 的 human_action_id 是带标签的设计输入，不是自动识别人类动作的生产算法；真实行为识别仍待设计。
- derive_live_rounds 当前按代码组织样例结果；跨账户、跨证券、混合方向、加减仓和跨日持仓的生产边界仍待确认。
- 初始资本、练习结束估值和历史价格的生产权威来源仍待设计；当前 140 只是明确写入的验收假设。
- 多标的／多账户练习的命名、分组、内部预览列和冲突交互仍待设计。

README 的待定清单 README.md:45–49 与正文 source/visual-design.candidate.md:401–407 保留了这些边界；本轮没有把它们误判为缺陷，也没有据此放宽已确认的 50+30 例子。

## 当前指纹快照

以下 hash 是本次复核读取到的当前共享工作树快照；后续修正文案或重建 reader 后必须更新，不应把它们当作永久版本号。

|资产|SHA-256|
|---|---|
|README.md|6c5357f6b3bdeecd15bb7cae10967bc9955eaf84c793dbf8a93f3abbfa948f0d|
|visual-spec.html|20c2522c3361327f99e30a6fb41b0772fac60545309139b8e8f1c4447827b9b7|
|document-identity.json|0c688eecf7fced63fcccbde45d8ba1d90a02049a41ef22e17749b29312145cb6|
|document-manifest.json|86bb9b6eb502dd7ed3c4c5d514e58990cd8a396ce64e8b77029657d86254ba49|
|source/visual-design.candidate.md|8c36727be1e2703930c4c74b5e485bf0a30dea42a1abf73bbc77926e921e8022|
|source/generate-library-frames.py|f6d153fcfaca32d3edb92368fdccc772fe57f111be34b57c822ab7368b511918|
|source/library-design-fixture.json|e8af014c5029a0ba084fffebb150cdae8f242a4d520b7d6e8ae5b57eb216a3f3|
|source/test-library-metrics.py|129fb2ea8e8a04edac9df0b12e8a6116fe4b6543187fcea58b8014d00dbac5f1|
|source/images/hcr06-final-sim-ab.svg|2d8708bbf94155e1367775687c822bd971ccb8646790a5e15f133de2c1f09c2f|
|source/images/journeys-view-simulation.svg|2d8708bbf94155e1367775687c822bd971ccb8646790a5e15f133de2c1f09c2f|
|source/images/journeys-simulation-return.svg|3147b5cfd85b974cf28f0ffa7df1a466eb751130010907ea22a1a70170a795ea|

## 验收结论和下一步门槛

当前不能签署 V2.0 文档包通过。阻断项是：

1. F02/F03：重建 reader、manifest、identity，使 #01/#02、正文 sourceLine、图片 hash 和当前 fixture 同步；
2. F04：按实盘／模拟盘分开趋势 tooltip 的统计单位；
3. F05：reader 使用未扣费残余浮动毛额的费用公式；
4. F06：消除模拟语境中的“两回合／回合复盘”并保留实盘 50+30 的已确认回合例子；
5. F07：风险指标使用练习日期范围，不把保存日期当业务筛选字段。

修复后应由实施者在同一包内重新运行生成器、数字测试和 reader 构建；再由 root 按计划运行 package checker、链接／manifest／hash 校验和浏览器阅读。F08–F10 的手工 oracle 已通过，但自动覆盖仍应明确标为 NOT VERIFIED，直到补窄测试或在最终验收证据中逐项重算。当前最终状态仍是 NOT READY。
