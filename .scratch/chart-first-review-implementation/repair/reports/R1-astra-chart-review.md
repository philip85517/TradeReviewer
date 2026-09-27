# R1 Chart / canonical capture 独立审查

2026-09-26；gpt-6-astra / low。结论：**scoped acceptance-failed，以下三个问题需返修**。对照repair/baseline中两文件的修复差异、R1-chart.md及当前源码；未修改产品、未跑浏览器/全量测试/数据库。32项通过是实现者定向测试结果，不能解除以下未覆盖反例。

依据：主规格105、116–120、193–196；E04/E07/E21。已读本地官方 `node_modules/lightweight-charts/dist/typings.d.ts:2744–2755`，primitive的autoscaleInfo用于将绘制在series当前价格范围外的元素纳入自动缩放。

## C1 · P1 · 未完成K成交的价格仍可落在主图之外

`replay-chart.tsx:455–520,1208–1221`。

未完成K的已知成交使用真实成交价，可能高于/低于所有已知完成K范围。但primitive没有autoscaleInfo，autoScale=true仅凭candle数据不能保证该成交价纳入轴范围。painter只调用priceToCoordinate然后画，没有可见性修正。手动价格窗分支也有明确逻辑缺陷：targetIndex<0已提前返回，因此1208行targetCandle一定存在；1215行 `targetCandle ?? markerPrice` 的marker分支不可达。买入前旧K在50–55、下一笔未完成K实际成交60时，手动窗只纳入旧K，仍看不到60的菱形。

修复：自动轴以当前可见的**已揭示**marker price扩展series范围并留图形/文字margin，禁止引入未来OHLC；手动轴主动reveal取目标已知K与该请求关联成交价的并集，不用null fallback。capture同样要考虑该范围或严格使用已接受的冻结价格窗，确保早期锚点不被裁掉。需验证autoScale true/false、成交高于/低于已知范围、空K但有可信成交的明确呈现策略、刷新不擅自改用户窗。保留showExecutions设置的语义。

## C2 · P1 · 同K跨决策聚合的文字和点击身份不一致

`replay-chart.tsx:411–446,504–518,577–609`；`execution-markers.ts`以candle/side/account/scope聚合。

已知持仓1000，同K独立退出600后退出400，聚合后的after.long=0，显示“清仓 ×2”；hitTest却固定返回 `executionIds[0]`，点击清仓进入第一笔600的减仓决策。第二笔无法从该标记单独进入。R1-chart报告把它标为“稳定第一ID/待确认”并不能消除规格E07点选定位决策与同K多决策分别可访问的要求。另按group首笔排序再一次处理全组，遇到买→卖→买在同K交错时，也会先处理两个买再卖，推导错误库存/动作。

修复：先按权威稳定成交/决策顺序逐笔算动作，再按**决策身份**聚合券商拆单，不能把不同决策仅凭同K同方向合并；绘制错位/明确选择入口保证两决策可点击，或显式多决策选择器而非静默首ID。保持原成交ID与数量未知/方向未知语义，不以最终回合结论倒推早期动作。增加1000→600→400、同K买卖买、同决策拆单、未知数量反例；文字、highlight和click必须一致。

## C3 · P1 · live/capture whitespace时间投影不一致，且未建立真实轴时间点

`replay-chart.tsx:239–263,461–470`；`canonical-chart-capture.ts:107–121,176–184`。

live逐段插值，末尾按最后两根时间差外推；capture却按**最初两根差值**对全时段均匀推算。这不是同一projection。例：已知K为周四/周五/周一，marker在周二：live由周五→周一差3天外推为logical≈2.33；capture由周四→周五差1天算logical5。相同已留存场景导出成交明显错位。单根已知K时live默认1秒步长可把下一日事实外推86400个logical单位；capture无第二根，返回null后pointFor还可回退containingCandleTime，可能别名到旧K。

这些逻辑位置也没有向真实time scale登记whitespace时间数据；插值位置不自动成为轴上真实成交日期，不能把数值logical坐标存在等同于“实际时间投影正确”。root此前看到leftedge是中间运行证据，本次静态审查不声称已证明coordinate0瞬态的唯一根因；现在确实仍没有render-ready坐标校验，非null的0会被绘制/命中。

修复：live/capture共用一个按交易时段/当前周期且不泄露OHLC的权威时间轴方案，优先用已知时间的whitespace data建立真实轴点（不造OHLC），或提供可解释且一致的时间映射；空/单K、周末/缺口、日内停市、日期-only源均有明确处理。capture的marker不能经drawing pointFor回退旧K。仅在数据及时间/价格范围已经应用、目标投影有效时绘制/消费reveal；不要一概禁止x=0（可能是真实边缘），应检查时间归属和可见窗口。真实浏览器需验证首买未完成K锚点在正确时间、推进前后/保存捕获一致，无左边缘闪现。

## 接受边界

上述三个是源码确定的合同缺口，不能延到浏览器才决定是否修复。真实浏览器另验：目标K/成交和标签均实际可见、点击身份、resize/刷新视野、设置继承、capture一致。日期-only、暗盘、未知价不得通过伪造精确时间或OHLC来修复。标签颜色常量属于次要样式问题，本次不据此阻断；优先完成语义与可见性。

本报告仅针对已冻结chart/capture范围；state/frame仍在集成，未作R1或feature接受。原始数据、既有图形与设置均未改。
