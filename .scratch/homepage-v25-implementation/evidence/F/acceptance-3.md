# F 第 3 轮独立验收：FAIL，任务暂停

协调者 /root；2026-10-22。第 3 轮为用户授权上限，已通知实现者停止修改；不进入第 4 轮，不把未通过的财务合同转移给页面任务继续修正。

## 版本和执行证据

源码 `app/lib/reviews/homepage-v25-performance.ts` SHA256：`81038783d8d2f8b7c5c680f6fd6179ebfceba6f960147cdda66076d474d99345`。完整文件指纹见 [final-source-sha256.json](../environment/final-source-sha256.json)。

固定 Node 26.0.0 独立运行第三轮套件，3 文件、14 测试：10 PASS、4 FAIL。见 [原始输出](coordinator-round3-cutoffs.log)、[第三轮配置](coordinator-round3.vitest.config.ts)、[真实库边界反例](coordinator-round3-boundaries.test.ts)。这些反例属于本次第三轮审查，不构成新一轮实现修订。

新增边界反例通过项目现有 `buildInstrumentTradeSummaries` → `buildTradeLibraryEntries` 构建实际输入，再调用本票 adapter，不以伪造 episodes 替代真实入口。设计依据为 HP02 的同一上海业务日期、包含首尾日期、当前市值与期间分离，以及 HP09 的未来未覆盖区和未知值规则；截止日与时区也是第二轮已反馈项目。

复现命令（项目根目录）：

```sh
/Users/zhoulin/.local/share/tradereview/runtimes/node-26.0.0-sqlite-3.53.0-darwin-x64/bin/node ./node_modules/vitest/vitest.mjs run --config .scratch/homepage-v25-implementation/evidence/F/coordinator-round3.vitest.config.ts
```

## 必需项仍未通过

|实际场景|预期|第三轮实际结果|原因与影响|
|---|---|---|---|
|成交时间为 2025-12-31T16:30Z，上海业务日为 2026-01-01；选 1 月，买入成本100，期末110|期初浮盈0、期间净额10|期初浮盈 null、净额 null|期间筛选按上海日，但 adapter 期初游标仍为 1/1 00:00Z；同一成交被 seed 后再次 replay，库存冲突。纯函数时区测试通过不能证明真实 adapter 正确。|
|asOf=1/31；1/15买入1份，2/2又买入1份；1/31价格110|当前市值110|220|`currentSnapshot` 没有截止游标，未来成交进入当前数量；价格截止不能代替库存截止。|
|asOf=1/31；已有1份；同时提供1/31价格110和2/2价格999|选择截止日前最新可用价，当前市值110|null|adapter 先取全量最新 candle，再在下层拒绝未来记录，没有回选可用历史行情。|
|asOf=1/31；自定义期间到12/31；2/2未来买入100、12/31未来价格999|拒绝未来范围，或保持截止日前结果/未知；不能发布未来盈亏|发布完整净额899|期间成交和期末估值均未按 asOf 截止；reason 标注不能使已发布数字成为合法结果。|

以上四项均直接影响金额与可用性，阻止本票接受。实现者 report.md 中“严格截止”“第三轮证据完成”是 implementation-ready 报告，不能覆盖本记录。

## 保留进展

已创建独立输入输出类型、Decimal/FIFO 投影、真实 entries 接入和按账户/证券聚合。第三轮复查的此前10个反例 PASS，包含非法 settlement 费用、无期初成本、估值数量冲突、null realized 传播、跨年100期初浮盈/150已实现/0期末浮盈得到净额50、纯函数上海日期、部分 current coverage 和多回合聚合。工作者本票10测试 PASS；最终 F/S 两文件共17测试 PASS；固定版本类型检查 PASS。这些局部结果不抵消上述真实边界失败。

## 暂停与阻塞

F 保持 `open / paused / 3/3 FAIL`，源码、工作者报告及前三轮证据全部保留，尚未接入产品。P2、P4 依赖 F，继续阻塞；P1 已因 S 第三轮失败而未派发，P3/P5 随前置任务阻塞。产品功能、真实持久化、全控件、视觉保真仍 NOT VERIFIED。未写业务库、未提交、推送、合并或发布。
