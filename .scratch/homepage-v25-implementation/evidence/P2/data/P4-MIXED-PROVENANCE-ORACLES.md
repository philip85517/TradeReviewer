# P4 混合 IPO / manual 来源：待裁定的字面 oracle

2026-10-23，Asia/Shanghai。**只读算例；pro-rata 及下列类别成本/费用重分配仍待 root 裁定，未实施 P4。** P2 主合同 `PRE-DISPATCH-CONTRACT.md` 已冻结于 SHA256 `a882d59c3d6b2ed532250b207897bf0166e560426e58d6797e586faa28e7618a`；本附录不修改它，也不延迟 P1 门后先做 P2。未修改产品/测试/DB，未运行财务探针。

权威：`docs/design-system/baselines/2026-10-22-homepage-v2.5/source/visual-design.candidate.md` HP05“底部贡献区”要求：做多 / 做空 / 打新互斥；IPO 获配及后续售出归打新，上市后自行买入归做多；当前贡献 = 期间实现 + 期末浮盈 − 期初浮盈，全量分项须一致。正文没有定义混合来源的无链接出售匹配，也没有规定类别账面成本的重分配方式。以下为供 root 选择的明确候选，**不是把候选写成规范已有政策**。

## 1. 单一 canonical 基准与边界

同一 account/instrument/nature/run，原币 USD，来源完整、方向明确。IPO 获配 `1@100`，自主买入 `1@200`，随后 `sell1@180`，再 `sell1@190`。主例没有费用（每项 fee=0）；IPO100是 canonical 可证实的 acquisition cost。只有这一组 canonical 平均成本账本，不能分别重放 IPO/manual。

- `t0`：两次取得后、第一次卖出前，所选期间的 opening boundary，mark=160。
- `t1`：卖1@180 后，endpoint mark=180。
- `t2`：再卖1@190 后，完全平仓。quantity=0，UF=0，无需行情。
- `grossR` / `realizedFee` 是从 t0 到 endpoint 累计；t0 未有实现。`cost` 是 endpoint **剩余账面成本总额**，不是单位成本或原始取得成本。
- `openUF/closeUF` 均费用净后的 UF；`net = grossR − realizedFee + closeUF − openUF`。表中每一列都须逐类求和核对，不能只核对最终 net。

|canonical 边界|quantity|剩余 cost|累计 grossR|realizedFee|retained openFee|opening UF|closing UF|期间 net|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|t0|2|300|0|0|0|20|20|0|
|t1|1|150|30|0|0|20|30|40|
|t2|0|0|70|0|0|20|0|50|

第一卖出消耗的是 canonical 平均成本150，毛实现30；第二卖出消耗剩余150，毛实现40。全生命周期净额70与所选期间净额50不同，后者扣除了 t0 已有浮盈20。

## 2. 候选共同语义：来源决定数量，金额沿同一平均成本池

候选采用“**来源数量份额 × canonical 当前平均成本/剩余费用池**”作类别账面归属。两次取得后，原始取得成本仍在审计来源上保留 IPO100/manual200；类别账面成本在同池混合时成为 IPO150/manual150，审计重分配为 IPO **+50**、manual **−50**，合计0。这是类别贡献归因，不改变 canonical cost300 或任何成交。

该重分配有真实的解释代价：类别表示“混合平均成本池中这类来源持有/处置份额的贡献”，不是该 acquisition lot 的独立经济利润或税务成本。若期间跨过混合取得，类别 UF 可以出现一减一增的归因转移，须保留 transfer 证据且合计0；不能伪称买入创造/消灭了总利润。不能把 IPO100 直接当第一卖出的 canonical 成本，计算 IPO 毛实现80；它与 canonical 当次30差50。

只读 observer 必须提供同一次 canonical transition 的 before/after quantity、cost、grossR、fees，F 提供同一次 fee pool before/after；归因层只分配这些既有金额、记录来源数量与 transfer。即使算例在纸面成立，也不授权另建类别成本状态机，更不授权按类别重新调用账本。

## 3. trusted disposal link：第一卖出明确链接 IPO 来源

可信链接必须是实际处置来源证据，且在该 cursor 已知，覆盖恰好1股；同证券、先后顺序或最终归零不构成链接。第一卖出消耗 IPO 数量1，第二卖出消耗剩余 manual1。链接决定数量归属，仍按 canonical 当次成本150 / grossR30投影，不能因链接切回 lot 成本100。

|endpoint / 类别|quantity|剩余 cost|累计 grossR|realizedFee|openFee|opening UF|closing UF|期间 net|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|t1 IPO|0|0|30|0|0|10|0|20|
|t1 做多 manual|1|150|0|0|0|10|30|20|
|t1 合计 = canonical|1|150|30|0|0|20|30|40|
|t2 IPO|0|0|30|0|0|10|0|20|
|t2 做多 manual|0|0|40|0|0|10|0|30|
|t2 合计 = canonical|0|0|70|0|0|20|0|50|

