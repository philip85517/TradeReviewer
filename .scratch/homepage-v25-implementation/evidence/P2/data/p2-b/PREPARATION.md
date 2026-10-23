# P2-B series：一页实施准备 / 独立字面 oracle

2026-10-23 03:16+08，实际 **gpt-6.1-sol / ultra**。只读准备；等 root 接受 P2-A 并明确授权后才实施。未改产品/测试/P2-A/S/跟踪，未跑测试、DB、浏览器、服务或新代理。

已完整重读数据合同（SHA `a882d59c3d6b2ed532250b207897bf0166e560426e58d6797e586faa28e7618a`）、HP02:191–252、手册 Metric611–698/ChartTooltip872–959，并直接查看 `source/images/{period,chart-hover,chart-hover--keyboard,chart-gap}.svg`（内存渲染，无落盘副本）。原图“费用”按批准合同细化为期间费用；不是运行UI证据。

读时 A source SHA `637f07933247a6d4dbcea5336e946e68b98e3ff5fe7ddc39e24ff194d79e8c4b`，test `f6d26840afd1a5bbc3dacf1151a05c6e947b14e20df4ffd31c8b91c95f04e683`；尚非接受。实际导出 `HomepageV25Period={start,end}`、opaque PreparedSource、EndpointMetrics、BoundaryPoint/Batch、ProjectionInputError(code)，以及 `projectHomepageV25Boundaries(source,{periodStart,asOf,endpoints:[{key,at}],targetCurrency?})`。派发前重绑冻结hash；旧 INTERFACES 中性能未达标声明不能替代root后续裁定。

**最小实施（仅新 series.ts / 同名test）：**

1. 导出 `buildHomepageV25Series(source,{period,asOf,targetCurrency?,requestGeneration})` / readonly Bundle；versions从公开Batch取Pick，不改F私有类型。校验真实Gregorian日期/顺序，首尾包含地枚举Shanghai自然日，key/at均YYYY-MM-DD，**一次batch**。不逐日fullbuilder、不写金融方程/缓存；S/host负责preset→已应用日期，B不再算preset或读Date.now。
2. 历史day不改ISO，保留date-only选择；A自动将当日clamp至精确asOf。未来保留null/future/不可绘制占位供灰区，不能当假数据点。current原样取独立batch.current。
3. effectiveEnd=min(requestedEnd,Shanghai(asOf))，早于start则null；summary取**最后非future点**六个期间字段及coverage，末点缺数也不能回退到较早plottable点。全未来summary null/future，current仍有效。boundary保留requestedEnd/effectiveEnd，精确截止在point.effectiveCursor。
4. 透传source/revisions/policies/scope、原币/coverage/evidence；六行顺序固定MV/净UF/lifetimeR/lifetimeNet/periodNet/periodFees。generation逐次原样回显，不能写进复用batch。S/host负责代次校验及整包提交；300/100ms、键盘有效点/缺口说明、固定/Esc返回及真实迟到旅程属P2-C。

**未来先RED的独立oracle（本次未执行）：** 金融fixture须真实summaries→entries、explicit live、合法市场日线，调用真实A，不mock金额。

|ID|输入 → 字面期望|
|---|---|
|01 day/截断|Jan5 date-only fill，Jan6 asOf的Jan5 day点包含；Jan5同日08:00Z点不包含，精确07:00 fill包含、09:00不包含。历史precision=day，当日=instant/cursor08:00Z；不能将历史day换15:59:59.999Z。|
|02 午夜/首日|`2026-01-04T16:00Z`属上海Jan5首日；前1ms只进opening。asOf跨该1ms，业务有效末日Jan4→Jan5。|
|03 周/年|已解析week `2025-12-29…2026-01-04`=7点；host周日Jan4仍Dec29起、Jan5新周。2025年365点、2024年366点且仅一个02-29；2026-02-29/倒序整体拒绝。|
|04 未来/summary|Jan5–9、asOf Jan7 08:00Z：5点，Jan7截断，8/9 future/null，summary=Jan7。Jan7缺报价/FX则相关项null，不能取Jan6；Jan8–9全未来effectiveEnd=null，current不变。|
|05 六行区别|期前买1@100、opening120、期间卖130全平、fee0/完整inception：六行0/0/30/30/10/0；summary R30/open20/close0/change−20/net10。换起点累计不变；缺inception仅累计unknown，不抄period10。|
|06 费用/缺口/零|期前买2@100费2、opening110；期间卖1@120费3、end115：openUF18/R16/closeUF14/change−4/net12/periodFees3/openFee1。缺完成session使依赖MV/UF/net null，R/fee独立；真零plottable，unknown/future不可画。|
|07 FX/current|原币R30/open20/close0/net10，openingFX7/endFX8→R240/change−160/net80，不能100；只有latest则历史target未知+原币保留。换period不改同source/asOf/target current，不用期末替代。|
|08 generation|同handle同范围g:01/g:02：金额证据相等、各自generation永不被覆盖；同revision改源内容须新sourceId。真实取消/迟到拒绝提交留P2-C验证。|

授权后保存真实接口RED→GREEN，跑A冻结相邻定向回归、strict tsc/lint，并以同1866×365 source测完整series开销/repeat；不能继承A计时冒充B成绩。当前不声称数据/UI/持久化/视觉接受。
