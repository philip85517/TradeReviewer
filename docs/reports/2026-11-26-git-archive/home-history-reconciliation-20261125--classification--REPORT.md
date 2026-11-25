> 归档说明：以下为原验收时点的文本记录，不是本次重新验收。截图、数据库、日志及私有原件仅本地核查，不随 Git 分发；文中其文件名不是随附证据链接。

# 历史分类覆盖诊断（只读）

冻结版本 7b80c8ed-9e82-4b27-a394-c5531f6b5c5b；2015–2026；业务日2026-11-22。读取隔离SQLite（mode=ro）及全部分页HTTP存档，未改业务数据、未build。

## 发现

汇总分类缺口161707.83（HK165800.20，US−4092.38）。逐行未进入任何分类的已知金额合计HK165800.17，US−4092.45；汇总与行级0.03/0.07差由协调者独立处理舍入，不能将其解释为分类来源错误。机器文件details.json列出所有未分类行、金额、allocation、coverage及关闭round类别。

|账户/标的|未分金额CNY|原始证据与判定|
|---|---:|---|
|tiger:5793572 / US:DIDIY|76808.01|26成交，25条无positionEffect，仅1条close-long；statementPositions有2000/10300/8200/6000/12400，有时间含糊与负库存覆盖问题。7关闭round为long不能证明整个金额对象纯long；保留未知。|
|tiger:5793572 / HK:100|51816.68|5成交，3条close-long、2买入无effect，事件含IPO，持仓快照60。确有已平仓long证据，但IPO+库存不能证明纯IPO，也不能分割全部成本；保留未知。|
|tiger:5793572 / US:BE|−50194.04|4 open-short、3 close-short、2 close-long、3无effect买入。确有可靠多空成交证据，但整个对象混方向；5关闭round也含long/short。必须证明清仓边界及金额守恒后才能拆分；当前保留未知。|
|tiger:5793572 / HK:2259|19683.45|special-source guard拒绝，已有long关闭round1个。该round标签不证明IPO/普通买入的成本归属；不得强分。|
|futu:1001100200280855 / US:HUYA|−15991.72|6 open-short、6 close-short、4无effect成交；8关闭round含long/short，且覆盖有未证明成交时间及负库存。部分可靠方向不等于全历史对象可拆分；保留未知。|
|tiger:5793572 / HK:1879|15593.36|special-source guard拒绝，2 long关闭round；同样不足以证明纯来源或可安全成本分配。|

## 代码链路与可修复边界

contribution-direction.ts:40–63 对全账户标的周期分类：IPO遇库存/混买入拒绝；特殊事件拒绝；多空并存拒绝；普通long依赖完整inspection或每笔明确effect。full-projection.ts:62使用全周期inspection结果而不是单个已平仓round，102调用安全拆分，105保留失败原因。

contribution-allocation.ts:21拒绝非零持仓快照、非IPO/fee事件、historyIncomplete；29拒绝相反方向同时间戳；31要求平仓边界后新周期有明确open-short/open-long或验证IPO证据。即使多个close round可标方向，也不能跳过这些约束。57–76按生产成本内核重建并逐货币、逐边界校验金额守恒。

full-projection.ts:87的ledgerCloseKnown允许无effect卖出进入关闭记录；92、95含long fallback，因此closeRounds.category不是独立权威分类事实。可靠的关闭positionEffect在BE/HUYA等案例确实存在，但无法直接把全对象净额按关闭标签分摊。当前证据支持保留未知，不支持force classify。单独增加已平仓来源分配须另行设计成本与边界规则并验证原净额守恒；本轮未实施。

未知金额US:LI应与“已知金额但未知分类”分开记录，不以0替代。

## 协调者追问：可修软件保守缺口（与上文“不应强分”区分）

DIDIY数量链是明确值得进一步证明的候选，而不是只能永久未知：2022-08至10买入合计12400，12月卖4133+4133+4134=12400；2023-02买1500卖1500；5月买2000、6月2卖2000；6月16两笔2000、6月22买2000，7月卖6000；10月买3000、卖3000。末笔sell明确close-long，其余买卖方向缺effect但完整数量链不穿负数。原件2022-12.pdf行682/735/157；2023-10.pdf行510/558（execution IDs见下述source事实JSON）。这提示现行ordinaryLongProven受整scope月度快照/时间覆盖问题连带挡住，partition又被非零快照立即拒绝：财务kernel能按买卖库存算成本，但分类证明层未复用其完整数量链。可修候选：在实际同源库存链证实无IPO/转入/空头且成本分配守恒后，允许普通long，不以存在月度正持仓快照本身否决。此次未运行独立原始月度对账，不宣称已证明全部缺口可归long。

BE是更直接的软件拆分候选：2026-05.pdf行454卖20 open-short→502买20 close-short；546买20（effect缺失）→594卖20 close-long；646/699分别卖50 open-short→747买100 close-short；157买40+199买15→247卖55 close-long；300卖30 open-short→348买30 close-short。每段回零，多空明确，普通买入缺open-long却被partitionContribution.ts:31的开段门槛挡住。应区分“源事实缺显式open-long”与“交易方向完全不可证明”；可用下一close-long与逐笔库存链证明普通多头段，但必须复用财务成本并验守恒。当前不能直接拿closeRounds标签分配净额，因其中可能是fallback；应以这些原件effect+数量链重建验证。