第二小段单独选期间 t1→t2 时：IPO realized0/openUF0/closeUF0/net0；manual realized40/openUF30/closeUF0/net10；合计net10，等于 canonical。若可信链接明确第一卖 manual，则两个类别在主表中交换：t1 manual grossR30/net20，IPO closingUF30/net20；t2 manual grossR30/net20，IPO grossR40/net30。只有来源对应交换，canonical 总额不变。

## 4. 无 disposal link：按在场来源数量同比例处置（未批准候选）

两类在第一次处置前各占数量1/2；第一卖出各归0.5股、各消耗 canonical 成本75、毛实现各15。余下各0.5股、成本各75；第二卖出各归0.5股、毛实现各20。这里允许归因份额小数，并不修改原始整股成交；不能四舍五入为先卖某一类。

|endpoint / 类别|quantity|剩余 cost|累计 grossR|realizedFee|openFee|opening UF|closing UF|期间 net|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|t1 IPO|0.5|75|15|0|0|10|15|20|
|t1 做多 manual|0.5|75|15|0|0|10|15|20|
|t1 合计 = canonical|1|150|30|0|0|20|30|40|
|t2 IPO|0|0|35|0|0|10|0|25|
|t2 做多 manual|0|0|35|0|0|10|0|25|
|t2 合计 = canonical|0|0|70|0|0|20|0|50|

单独 t1→t2：每类 realized20/openUF15/closeUF0/net5，合计10。各类全生命周期grossR35是平均池归因结果，不是 IPO原始成本100的独立利润85，也不是 manual原始成本200的独立亏损15。

## 5. 非零费用附加 oracle：费用池归属与实际费用来源分开

为了排除“fee全0所以看不出重复/释放错误”，独立增加：IPO取得fee2、manual取得fee4，两次卖出fee各2；其余量/价/mark/时点不变。**canonical cost仍300，不把费用再加进成本；F pool唯一。** t0 pool6；t1释放3、留存3，另第一卖出fee2进入实现；t2再释放3及第二卖出fee2。canonicalKnownFees分别6/8/10，累计realizedFee分别0/5/10。t0净UF14、t1净UF27、t2净UF0；period realized分别0/25/60，period net分别0/38/46。

以下金额候选沿 canonical/F pool：混合后每类分配openFee3（相对取得来源fee2/4，是+1/−1的归因转移）。可信IPO先卖时，其当次 realizedFee=pool3+exit2=5；pro-rata时每类 first realizedFee=1.5+1=2.5。不得重新从原始费用另扣一遍。

|政策 / endpoint / 类别|quantity|cost|累计 grossR|realizedFee|openFee|opening UF|closing UF|期间 net|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|trusted / t1 / IPO|0|0|30|5|0|7|0|18|
|trusted / t1 / manual|1|150|0|0|3|7|27|20|
|trusted / t1 / 合计|1|150|30|5|3|14|27|38|
|trusted / t2 / IPO|0|0|30|5|0|7|0|18|
|trusted / t2 / manual|0|0|40|5|0|7|0|28|
|trusted / t2 / 合计|0|0|70|10|0|14|0|46|
|pro-rata / t1 / IPO|0.5|75|15|2.5|1.5|7|13.5|19|
|pro-rata / t1 / manual|0.5|75|15|2.5|1.5|7|13.5|19|
|pro-rata / t1 / 合计|1|150|30|5|3|14|27|38|
|pro-rata / t2 / IPO|0|0|35|5|0|7|0|23|
|pro-rata / t2 / manual|0|0|35|5|0|7|0|23|
|pro-rata / t2 / 合计|0|0|70|10|0|14|0|46|

这张表的 `realizedFee/openFee` 是**贡献金额的 pool 归因**，不是 P2 的 `actualIncurredFees`。原始取得费用事实仍IPO2/manual4，不能改写；本选中期间实际只发生两笔exit fee，至t1为2、至t2为4。trusted下期间实际fee分到IPO2/manual2；pro-rata下至t1每类1、至t2每类2。所以上表至t2 realizedFee10，不能冒充期间实际费用4，更不能覆盖取得费用原始来源。若 root 不接受费用池类别重分配，需另裁相应归因政策，不可暗用来源fee2/4释放而让remaining pool偏离F的3。

## 6. root 裁定与未来独立验收项

1. 是否批准上述“来源数量决定归属；每类成本/openFees按单一canonical池数量份额”的贡献语义，以及显式零和 transfer 审计。可信 disposal link 也只决定数量，不切换lot成本。
2. 无链接是否批准 pro-rata；未批准之前，这类类别金额 unknown+provenance-ambiguous，原instrument总财务仍可知。不自动使用FIFO或把整证券归IPO。
3. 字面验收逐项比对上表，包括每类quantity/cost/grossR/realizedFee/openFee/openingUF/closingUF/net；做空在该例每项均0。并断言 actual feeFacts 原来源和发生日期未重分配。
4. 后续真实entries测试还须覆盖缺/冲突/未来link、partial link不足、late refund知识变化、同成交split消重、跨selected起点及纯类别对照。这里没有批准或实施这些测试；P2 prepared仍先于P4。

本例明确了一种可守恒的类别语义，并不证明现有数据已具备可信link或现代码可产出这些类别值。是否采用该语义由root裁定；未裁定及未独立接受前，不宣称P4完整可计算。
